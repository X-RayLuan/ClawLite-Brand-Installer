import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type {
  ActivationBackendMode,
  ActivationBootstrapInput,
  ActivationConfigInjectionInput,
  ActivationFlowSnapshot,
  ActivationOffer,
  ActivationPath,
  ActivationPlatform,
  ActivationProvisionInput,
  ActivationPurchaseInput,
  ActivationResaleInput,
  ActivationValidationInput
} from '../../shared/activation/types'

type ActivationScenario = 'already-purchased' | 'not-purchased' | 'manual-only'

type RemoteBootstrapResponse = {
  setupToken?: string
  setupTokenExpiresAt?: string
  account?: {
    accountId: string
    emailMasked: string
  }
  entitlement?: {
    status?: 'active' | 'inactive' | 'unknown'
    plan?: 'clawrouter'
  }
  allowedPaths?: ActivationFlowSnapshot['allowedPaths']
  recommendedPath?: ActivationFlowSnapshot['recommendedPath']
}

type RemotePurchaseResponse = {
  purchaseState?: 'not_started' | 'checkout_pending' | 'completed' | 'failed'
  checkoutUrl?: string
  pollAfterMs?: number
}

type RemoteProvisionResponse = {
  provisioningState?: 'binding' | 'bound' | 'failed'
  bindingId?: string
  credentialRef?: string
  provider?: 'clawrouter'
  model?: string
}

type RemoteConfigResponse = {
  configInjectionState?: 'writing' | 'written' | 'failed'
  configTarget?: string
  patchPreview?: {
    provider: 'clawrouter'
    credentialRef: string
    model: string
  }
}

type RemoteValidationResponse = {
  validationState?: 'testing' | 'passed' | 'failed'
  gatewayReachable?: boolean
  accountConfirmed?: boolean
  latencyMs?: number
}

type RemoteResaleResponse = {
  status?: 'submitted' | 'failed'
  intakeId?: string
  reviewUrl?: string
}

const nowIso = (): string => new Date().toISOString()

const scenarioFromEnv = (): ActivationScenario => {
  const raw = process.env.CLAWLITE_ACTIVATION_SCENARIO
  if (raw === 'already-purchased' || raw === 'manual-only') return raw
  return 'not-purchased'
}

const activationApiBase = (): string | null => {
  const raw = process.env.CLAWLITE_ACTIVATION_API_BASE?.trim()
  return raw ? raw.replace(/\/$/, '') : 'https://clawlite.ai'
}

const activationApiEndpoints = {
  bootstrap: '/api/installer/activation/bootstrap',
  purchase: '/api/installer/activation/purchase',
  purchaseState: '/api/installer/activation/purchase-state',
  provision: '/api/installer/activation/provision',
  injectConfig: '/api/installer/activation/inject-config',
  validate: '/api/installer/activation/validate',
  resaleIntake: '/api/installer/activation/resale-intake'
} as const

const backendMode = (): ActivationBackendMode => (activationApiBase() ? 'remote' : 'mock')

const useRemoteActivation = (): boolean => Boolean(activationApiBase())

const apiUrl = (path: string): string => `${activationApiBase()}${path}`

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(`Activation API failed (${response.status}) for ${path}`)
  }

  return (await response.json()) as T
}

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(apiUrl(path))

  if (!response.ok) {
    throw new Error(`Activation API failed (${response.status}) for ${path}`)
  }

  return (await response.json()) as T
}

