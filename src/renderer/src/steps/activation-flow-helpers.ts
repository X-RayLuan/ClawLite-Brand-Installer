import type { ActivationFlowSnapshot } from '@shared/activation/types'

export function shouldAutoResumeProvisioning(
  snapshot: ActivationFlowSnapshot | null | undefined
): boolean {
  if (!snapshot) return false

  return (
    snapshot.phase === 'ready_for_activation' &&
    snapshot.purchase.entitlement === 'active' &&
    snapshot.recommendedPath === 'connect_existing_purchase' &&
    snapshot.allowedPaths.includes('connect_existing_purchase')
  )
}
