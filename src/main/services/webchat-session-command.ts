import { buildWslOpenClawCommandArgs } from './wsl-openclaw-command.ts'

export type SessionCommand = { cmd: string; args: string[]; useShellEnv: boolean }

export function buildResetMainSessionCommand(
  openclawCommand: string,
  currentPlatform: NodeJS.Platform
): SessionCommand {
  if (currentPlatform === 'win32') {
    return {
      cmd: 'wsl',
      args: buildWslOpenClawCommandArgs(['agent', '--agent', 'main', '--message', '/reset']),
      useShellEnv: false
    }
  }

  return {
    cmd: openclawCommand,
    args: ['agent', '--agent', 'main', '--message', '/reset'],
    useShellEnv: true
  }
}

export function buildPrepareMainSessionCommand(
  openclawCommand: string,
  modelId: string,
  currentPlatform: NodeJS.Platform
): SessionCommand {
  if (currentPlatform === 'win32') {
    return {
      cmd: 'wsl',
      args: buildWslOpenClawCommandArgs(['agent', '--agent', 'main', '--message', `/new ${modelId}`]),
      useShellEnv: false
    }
  }

  return {
    cmd: openclawCommand,
    args: ['agent', '--agent', 'main', '--message', `/new ${modelId}`],
    useShellEnv: true
  }
}
