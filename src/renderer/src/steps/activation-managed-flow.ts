import type {
  ActivationBootstrapInput,
  ActivationConfigInjectionInput,
  ActivationFlowSnapshot,
  ActivationPlatform,
  ActivationProvisionInput,
  ActivationPurchaseInput,
  ActivationValidationInput
} from '@shared/activation/types'

export interface ManagedActivationApi {
  bootstrap: (input: ActivationBootstrapInput) => Promise<ActivationFlowSnapshot>
  startPurchase: (input: ActivationPurchaseInput) => Promise<ActivationFlowSnapshot>
  provision: (input: ActivationProvisionInput) => Promise<ActivationFlowSnapshot>
  injectConfig: (input: ActivationConfigInjectionInput) => Promise<ActivationFlowSnapshot>
  validate: (input: ActivationValidationInput) => Promise<ActivationFlowSnapshot>
}

export type ManagedActivationResult =
  | { ok: true; snapshot: ActivationFlowSnapshot }
  | { ok: false; error: string; snapshot?: ActivationFlowSnapshot }

export const getManagedActivationConfigTarget = (platform: ActivationPlatform): string =>
  platform === 'windows' ? '/root/.openclaw/openclaw.json' : '~/.openclaw/openclaw.json'

const getManagedActivationError = (snapshot: ActivationFlowSnapshot): string => {
  if (snapshot.errorMessage) return snapshot.errorMessage
  if (
    snapshot.recommendedPath !== 'connect_existing_purchase' ||
    !snapshot.allowedPaths.includes('connect_existing_purchase')
  ) {
    return 'Your ClawRouter account is not ready yet. Finish the ClawRouter purchase first, then try again, or use My Own API Key.'
  }
  return 'ClawRouter activation could not continue.'
}

export const continueManagedActivation = async (input: {
  accountId?: string
  appVersion: string
  platform: ActivationPlatform
  api: ManagedActivationApi
}): Promise<ManagedActivationResult> => {
  const bootstrapSnapshot = await input.api.bootstrap({
    installerInstanceId: 'clawlite-installer',
    platform: input.platform,
    appVersion: input.appVersion,
    accountId: input.accountId
  })

  if (
    bootstrapSnapshot.recommendedPath !== 'connect_existing_purchase' ||
    !bootstrapSnapshot.allowedPaths.includes('connect_existing_purchase')
  ) {
    return { ok: false, error: getManagedActivationError(bootstrapSnapshot), snapshot: bootstrapSnapshot }
  }

  let current = await input.api.startPurchase({ path: 'connect_existing_purchase' })

  if (current.phase === 'error') {
    return { ok: false, error: getManagedActivationError(current), snapshot: current }
  }

  if (current.phase === 'provisioning') {
    current = await input.api.provision({ deviceLabel: 'ClawLite Installer' })
  }

  if (current.phase === 'error') {
    return { ok: false, error: getManagedActivationError(current), snapshot: current }
  }

  if (current.phase === 'config_injection') {
    current = await input.api.injectConfig({
      targetConfigPath: getManagedActivationConfigTarget(input.platform)
    })
  }

  if (current.phase === 'error') {
    return { ok: false, error: getManagedActivationError(current), snapshot: current }
  }

  if (current.phase === 'validation') {
    current = await input.api.validate({ expectGatewayReachable: true })
  }

  if (current.phase !== 'completed') {
    return { ok: false, error: getManagedActivationError(current), snapshot: current }
  }

  return { ok: true, snapshot: current }
}
