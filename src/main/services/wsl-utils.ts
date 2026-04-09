import { spawn } from 'child_process'
import { posix as pathPosix } from 'path'
import { buildWslCommandVariants, isLegacyWslCommandHelpText } from './wsl-command'
import { buildWslOpenClawShellCommand } from './wsl-openclaw-command.ts'
import { detectWslStateFromOutputs } from './wsl-state-detection'

export type WslState =
  | 'not_available'
  | 'not_installed'
  | 'needs_reboot'
  | 'no_distro'
  | 'not_initialized'
  | 'ready'

const WSL_DISTRO = 'Ubuntu'
const WSL_USER = 'root'
const DEFAULT_WSL_OPENCLAW_STATE_DIR = '/root/.openclaw'
const DEFAULT_WSL_OPENCLAW_CONFIG_PATH = `${DEFAULT_WSL_OPENCLAW_STATE_DIR}/openclaw.json`

const runCmd = (cmd: string, args: string[], timeout = 15000): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args)
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('timeout'))
    }, timeout)
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout.replace(/\0/g, '').trim())
      else reject(new Error(stderr.replace(/\0/g, '') || stdout.replace(/\0/g, '') || `exit ${code}`))
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })

const runWslCommand = async (
  commandArgs: string[],
  timeout: number,
  options: {
    distro?: string
    user?: string
  } = {}
): Promise<string> => {
  const variants = buildWslCommandVariants(commandArgs, options)
  let lastError: unknown = null

  for (let index = 0; index < variants.length; index += 1) {
    try {
      return await runCmd('wsl', variants[index], timeout)
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      const shouldRetryLegacy = index === 0 && variants.length > 1 && isLegacyWslCommandHelpText(message)
      if (!shouldRetryLegacy) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export const checkWslState = async (): Promise<WslState> => {
  let versionOk = false
  // Check WSL availability (--version only supported on Store WSL)
  try {
    await runCmd('wsl', ['--version'])
    versionOk = true
  } catch {
    // Inbox WSL doesn't support --version → re-check by verifying wsl.exe exists
    try {
      await runCmd('where', ['wsl'])
      versionOk = true
    } catch {
      return 'not_available'
    }
  }

  let statusOutput = ''
  // Check if reboot is needed via wsl --status
  try {
    statusOutput = await runCmd('wsl', ['--status'])
    if (statusOutput.includes('reboot') || statusOutput.includes('restart')) {
      return 'needs_reboot'
    }
  } catch {
    // Reboot may be needed if --status fails
    // Proceed with additional check via wsl --list
  }

  let listOutput = ''
  // Check if any Ubuntu distro exists
  try {
    listOutput = await runCmd('wsl', ['--list', '--quiet'])
    const distros = listOutput.split('\n').map((s) => s.trim()).filter(Boolean)
    const ubuntuDistro = distros.find((d) => /^ubuntu/i.test(d)) || distros.find((d) => d === WSL_DISTRO)
    if (!ubuntuDistro) return 'no_distro'
    // Verify distro is registered and working properly
    try {
      await runWslCommand(['echo', 'ok'], 15000, { distro: ubuntuDistro, user: WSL_USER })
      return 'ready'
    } catch (error) {
      return detectWslStateFromOutputs({
        versionOk,
        statusOutput,
        listOutput,
        distroLaunchError: error instanceof Error ? error.message : ''
      })
    }
  } catch {
    // --list failed → WSL installed but not yet initialized
    return 'not_installed'
  }
}

/** Run command via bash -lc inside WSL Ubuntu (auto-loads nvm PATH) */
export const runInWsl = (script: string, timeout = 30000): Promise<string> =>
  runWslCommand(['bash', '-lc', script], timeout, { distro: WSL_DISTRO, user: WSL_USER })

export const runOpenClawInWsl = (args: string[], timeout = 30000): Promise<string> =>
  runWslCommand(['bash', '-lc', buildWslOpenClawShellCommand(args)], timeout, {
    distro: WSL_DISTRO,
    user: WSL_USER
  })

/** Read file inside WSL */
export const readWslFile = (path: string): Promise<string> =>
  runWslCommand(['cat', path], 10000, { distro: WSL_DISTRO, user: WSL_USER })

/** Write file inside WSL */
export const writeWslFile = (path: string, content: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const variants = buildWslCommandVariants(['tee', path], {
      distro: WSL_DISTRO,
      user: WSL_USER
    })
    const runVariant = (index: number): void => {
      const child = spawn('wsl', variants[index])
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error(`Timeout writing ${path}`))
      }, 10000)
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d) => (stdout += d.toString()))
      child.stderr.on('data', (d) => (stderr += d.toString()))
      child.stdin.write(content, () => child.stdin.end())
      child.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) {
          resolve()
          return
        }
        const message = stderr.replace(/\0/g, '') || stdout.replace(/\0/g, '') || `Failed to write ${path}`
        if (index === 0 && variants.length > 1 && isLegacyWslCommandHelpText(message)) {
          runVariant(index + 1)
          return
        }
        reject(new Error(message))
      })
      child.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    }
    runVariant(0)
  })

export const resolveWslOpenClawConfigPath = async (): Promise<string> => {
  try {
    const resolved = await runOpenClawInWsl(['config', 'file'], 15000)
    const trimmed = resolved.trim()
    return trimmed || DEFAULT_WSL_OPENCLAW_CONFIG_PATH
  } catch {
    return DEFAULT_WSL_OPENCLAW_CONFIG_PATH
  }
}

export const resolveWslOpenClawStateDir = async (): Promise<string> => {
  const configPath = await resolveWslOpenClawConfigPath()
  return pathPosix.dirname(configPath)
}
