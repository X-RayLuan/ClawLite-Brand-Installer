export type SessionCommand = { cmd: string; args: string[]; useShellEnv: boolean }
export type SessionPlan = SessionCommand & { skip?: boolean }

export function buildResetMainSessionCommand(
  openclawCommand: string,
  currentPlatform: NodeJS.Platform
): SessionPlan {
  if (currentPlatform === 'win32') {
    return {
      cmd: '',
      args: [],
      useShellEnv: false,
      skip: true
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
): SessionPlan {
  if (currentPlatform === 'win32') {
    return {
      cmd: '',
      args: [],
      useShellEnv: false,
      skip: true
    }
  }

  return {
    cmd: openclawCommand,
    args: ['agent', '--agent', 'main', '--message', `/new ${modelId}`],
    useShellEnv: true
  }
}
