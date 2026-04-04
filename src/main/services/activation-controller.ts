import {
  ActivationBootstrapInput,
  ActivationConfigInjectionInput,
  ActivationFlowSnapshot,
  ActivationPlatform,
  ActivationProvisionInput,
  ActivationPurchaseInput,
  ActivationValidationInput
} from '../../shared/activation/types'

type ActivationScenario = 'already-purchased' | 'not-purchased' | 'manual-only'

const nowIso = (): string => new Date().toISOString()

const scenarioFromEnv = (): ActivationScenario => {
  const raw = process.env.CLAWLITE_ACTIVATION_SCENARIO
  if (raw === 'already-purchased' || raw === 'manual-only') return raw
  return 'not-purchased'
}

const createBaseSnapshot = (
  input: ActivationBootstrapInput,
  scenario: ActivationScenario
): ActivationFlowSnapshot => {
  const installerInstanceId = input.installerInstanceId || 'installer-local-dev'
  const baseBinding = {
    downloadSessionId: input.downloadSessionId,
    installerInstanceId,
    platform: input.platform,
    appVersion: input.appVersion
  }

  if (scenario === 'manual-only') {
    return {
      flowVersion: '2026-04-03',
      phase: 'manual_path_only',
      recommendedPath: 'use_own_key',
      allowedPaths: ['use_own_key'],
      binding: baseBinding,
      purchase: {
        entitlement: 'unknown',
        plan: 'clawrouter',
        status: 'not_started',
        lastUpdatedAt: nowIso()
      },
      provisioning: { status: 'idle' },
      configInjection: { status: 'idle' },
      validation: { status: 'idle' },
      constraints: [
        'No installer-bound account session was resolved.',
        'Fallback to BYOK remains available.'
      ],
      nextActionLabel: 'Use My Own API Key'
    }
  }

  const activeEntitlement = scenario === 'already-purchased'
  const recommendedPath = activeEntitlement ? 'connect_existing_purchase' : 'buy_and_connect'
  const allowedPaths: ActivationFlowSnapshot['allowedPaths'] = [
    'buy_and_connect',
    'use_own_key',
    ...(activeEntitlement ? (['connect_existing_purchase'] as const) : [])
  ]

  return {
    flowVersion: '2026-04-03',
    phase: 'ready_for_activation',
    recommendedPath,
    allowedPaths,
    binding: {
      ...baseBinding,
      setupToken: 'stp_demo_bound_token',
      setupTokenExpiresAt: '2026-04-04T00:00:00.000Z',
      account: {
        accountId: 'acct_demo_clawrouter',
        emailMasked: 'ra***@clawlite.ai'
      }
    },
    purchase: {
      entitlement: activeEntitlement ? 'active' : 'inactive',
      plan: 'clawrouter',
      status: activeEntitlement ? 'completed' : 'not_started',
      lastUpdatedAt: nowIso()
    },
    provisioning: { status: 'idle' },
    configInjection: { status: 'idle' },
    validation: { status: 'idle' },
    constraints: [
      'Do not expose raw ClawRouter API keys in the installer UI.',
      'Prefer account-bound credential references and local config injection.'
    ],
    nextActionLabel: activeEntitlement ? 'Connect ClawRouter' : 'Activate ClawRouter'
  }
}

const cloneSnapshot = (snapshot: ActivationFlowSnapshot): ActivationFlowSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as ActivationFlowSnapshot

export class ActivationController {
  private snapshot: ActivationFlowSnapshot | null = null

  bootstrap(input: ActivationBootstrapInput): ActivationFlowSnapshot {
    this.snapshot = createBaseSnapshot(input, scenarioFromEnv())
    return cloneSnapshot(this.snapshot)
  }

  getState(): ActivationFlowSnapshot | null {
    return this.snapshot ? cloneSnapshot(this.snapshot) : null
  }

  useOwnKey(): ActivationFlowSnapshot {
    const snapshot = this.requireSnapshot()
    snapshot.phase = 'skipped_to_byok'
    snapshot.selectedPath = 'use_own_key'
    snapshot.nextActionLabel = 'Continue with API Key'
    snapshot.errorMessage = undefined
    return cloneSnapshot(snapshot)
  }

