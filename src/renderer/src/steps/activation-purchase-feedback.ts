import type { ActivationFlowSnapshot } from '@shared/activation/types'

export const getConfirmPurchaseErrorMessage = (
  snapshot: ActivationFlowSnapshot
): string | null => {
  if (snapshot.phase === 'purchase_pending') {
    return null
  }

  if (snapshot.phase === 'error') {
    return snapshot.errorMessage || 'Checkout failed or entitlement did not activate.'
  }

  return snapshot.errorMessage || 'Activation could not continue after payment'
}
