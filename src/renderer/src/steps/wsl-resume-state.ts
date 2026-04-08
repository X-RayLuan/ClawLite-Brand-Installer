export type WslState =
  | 'not_available'
  | 'not_installed'
  | 'needs_reboot'
  | 'no_distro'
  | 'not_initialized'
  | 'ready'

export interface WizardResumeState {
  step: string
  wslInstalled: boolean
  timestamp: number
}

export const resolveResumedWslState = (
  currentState: WslState,
  savedState: WizardResumeState | null
): WslState => {
  if (!savedState?.wslInstalled || savedState.step !== 'wslSetup') {
    return currentState
  }

  if (currentState === 'ready') {
    return 'ready'
  }

  return 'needs_reboot'
}