const defaultOffers = (): ActivationOffer[] => [
  {
    id: 'official-clawrouter-seat',
    title: 'Official ClawRouter Seat',
    summary: 'New seat sold directly by ClawLite and provisioned into this installer flow.',
    priceLabel: '$12 / month',
    settlementLabel: 'Checkout + installer binding',
    deliveryEstimate: 'Immediate after purchase confirmation',
    tag: 'official'
  },
  {
    id: 'verified-resale-seat',
    title: 'Verified Resale Seat',
    summary: 'Seller-submitted slot routed through manual review before entitlement transfer.',
    priceLabel: '$8 - $10 / month',
    settlementLabel: 'Manual review, then entitlement transfer',
    deliveryEstimate: 'Same day after review',
    tag: 'resale'
  }
]

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
      backendMode: backendMode(),
      phase: 'manual_path_only',
      recommendedPath: 'use_own_key',
      allowedPaths: ['use_own_key'],
      offers: defaultOffers(),
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
      resale: { status: 'idle' },
      constraints: [
        'No installer-bound account session was resolved.',
        'Fallback to BYOK remains available.',
        'Purchase and resale settlement stay outside the installer in this MVP.'
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
    backendMode: backendMode(),
    phase: 'ready_for_activation',
    recommendedPath,
    allowedPaths,
    offers: defaultOffers(),
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
    resale: { status: 'idle' },
    constraints: [
      'Do not expose raw ClawRouter API keys in the installer UI.',
      'Prefer account-bound credential references and local config injection.',
      'Purchase and resale settlement stay outside the installer in this MVP.'
    ],
    nextActionLabel: activeEntitlement ? 'Connect ClawRouter' : 'Activate ClawRouter'
  }
}

const cloneSnapshot = (snapshot: ActivationFlowSnapshot): ActivationFlowSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as ActivationFlowSnapshot

export class ActivationController {
  private snapshot: ActivationFlowSnapshot | null = null

