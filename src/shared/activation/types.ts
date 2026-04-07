export type ActivationPlatform = 'macos' | 'windows' | 'linux' | 'unknown'

export type ActivationPath = 'connect_existing_purchase' | 'buy_and_connect' | 'use_own_key'

export type ActivationBackendMode = 'mock' | 'remote'

export type ActivationPhase =
  | 'session_binding_pending'
  | 'ready_for_activation'
  | 'purchase_pending'
  | 'provisioning'
  | 'config_injection'
  | 'validation'
  | 'completed'
  | 'skipped_to_byok'
  | 'manual_path_only'
  | 'error'

export type EntitlementStatus = 'active' | 'inactive' | 'unknown'
export type PurchaseStatus = 'not_started' | 'checkout_pending' | 'completed' | 'failed'
export type ProvisioningStatus = 'idle' | 'binding' | 'bound' | 'failed'
export type ConfigInjectionStatus = 'idle' | 'writing' | 'written' | 'failed'
export type ValidationStatus = 'idle' | 'testing' | 'passed' | 'failed'
export type ResaleStatus = 'idle' | 'submitted' | 'failed'

export interface ActivationAccount {
  accountId: string
  emailMasked: string
}

export interface ActivationOffer {
  id: string
  title: string
  summary: string
  priceLabel: string
  settlementLabel: string
  deliveryEstimate: string
  tag: 'official' | 'resale'
}

export interface InstallerSessionBinding {
  downloadSessionId?: string
  installerInstanceId: string
  setupToken?: string
  setupTokenExpiresAt?: string
  account?: ActivationAccount
  platform: ActivationPlatform
  appVersion: string
}

export interface PurchaseState {
  entitlement: EntitlementStatus
  plan: 'clawrouter'
  status: PurchaseStatus
  checkoutUrl?: string
  lastUpdatedAt: string
}

export interface ProvisioningState {
  status: ProvisioningStatus
  bindingId?: string
  credentialRef?: string
  provider?: 'clawrouter'
  model?: string
  configuredAt?: string
}

export interface ConfigInjectionState {
  status: ConfigInjectionStatus
  configTarget?: string
  patchPreview?: {
    provider: 'clawrouter'
    credentialRef: string
    model: string
  }
}

export interface ValidationState {
  status: ValidationStatus
  gatewayReachable?: boolean
  accountConfirmed?: boolean
  latencyMs?: number
}

export interface ResaleState {
  status: ResaleStatus
  intakeId?: string
  sellerEmail?: string
  seats?: number
  note?: string
  submittedAt?: string
  nextStepLabel?: string
  reviewUrl?: string
}

export interface ActivationFlowSnapshot {
  flowVersion: '2026-04-03'
  backendMode: ActivationBackendMode
  phase: ActivationPhase
  selectedPath?: ActivationPath
  recommendedPath: ActivationPath
  allowedPaths: ActivationPath[]
  offers: ActivationOffer[]
  binding: InstallerSessionBinding
  purchase: PurchaseState
  provisioning: ProvisioningState
  configInjection: ConfigInjectionState
  validation: ValidationState
  resale: ResaleState
  constraints: string[]
  nextActionLabel: string
  errorMessage?: string
}

export interface ActivationBootstrapInput {
  downloadSessionId?: string
  accountId?: string
  installerInstanceId: string
  platform: ActivationPlatform
  appVersion: string
}

export interface ActivationPurchaseInput {
  path: Extract<ActivationPath, 'connect_existing_purchase' | 'buy_and_connect'>
}

export interface ActivationProvisionInput {
  deviceLabel: string
}

export interface ActivationConfigInjectionInput {
  targetConfigPath: string
}

export interface ActivationValidationInput {
  expectGatewayReachable?: boolean
}

export interface ActivationResaleInput {
  sellerEmail: string
  seats: number
  note?: string
}
