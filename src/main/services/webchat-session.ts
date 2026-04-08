import { platform } from 'os'
import { spawn } from 'child_process'
import { findBin, getPathEnv } from './path-utils'
import { runInWsl } from './wsl-utils'

export function getResetMainSessionCommand(): { cmd: string; args: string[]; useShellEnv: boolean } {
  if (platform() === 'win32') {
    return {
      cmd: 'wsl',
      args: ['-d', 'Ubuntu', '-u', 'root', '--', 'openclaw', 'agent', '--agent', 'main', '--message', '/reset'],
      useShellEnv: false
    }
  }

  return {
    cmd: findBin('openclaw'),
    args: ['agent', '--agent', 'main', '--message', '/reset'],
    useShellEnv: true
  }
}

export async function resetMainSession(): Promise<void> {
  if (platform() === 'win32') {
    await runInWsl('openclaw agent --agent main --message "/reset"', 30000)
    return
  }

  const { cmd, args, useShellEnv } = getResetMainSessionCommand()

  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: useShellEnv ? getPathEnv() : process.env
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `openclaw agent reset failed with exit code ${code}`))
    })
    child.on('error', reject)
  })
}
