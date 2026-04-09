import { platform } from 'os'
import { spawn } from 'child_process'
import { findBin, getPathEnv } from './path-utils'
import {
  buildPrepareMainSessionCommand,
  buildResetMainSessionCommand,
  type SessionPlan
} from './webchat-session-command'

export function getResetMainSessionCommand(
  currentPlatform: NodeJS.Platform = platform()
): SessionPlan {
  return buildResetMainSessionCommand(findBin('openclaw'), currentPlatform)
}

export function getPrepareMainSessionCommand(
  modelId: string,
  currentPlatform: NodeJS.Platform = platform()
): SessionPlan {
  return buildPrepareMainSessionCommand(findBin('openclaw'), modelId, currentPlatform)
}

const runSessionCommand = async (command: SessionPlan): Promise<void> => {
  if (command.skip) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.cmd, command.args, {
      env: command.useShellEnv ? getPathEnv() : process.env
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `openclaw agent command failed with exit code ${code}`))
    })
    child.on('error', reject)
  })
}

export async function resetMainSession(): Promise<void> {
  const currentPlatform = platform()
  await runSessionCommand(getResetMainSessionCommand(currentPlatform))
}

export async function prepareMainSession(modelId: string): Promise<void> {
  const currentPlatform = platform()
  await runSessionCommand(getPrepareMainSessionCommand(modelId, currentPlatform))
}
