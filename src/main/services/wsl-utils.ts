import { spawn } from 'child_process'
import { posix as pathPosix } from 'path'
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
      else reject(new Error(stderr.replace(/\0/g, '') || `exit ${code}`))
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })

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
      await runCmd('wsl', ['-d', ubuntuDistro, '-u', WSL_USER, '--', 'echo', 'ok'])
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
  new Promise((resolve, reject) => {
    const child = spawn('wsl', ['-d', WSL_DISTRO, '-u', WSL_USER, '--', 'bash', '-lc', script])
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
      else reject(new Error(stderr.replace(/\0/g, '') || `exit ${code}`))
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })

/** Read file inside WSL */
export const readWslFile = (path: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn('wsl', ['-d', WSL_DISTRO, '-u', WSL_USER, '--', 'cat', path])
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Timeout reading ${path}`))
    }, 10000)
    let stdout = ''
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout)
      else reject(new Error(`Failed to read ${path}`))
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })

/** Write file inside WSL */
export const writeWslFile = (path: string, content: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn('wsl', ['-d', WSL_DISTRO, '-u', WSL_USER, '--', 'tee', path])
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Timeout writing ${path}`))
    }, 10000)
    child.stdout.resume() // Consume tee stdout to prevent buffer hang
    child.stdin.write(content, () => child.stdin.end())
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`Failed to write ${path}`))
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })

export const resolveWslOpenClawConfigPath = async (): Promise<string> => {
  try {
    const resolved = await runInWsl('openclaw config file', 15000)
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