  startPurchase(input: ActivationPurchaseInput): ActivationFlowSnapshot {
    const snapshot = this.requireSnapshot()
    snapshot.selectedPath = input.path
    snapshot.errorMessage = undefined

    if (input.path === 'connect_existing_purchase') {
      if (snapshot.purchase.entitlement !== 'active') {
        snapshot.phase = 'error'
        snapshot.errorMessage = 'ClawRouter entitlement is not active for this account.'
        return cloneSnapshot(snapshot)
      }
      snapshot.phase = 'provisioning'
      snapshot.nextActionLabel = 'Provision ClawRouter'
      return cloneSnapshot(snapshot)
    }

    snapshot.phase = 'purchase_pending'
    snapshot.purchase.status = 'checkout_pending'
    snapshot.purchase.checkoutUrl = 'https://clawlite.ai/checkout/demo-clawrouter'
    snapshot.purchase.lastUpdatedAt = nowIso()
    snapshot.nextActionLabel = 'Complete Purchase in Browser'
    return cloneSnapshot(snapshot)
  }

  confirmPurchase(): ActivationFlowSnapshot {
    const snapshot = this.requireSnapshot()
    snapshot.phase = 'provisioning'
    snapshot.purchase.entitlement = 'active'
    snapshot.purchase.status = 'completed'
    snapshot.purchase.lastUpdatedAt = nowIso()
    snapshot.nextActionLabel = 'Provision ClawRouter'
    snapshot.errorMessage = undefined
    return cloneSnapshot(snapshot)
  }

  provision(input: ActivationProvisionInput): ActivationFlowSnapshot {
    const snapshot = this.requireSnapshot()
    if (snapshot.purchase.entitlement !== 'active') {
      snapshot.phase = 'error'
      snapshot.errorMessage = 'Cannot provision before purchase entitlement is active.'
      return cloneSnapshot(snapshot)
    }

    snapshot.phase = 'config_injection'
    snapshot.provisioning = {
      status: 'bound',
      bindingId: 'bind_demo_clawrouter',
      credentialRef: `credref:${input.deviceLabel.toLowerCase().replace(/\s+/g, '-')}`,
      provider: 'clawrouter',
      model: 'clawrouter/auto',
      configuredAt: nowIso()
    }
    snapshot.nextActionLabel = 'Write OpenClaw Configuration'
    snapshot.errorMessage = undefined
    return cloneSnapshot(snapshot)
  }

  injectConfig(input: ActivationConfigInjectionInput): ActivationFlowSnapshot {
    const snapshot = this.requireSnapshot()
    const credentialRef = snapshot.provisioning.credentialRef
    const model = snapshot.provisioning.model

    if (!credentialRef || !model) {
      snapshot.phase = 'error'
      snapshot.errorMessage = 'Provisioning is incomplete. No credential reference is available.'
      return cloneSnapshot(snapshot)
    }

    snapshot.phase = 'validation'
    snapshot.configInjection = {
      status: 'written',
      configTarget: input.targetConfigPath,
      patchPreview: {
        provider: 'clawrouter',
        credentialRef,
        model
      }
    }
    snapshot.nextActionLabel = 'Validate Connection'
    snapshot.errorMessage = undefined
    return cloneSnapshot(snapshot)
  }

  validate(input: ActivationValidationInput): ActivationFlowSnapshot {
    const snapshot = this.requireSnapshot()
    if (snapshot.configInjection.status !== 'written') {
      snapshot.phase = 'error'
      snapshot.errorMessage = 'Config must be written before validation can run.'
      return cloneSnapshot(snapshot)
    }

    snapshot.phase = 'completed'
    snapshot.validation = {
      status: 'passed',
      gatewayReachable: input.expectGatewayReachable ?? true,
      accountConfirmed: true,
      latencyMs: 318
    }
    snapshot.nextActionLabel = 'ClawRouter Connected'
    snapshot.errorMessage = undefined
    return cloneSnapshot(snapshot)
  }

  private requireSnapshot(): ActivationFlowSnapshot {
    if (!this.snapshot) {
      const fallback: ActivationBootstrapInput = {
        installerInstanceId: 'installer-local-dev',
        platform: 'unknown' as ActivationPlatform,
        appVersion: '0.0.0'
      }
      this.snapshot = createBaseSnapshot(fallback, 'manual-only')
    }
    return this.snapshot
  }
}

export const activationController = new ActivationController()
