import { spawn } from 'child_process'
import { createWriteStream, existsSync, mkdirSync, rmSync } from 'fs'
import { tmpdir, homedir } from 'os'
import { join } from 'path'
import https from 'https'
import { BrowserWindow } from 'electron'
import { runInWsl } from './wsl-utils'
import { getPathEnv } from './path-utils'
import {
  buildElevatedWslInstallScript,
  buildEncodedPowerShellArgs,
  summarizeElevatedPowerShellFailure
} from './windows-powershell'
import { createDecodedLineCollector } from './stream-lines'
import { decodeWindowsCommandOutput } from './windows-output-decoder'
import { isLikelySuccessfulWslInstallResult, isWslRebootRequiredText } from './wsl-install-result'
import { t } from '../../shared/i18n/main'

type ProgressCallback = (msg: string) => void

interface RunError extends Error {
  lines?: string[]
}

const OPENCLAW_PACKAGE_SPEC = 'openclaw@2026.3.13'

const sendProgress = (win: BrowserWindow, msg: string): void => {
  win.webContents.send('install:progress', msg)
}

const downloadFile = (url: string, dest: string, maxRedirects = 5): Promise<void> =>
  new Promise((resolve, reject) => {
    let redirectCount = 0
    const follow = (u: string): void => {
      https
        .get(u, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.resume()
            if (++redirectCount > maxRedirects) {
              reject(new Error('Too many redirects'))
              return
            }
            follow(res.headers.location)
            return
          }
          if (!res.statusCode || res.statusCode >= 400) {
            res.resume()
            reject(new Error(`HTTP ${res.statusCode}`))
            return
          }
          const file = createWriteStream(dest)
          res.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve()
          })
          file.on('error', reject)
        })
        .on('error', reject)
    }
    follow(url)
  })

const runWithLog = (
  cmd: string,
  args: string[],
  onLog: ProgressCallback,
  options?: { shell?: boolean; env?: NodeJS.ProcessEnv; cwd?: string }
): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      shell: options?.shell ?? false,
      env: { ...options?.env ?? process.env, PYTHONIOENCODING: 'utf-8', CHCP: '65001' },
      cwd: options?.cwd
    })

    const lines: string[] = []
    const onLine = (line: string): void => {
      onLog(line)
      lines.push(line)
    }
    const stdoutCollector = createDecodedLineCollector(onLine)
    const stderrCollector = createDecodedLineCollector(onLine)
    child.stdout.on('data', (d) => {
      stdoutCollector.push(d)
    })
    child.stderr.on('data', (d) => {
      stderrCollector.push(d)
    })
    child.on('close', (code) => {
      stdoutCollector.end()
      stderrCollector.end()
      if (code === 0) resolve(lines)
      else {
        const err: RunError = new Error(`Command failed: ${cmd} ${args.join(' ')} (exit ${code})`)
        err.lines = lines
        reject(err)
      }
    })
    child.on('error', reject)
  })

// ─── WSL installation functions (Windows) ───