  async bootstrap(input: ActivationBootstrapInput): Promise<ActivationFlowSnapshot> {
    if (!useRemoteActivation()) {
      this.snapshot = createBaseSnapshot(input, scenarioFromEnv())
      return cloneSnapshot(this.snapshot)
    }

    try {
      const remote = await postJson<RemoteBootstrapResponse>(activationApiEndpoints.bootstrap, {
        downloadSessionId: input.downloadSessionId,
        accountId: input.accountId,
        installerInstanceId: input.installerInstanceId,
        platform: input.platform,
        appVersion: input.appVersion
      })

      const recommendedPath: ActivationPath = remote.recommendedPath ?? 'use_own_key'
      const allowedPaths: ActivationPath[] = remote.allowedPaths?.length ? remote.allowedPaths : ['use_own_key']
      const entitlement = remote.entitlement?.status ?? 'unknown'
      const phase = allowedPaths.includes('buy_and_connect') || allowedPaths.includes('connect_existing_purchase')
        ? 'ready_for_activation'
        : 'manual_path_only'

      const nextSnapshot: ActivationFlowSnapshot = {
        flowVersion: '2026-04-03',
        backendMode: backendMode(),
        phase,
        recommendedPath,
        allowedPaths,
        offers: defaultOffers(),
        binding: {
          downloadSessionId: input.downloadSessionId,
          installerInstanceId: input.installerInstanceId,
          platform: input.platform,
          appVersion: input.appVersion,
          setupToken: remote.setupToken,
          setupTokenExpiresAt: remote.setupTokenExpiresAt,
          account: remote.account
        },
        purchase: {
          entitlement,
          plan: remote.entitlement?.plan ?? 'clawrouter',
          status: entitlement === 'active' ? 'completed' : 'not_started',
          lastUpdatedAt: nowIso()
        },
        provisioning: { status: 'idle' },
        configInjection: { status: 'idle' },
        validation: { status: 'idle' },
        resale: { status: 'idle' },
        constraints: [
          'Do not expose raw ClawRouter API keys in the installer UI.',
          'Prefer account-bound credential references and local config injection.',
          'Purchase and resale settlement stay outside the installer in this MVP.'
        ],
        nextActionLabel:
          recommendedPath === 'connect_existing_purchase'
            ? 'Connect ClawRouter'
            : recommendedPath === 'buy_and_connect'
              ? 'Activate ClawRouter'
              : 'Use My Own API Key'
      }

      this.snapshot = nextSnapshot
      return cloneSnapshot(nextSnapshot)
    } catch (error) {
      this.snapshot = createBaseSnapshot(input, 'manual-only')
      this.snapshot.errorMessage =
        error instanceof Error ? error.message : 'Failed to resolve installer activation bootstrap.'
      return cloneSnapshot(this.snapshot)
    }
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

  async startPurchase(input: ActivationPurchaseInput): Promise<ActivationFlowSnapshot> {
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
    snapshot.purchase.lastUpdatedAt = nowIso()
    snapshot.nextActionLabel = 'Complete Purchase in Browser'

    if (!useRemoteActivation()) {
      snapshot.purchase.checkoutUrl = 'https://clawlite.ai/checkout/demo-clawrouter'
      return cloneSnapshot(snapshot)
    }

    const setupToken = snapshot.binding.setupToken
    if (!setupToken) {
      snapshot.phase = 'error'
      snapshot.errorMessage = 'Missing setup token for activation purchase.'
      return cloneSnapshot(snapshot)
    }

    try {
      const accountId = snapshot.binding.account?.accountId
      const remote = await postJson<RemotePurchaseResponse>(activationApiEndpoints.purchase, {
        setupToken,
        accountId,
        intent: 'buy_and_connect'
      })
      snapshot.purchase.status = remote.purchaseState ?? 'checkout_pending'
      snapshot.purchase.checkoutUrl = remote.checkoutUrl
      snapshot.purchase.lastUpdatedAt = nowIso()
      return cloneSnapshot(snapshot)
    } catch (error) {
      snapshot.phase = 'error'
      snapshot.purchase.status = 'failed'
      snapshot.errorMessage = error instanceof Error ? error.message : 'Failed to start checkout.'
      return cloneSnapshot(snapshot)
    }
  }

  async confirmPurchase(): Promise<ActivationFlowSnapshot> {
    const snapshot = this.requireSnapshot()

    if (!useRemoteActivation()) {
      snapshot.phase = 'provisioning'
      snapshot.purchase.entitlement = 'active'
      snapshot.purchase.status = 'completed'
      snapshot.purchase.lastUpdatedAt = nowIso()
      snapshot.nextActionLabel = 'Provision ClawRouter'
      snapshot.errorMessage = undefined
      return cloneSnapshot(snapshot)
    }

    const setupToken = snapshot.binding.setupToken
    if (!setupToken) {
      snapshot.phase = 'error'
      snapshot.purchase.status = 'failed'
      snapshot.errorMessage = 'Missing setup token for purchase confirmation.'
      return cloneSnapshot(snapshot)
    }

    try {
      const accountId = snapshot.binding.account?.accountId
      let qs = `setupToken=${encodeURIComponent(setupToken)}`
      if (accountId) qs += `&accountId=${encodeURIComponent(accountId)}`
      const remote = await getJson<RemotePurchaseResponse>(
        `${activationApiEndpoints.purchaseState}?${qs}`
      )
      snapshot.purchase.status = remote.purchaseState ?? snapshot.purchase.status
      snapshot.purchase.lastUpdatedAt = nowIso()

      if (remote.purchaseState === 'completed') {
        snapshot.phase = 'provisioning'
        snapshot.purchase.entitlement = 'active'
        snapshot.nextActionLabel = 'Provision ClawRouter'
        snapshot.errorMessage = undefined
      } else if (remote.purchaseState === 'failed') {
        snapshot.phase = 'error'
        snapshot.errorMessage = 'Checkout failed or entitlement did not activate.'
      } else {
        snapshot.phase = 'purchase_pending'
        snapshot.nextActionLabel = 'Waiting for purchase confirmation'
      }

      return cloneSnapshot(snapshot)
    } catch (error) {
      snapshot.phase = 'error'
      snapshot.purchase.status = 'failed'
      snapshot.errorMessage = error instanceof Error ? error.message : 'Failed to confirm purchase state.'
      return cloneSnapshot(snapshot)
    }
  }

  async provision(input: ActivationProvisionInput): Promise<ActivationFlowSnapshot> {
    const snapshot = this.requireSnapshot()
    if (!useRemoteActivation() && snapshot.purchase.entitlement !== 'active') {
      snapshot.phase = 'error'
      snapshot.errorMessage = 'Cannot provision before purchase entitlement is active.'
      return cloneSnapshot(snapshot)
    }

    if (!useRemoteActivation()) {
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

    const setupToken = snapshot.binding.setupToken
    if (!setupToken) {
      snapshot.phase = 'error'
      snapshot.errorMessage = 'Missing setup token for provisioning.'
      return cloneSnapshot(snapshot)
    }

    try {
      const remote = await postJson<RemoteProvisionResponse>(activationApiEndpoints.provision, {
        setupToken,
        accountId: snapshot.binding.account?.accountId,
        deviceLabel: input.deviceLabel,
        platform: snapshot.binding.platform
      })
      snapshot.purchase.entitlement = 'active'
      snapshot.purchase.status = 'completed'
      snapshot.purchase.lastUpdatedAt = nowIso()
      snapshot.phase = 'config_injection'
      snapshot.provisioning = {
        status: remote.provisioningState === 'failed' ? 'failed' : 'bound',
        bindingId: remote.bindingId,
        credentialRef: remote.credentialRef,
        provider: remote.provider ?? 'clawrouter',
        model: remote.model ?? 'clawrouter/auto',
        configuredAt: nowIso()
      }
      snapshot.nextActionLabel = 'Write OpenClaw Configuration'
      snapshot.errorMessage = undefined
      return cloneSnapshot(snapshot)
    } catch (error) {
      snapshot.phase = 'error'
      snapshot.provisioning.status = 'failed'
      snapshot.errorMessage = error instanceof Error ? error.message : 'Provisioning failed.'
      return cloneSnapshot(snapshot)
    }
  }

  async injectConfig(input: ActivationConfigInjectionInput): Promise<ActivationFlowSnapshot> {
    const snapshot = this.requireSnapshot()
    const credentialRef = snapshot.provisioning.credentialRef
    const model = snapshot.provisioning.model
    const bindingId = snapshot.provisioning.bindingId

    if (!credentialRef || !model || !bindingId) {
      snapshot.phase = 'error'
      snapshot.errorMessage = 'Provisioning is incomplete. No credential reference is available.'
      return cloneSnapshot(snapshot)
    }

    const writeConfigToDisk = (
      targetPath: string,
      patchProvider: string,
      patchCredentialRef: string,
      _patchModel: string
    ): void => {
      const resolved = targetPath.replace(/^~/, homedir())
      const dir = join(resolved, '..')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

      // Auto-backup before modifying
      if (existsSync(resolved)) {
        const backupPath = `${resolved}.pre-activation.bak`
        if (!existsSync(backupPath)) {
          writeFileSync(backupPath, readFileSync(resolved), { mode: 0o600 })
        }
      }

      let ocConfig: Record<string, unknown> = {}
      if (existsSync(resolved)) {
        try {
          ocConfig = JSON.parse(readFileSync(resolved, 'utf-8'))
        } catch {
          /* start fresh if corrupt */
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = ocConfig as any
      if (!cfg.models) cfg.models = { mode: 'merge', providers: {} }
      if (!cfg.models.providers) cfg.models.providers = {}
      cfg.models.providers[patchProvider] = {
        baseUrl: 'https://openrouter.ezsite.ai/api/claude',
        apiKey: patchCredentialRef,
        api: 'anthropic-messages',
        models: [
          {
            id: 'claude-sonnet-4-6',
            name: 'Claude Sonnet 4.6 (ClawRouter)',
            reasoning: false,
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 64000
          }
        ]
      }

      writeFileSync(resolved, JSON.stringify(ocConfig, null, 2), { mode: 0o600 })
    }

    if (!useRemoteActivation()) {
      try {
        writeConfigToDisk(input.targetConfigPath, 'clawrouter', credentialRef, model)
      } catch (error) {
        snapshot.phase = 'error'
        snapshot.configInjection.status = 'failed'
        snapshot.errorMessage = error instanceof Error ? error.message : 'Failed to write config file.'
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

    const setupToken = snapshot.binding.setupToken
    if (!setupToken) {
      snapshot.phase = 'error'
      snapshot.errorMessage = 'Missing setup token for config injection.'
      return cloneSnapshot(snapshot)
    }

    try {
      const remote = await postJson<RemoteConfigResponse>(activationApiEndpoints.injectConfig, {
        setupToken,
        accountId: snapshot.binding.account?.accountId,
        bindingId,
        targetConfigPath: input.targetConfigPath
      })

      const patchPreview = remote.patchPreview ?? { provider: 'clawrouter', credentialRef, model }
      const configTarget = remote.configTarget ?? input.targetConfigPath

      try {
        writeConfigToDisk(configTarget, patchPreview.provider, patchPreview.credentialRef, patchPreview.model)
      } catch (error) {
        snapshot.phase = 'error'
        snapshot.configInjection.status = 'failed'
        snapshot.errorMessage = error instanceof Error ? error.message : 'Failed to write config file.'
        return cloneSnapshot(snapshot)
      }

      snapshot.phase = 'validation'
      snapshot.configInjection = {
        status: remote.configInjectionState === 'failed' ? 'failed' : 'written',
        configTarget,
        patchPreview
      }
      snapshot.nextActionLabel = 'Validate Connection'
      snapshot.errorMessage = undefined
      return cloneSnapshot(snapshot)
    } catch (error) {
      snapshot.phase = 'error'
      snapshot.configInjection.status = 'failed'
      snapshot.errorMessage = error instanceof Error ? error.message : 'Config injection failed.'
      return cloneSnapshot(snapshot)
    }
  }

  async validate(input: ActivationValidationInput): Promise<ActivationFlowSnapshot> {
    const snapshot = this.requireSnapshot()
    if (snapshot.configInjection.status !== 'written') {
      snapshot.phase = 'error'
      snapshot.errorMessage = 'Config must be written before validation can run.'
      return cloneSnapshot(snapshot)
    }

    if (!useRemoteActivation()) {
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

    const setupToken = snapshot.binding.setupToken
    const bindingId = snapshot.provisioning.bindingId
    if (!setupToken || !bindingId) {
      snapshot.phase = 'error'
      snapshot.errorMessage = 'Missing setup token or binding id for validation.'
      return cloneSnapshot(snapshot)
    }

    try {
      const remote = await postJson<RemoteValidationResponse>(activationApiEndpoints.validate, {
        setupToken,
        bindingId,
        expectGatewayReachable: input.expectGatewayReachable
      })
      snapshot.phase = remote.validationState === 'passed' ? 'completed' : 'error'
      snapshot.validation = {
        status: remote.validationState === 'failed' ? 'failed' : 'passed',
        gatewayReachable: remote.gatewayReachable,
        accountConfirmed: remote.accountConfirmed,
        latencyMs: remote.latencyMs
      }
      snapshot.nextActionLabel = remote.validationState === 'passed' ? 'ClawRouter Connected' : 'Retry Validation'
      snapshot.errorMessage =
        remote.validationState === 'failed' ? 'Validation failed after config injection.' : undefined
      return cloneSnapshot(snapshot)
    } catch (error) {
      snapshot.phase = 'error'
      snapshot.validation.status = 'failed'
      snapshot.errorMessage = error instanceof Error ? error.message : 'Validation failed.'
      return cloneSnapshot(snapshot)
    }
  }

  async submitResale(input: ActivationResaleInput): Promise<ActivationFlowSnapshot> {
    const snapshot = this.requireSnapshot()
    snapshot.errorMessage = undefined

    if (!useRemoteActivation()) {
      snapshot.resale = {
        status: 'submitted',
        intakeId: `resale_${Math.random().toString(36).slice(2, 10)}`,
        sellerEmail: input.sellerEmail,
        seats: input.seats,
        note: input.note,
        submittedAt: nowIso(),
        nextStepLabel: 'Manual seller verification pending',
        reviewUrl: 'https://clawlite.ai/resale/demo-review'
      }
      return cloneSnapshot(snapshot)
    }

    const setupToken = snapshot.binding.setupToken
    if (!setupToken) {
      snapshot.resale.status = 'failed'
      snapshot.errorMessage = 'Missing setup token for resale intake.'
      return cloneSnapshot(snapshot)
    }

    try {
      const remote = await postJson<RemoteResaleResponse>(activationApiEndpoints.resaleIntake, {
        setupToken,
        sellerEmail: input.sellerEmail,
        seats: input.seats,
        note: input.note
      })
      snapshot.resale = {
        status: remote.status === 'failed' ? 'failed' : 'submitted',
        intakeId: remote.intakeId,
        sellerEmail: input.sellerEmail,
        seats: input.seats,
        note: input.note,
        submittedAt: nowIso(),
        nextStepLabel: remote.status === 'failed' ? undefined : 'Manual seller verification pending',
        reviewUrl: remote.reviewUrl
      }
      if (remote.status === 'failed') {
        snapshot.errorMessage = 'Resale intake failed.'
      }
      return cloneSnapshot(snapshot)
    } catch (error) {
      snapshot.resale.status = 'failed'
      snapshot.errorMessage = error instanceof Error ? error.message : 'Resale intake failed.'
      return cloneSnapshot(snapshot)
    }
  }

  injectManualKey(input: {
    provider: 'clawrouter' | 'ezrouter'
    apiKey: string
    targetConfigPath: string
  }): { success: boolean; message: string } {
    const resolved = input.targetConfigPath.replace(/^~/, homedir())
    const dir = join(resolved, '..')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    if (existsSync(resolved)) {
      const backupPath = `${resolved}.pre-activation.bak`
      if (!existsSync(backupPath)) {
        writeFileSync(backupPath, readFileSync(resolved), { mode: 0o600 })
      }
    }

    let ocConfig: Record<string, unknown> = {}
    if (existsSync(resolved)) {
      try {
        ocConfig = JSON.parse(readFileSync(resolved, 'utf-8'))
      } catch {
        /* start fresh */
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = ocConfig as any
    if (!cfg.models) cfg.models = { mode: 'merge', providers: {} }
    if (!cfg.models.providers) cfg.models.providers = {}
    cfg.models.providers[input.provider] = {
      baseUrl: 'https://openrouter.ezsite.ai/api/claude',
      apiKey: input.apiKey,
      api: 'anthropic-messages',
      models: [
        {
          id: 'claude-sonnet-4-6',
          name: `Claude Sonnet 4.6 (${input.provider})`,
          reasoning: false,
          input: ['text'],
          contextWindow: 200000,
          maxTokens: 64000
        }
      ]
    }

    writeFileSync(resolved, JSON.stringify(ocConfig, null, 2), { mode: 0o600 })
    return { success: true, message: `Wrote ${input.provider} key to ${resolved}` }
  }

  restoreConfig(targetConfigPath: string): { restored: boolean; message: string } {
    const resolved = targetConfigPath.replace(/^~/, homedir())
    const backupPath = `${resolved}.pre-activation.bak`

    if (!existsSync(backupPath)) {
      return { restored: false, message: 'No backup found.' }
    }

    writeFileSync(resolved, readFileSync(backupPath), { mode: 0o600 })
    return { restored: true, message: `Restored from ${backupPath}` }
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
