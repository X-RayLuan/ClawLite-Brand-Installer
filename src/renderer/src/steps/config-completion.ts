export interface PrefilledConfigState {
  provider?: string
  model?: string
  gatewayToken?: string
}

export const isPrefilledConfigComplete = (config: PrefilledConfigState | null | undefined): boolean =>
  Boolean(config?.gatewayToken)

export const getPrefilledConfigCompletionError = (
  config: PrefilledConfigState | null | undefined
): string | null => {
  if (isPrefilledConfigComplete(config)) return null
  return 'ClawRouter setup is incomplete. Please finish ClawRouter connection before continuing.'
}