/** Install WSL itself (wsl --install -d Ubuntu --no-launch) — UAC elevation */
export const installWsl = async (win: BrowserWindow): Promise<{ needsReboot: boolean }> => {
  const log = (msg: string): void => sendProgress(win, msg)
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const stdoutPath = join(tmpdir(), `clawlite-wsl-install-${stamp}.out.log`)
  const stderrPath = join(tmpdir(), `clawlite-wsl-install-${stamp}.err.log`)
  const resultPath = `${stdoutPath}.result.json`

  log(t('installer.wslInstalling'))
  log(t('installer.wslAdminPrompt'))
  try {
    await runWithLog(
      'powershell',
      buildEncodedPowerShellArgs(buildElevatedWslInstallScript(stdoutPath, stderrPath)),
      log
    )
  } catch (err) {
    // Read the actual WSL output files with proper encoding detection
    const readWithBom = (filePath: string): string => {
      try {
        const buf = require('fs').readFileSync(filePath)
        return decodeWindowsCommandOutput(buf)
      } catch {
        return ''
      }
    }
    const fileStdout = readWithBom(stdoutPath)
    const fileStderr = readWithBom(stderrPath)
    const fileResult = readWithBom(resultPath)
    const errMsg = err instanceof Error ? err.message : ''
    const errLines = ((err as RunError).lines ?? []).join('\n')
    const stdoutExists = existsSync(stdoutPath)
    const stderrExists = existsSync(stderrPath)
    const resultExists = existsSync(resultPath)
    const { statSync } = require('fs')
    const stdoutSize = stdoutExists ? statSync(stdoutPath).size : 0
    const stderrSize = stderrExists ? statSync(stderrPath).size : 0
    // resultSize used for internal logging only
    const _resultSize = resultExists ? statSync(resultPath).size : 0
    void _resultSize
    let wslLikelySucceeded = false
    if (fileResult) {
      try {
        const parsed = JSON.parse(fileResult)
        const attempts = Array.isArray(parsed.attempts) ? parsed.attempts : []
        const finalExit = parsed.finalExitCode ?? -1
        const reached = parsed.reached === true
        if (
          isLikelySuccessfulWslInstallResult({
            finalExitCode: finalExit,
            reached,
            attempts,
            outputText: fileStdout
          })
        ) {
          wslLikelySucceeded = true
        }
        // Only build debug summary for logs, not for user display
        const attemptSummary = attempts
          .map(
            (attempt: {
              name?: string
              exitCode?: number | null
              stdoutBytes?: number
              stderrBytes?: number
            }) =>
              `${attempt.name ?? 'unknown'} exit=${attempt.exitCode ?? 'null'} stdout=${attempt.stdoutBytes ?? 0} stderr=${attempt.stderrBytes ?? 0}`
          )
          .join('; ')
        // Log internally but don't show to user
        log(`WSL result JSON: finalExit=${finalExit}, reached=${reached}, attempts=${attemptSummary}`)
      } catch {
      }
    }

    // If WSL likely succeeded, don't show error — prompt reboot
    if (wslLikelySucceeded) {
      log('WSL installation appears to have completed. A reboot may be required.')
      return { needsReboot: true }
    }

    // Also check errLines/errMsg for JSON result (PowerShell may output it to stdout)
    if (!wslLikelySucceeded) {
      const allText = errMsg + '\n' + errLines + '\n' + fileStdout
      const jsonMatch = allText.match(/\{[\s\S]*"attempts"[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          const attempts = Array.isArray(parsed.attempts) ? parsed.attempts : []
          const finalExit = parsed.finalExitCode ?? -1
          const reached = parsed.reached === true
          if (
            isLikelySuccessfulWslInstallResult({
              finalExitCode: finalExit,
              reached,
              attempts,
              outputText: allText
            })
          ) {
            log('WSL installation appears to have completed (detected from stdout). A reboot may be required.')
            return { needsReboot: true }
          }
        } catch {}
      }
    }
    const combined = summarizeElevatedPowerShellFailure({
      fileStdout,
      fileStderr,
      errLines,
      errMsg,
      resultSummary: '', // Don't pass internal JSON to user-facing summary
      stdoutExists,
      stderrExists,
      stdoutSize,
      stderrSize
    })

    // Check if WSL actually completed despite stderr noise
    if (
      combined.toLowerCase().includes('completed') ||
      combined.toLowerCase().includes('successfully') ||
      isWslRebootRequiredText(combined)
    ) {
      log('WSL installation appears to have completed despite stderr output.')
      log('A reboot may be required to finalize.')
      return { needsReboot: true }
    }

    // Log full error for debugging
    log('WSL installation error details:')
    log(combined)

    // exit 4294967295 = ERROR_ALREADY_EXISTS: Ubuntu already registered
    if (combined.includes('4294967295')) {
      log(t('installer.ubuntuAlreadyRegistered'))
      try {
        await runInWsl('echo initialized', 30000)
        log(t('installer.ubuntuInitDone'))
        return { needsReboot: false }
      } catch {
        throw new Error(`WSL already installed but not responding. Full error: ${combined}`)
      }
    }
    const lower = combined.toLowerCase()

    // User denied UAC or permission error
    if (
      lower.includes('canceled') ||
      lower.includes('cancelled') ||
      lower.includes('elevation') ||
      lower.includes('access denied') ||
      lower.includes('permission')
    ) {
      throw new Error(`${t('installer.adminRequired')} - Please run the installer as Administrator.`)
    }
    // wsl command not found (unsupported Windows version)
    if (lower.includes('not recognized') || lower.includes('not found')) {
      throw new Error(`${t('installer.windowsVersionError')} - WSL requires Windows 10 version 1903+ or Windows 11.`)
    }
    // Virtualization disabled
    if (lower.includes('virtualization') || lower.includes('hyper-v')) {
      throw new Error(`${t('installer.biosVirtualization')} - Please enable Virtualization (VT-x/AMD-V) in BIOS settings.`)
    }
    
    // Network / download failure
    if (lower.includes('download') || lower.includes('network') || lower.includes('0x800') || lower.includes('timeout')) {
      throw new Error('WSL download failed — check your internet connection and try again. If behind a proxy, configure system proxy settings first.')
    }
    // Windows optional features not enabled
    if (lower.includes('optional feature') || lower.includes('dism') || lower.includes('windowsoptionalfeature') || lower.includes('enable-windowsoptionalfeature')) {
      throw new Error('Required Windows features are not enabled. Please run in an elevated PowerShell:\n  dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart\n  dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart\nThen reboot and try again.')
    }
    // PowerShell execution policy
    if (lower.includes('execution policy') || lower.includes('is not digitally signed') || lower.includes('cannot be loaded because running scripts is disabled')) {
      throw new Error('PowerShell execution policy is blocking the installer. Run this in an elevated PowerShell first:\n  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned\nThen try again.')
    }
    // Reboot required (WSL partially installed)
    if (lower.includes('reboot') || lower.includes('restart') || lower.includes('3010')) {
      log('WSL components installed but a reboot is required.')
      return { needsReboot: true }
    }
    // Final cleanup: strip JSON blobs, non-readable lines, and internal debug info
    const userMessage = combined
      .split('\n')
      .filter((line) => {
        const t = line.trim()
        if (!t) return false
        // Strip JSON lines
        if (t.startsWith('{') || t.startsWith('}') || t.startsWith('"') || t.startsWith('[')) return false
        // Strip lines that are mostly non-ASCII
        const nonAscii = (t.match(/[^\x20-\x7E]/g) || []).length
        if (t.length > 5 && nonAscii > t.length * 0.3) return false
        // Strip internal debug patterns
        if (/^(attempts|exitCode|stdoutBytes|stderrBytes|exception|reached|finalExitCode|name)\s*:/i.test(t)) return false
        if (/^\s*\d+\s*$/.test(t)) return false
        return true
      })
      .join('\n')
      .trim()

    // If after cleanup there's nothing meaningful, give a generic message
    const finalMessage = userMessage || 'WSL installation failed. Please try running "wsl --install" manually in an elevated PowerShell window.'
    throw new Error(finalMessage)
  } finally {
    rmSync(stdoutPath, { force: true })
    rmSync(stderrPath, { force: true })
    rmSync(resultPath, { force: true })
  }
  log(t('installer.wslDone'))
  return { needsReboot: true }
}

/** Install Node.js 22 LTS inside WSL Ubuntu (NodeSource apt repo) */
export const installNodeWsl = async (win: BrowserWindow): Promise<void> => {
  const log = (msg: string): void => sendProgress(win, msg)

  log(t('installer.wslPackages'))
  
  // Use Tsinghua mirror for apt sources (faster in China)
  log('Configuring apt sources for faster downloads...')
  try {
    await runInWsl(
      'sed -i "s@http://.*archive.ubuntu.com@https://mirrors.tuna.tsinghua.edu.cn@g" /etc/apt/sources.list',
      30000
    )
  } catch {
    log('Mirror configuration failed, using default sources')
  }
  
  try {
    await runInWsl('apt-get update && apt-get install -y curl ca-certificates gnupg', 120000)
  } catch {
    log(t('installer.aptFailed'))
  }

  log(t('installer.nodeWslInstalling'))
  await runInWsl(
    'curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs',
    300000
  )

  log(t('installer.nodeWslDone'))
}

/** Install openclaw globally inside WSL Ubuntu */
export const installOpenClawWsl = async (win: BrowserWindow): Promise<void> => {
  const log = (msg: string): void => sendProgress(win, msg)
  log(t('installer.ocWslInstalling'))
  
  // Detect best npm registry based on network latency
  log('Detecting fastest npm registry...')
  const registries = [
    { name: 'npmmirror (China)', url: 'https://registry.npmmirror.com' },
    { name: 'npm official', url: 'https://registry.npmjs.org' },
    { name: 'Tencent Cloud (China)', url: 'https://mirrors.cloud.tencent.com/npm/' }
  ]
  
  let fastestRegistry = registries[1].url // default to official
  try {
    // Quick ping test to find fastest registry
    const testCmd = registries.map(r => 
      `curl -o /dev/null -s -w '%{time_total}' -m 3 ${r.url} || echo 999`
    ).join(' & ')
    
    const times = await runInWsl(`bash -c "${testCmd}; wait"`, 15000)
    const latencies = times.split('\n').map(t => parseFloat(t.trim()))
    const fastestIdx = latencies.indexOf(Math.min(...latencies))
    
    if (fastestIdx >= 0 && latencies[fastestIdx] < 10) {
      fastestRegistry = registries[fastestIdx].url
      log(`Using ${registries[fastestIdx].name} (${latencies[fastestIdx].toFixed(2)}s)`)
    }
  } catch {
    log('Registry detection failed, using default')
  }
  
  try {
    log(`Installing ${OPENCLAW_PACKAGE_SPEC} from ${fastestRegistry}...`)
    await runInWsl(
      `npm install -g ${OPENCLAW_PACKAGE_SPEC} --registry=${fastestRegistry} --verbose`,
      300000
    )
  } catch (err) {
    // Fallback to official registry
    log('Retrying with official npm registry...')
    await runInWsl(`npm install -g ${OPENCLAW_PACKAGE_SPEC} --verbose`, 300000)
  }
  
  log(t('installer.ocWslDone'))
}

// ─── macOS installation functions ───

export const installNodeMac = async (win: BrowserWindow): Promise<void> => {
  const log = (msg: string): void => sendProgress(win, msg)
  const url = `https://nodejs.org/dist/v22.16.0/node-v22.16.0.pkg`
  const dest = join(tmpdir(), 'node-installer.pkg')

  log(t('installer.nodeDownloading'))
  await downloadFile(url, dest)
  log(t('installer.nodeInstallerOpening'))
  await runWithLog('open', ['-W', dest], log)
  log(t('installer.nodeDone'))
}

// getPathEnv imported from path-utils.ts (includes NODE_OPTIONS removal)

const isXcodeCliInstalled = (): Promise<boolean> =>
  new Promise((resolve) => {
    const child = spawn('xcode-select', ['-p'])
    child.on('close', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })

const ensureXcodeCli = async (log: ProgressCallback): Promise<void> => {
  if (await isXcodeCliInstalled()) return

  log(t('installer.xcodeOpening'))
  spawn('xcode-select', ['--install'])

  log(t('installer.xcodePrompt'))
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    if (await isXcodeCliInstalled()) {
      log(t('installer.xcodeDone'))
      return
    }
  }
  throw new Error(t('installer.xcodeTimeout'))
}

export const installOpenClaw = async (win: BrowserWindow): Promise<void> => {
  const log = (msg: string): void => sendProgress(win, msg)
  log(t('installer.ocInstalling'))

  await ensureXcodeCli(log)
  const npmCacheDir = join(homedir(), '.npm')
  if (existsSync(npmCacheDir)) {
    const uid = process.getuid?.() ?? 501
    const gid = process.getgid?.() ?? 20
    await runWithLog('chown', ['-R', `${uid}:${gid}`, npmCacheDir], log).catch(() => {})
  }
  const npmGlobalDir = join(homedir(), '.npm-global')
  if (!existsSync(npmGlobalDir)) mkdirSync(npmGlobalDir, { recursive: true })
  await runWithLog('npm', ['config', 'set', 'prefix', npmGlobalDir], log, {
    env: getPathEnv()
  })
  await runWithLog('npm', ['install', '-g', OPENCLAW_PACKAGE_SPEC], log, {
    env: getPathEnv()
  })

  log(t('installer.ocDone'))
}
