import test from 'node:test'
import assert from 'node:assert/strict'

import { getConfirmPurchaseErrorMessage } from '../src/renderer/src/steps/activation-purchase-feedback.ts'
import type { ActivationFlowSnapshot } from '../src/shared/activation/types.ts'

const baseSnapshot = (): ActivationFlowSnapshot => ({
  phase: 'ready_for_activation',
  backendMode: 'remote',
  installer: {
    installerInstanceId: 'test-installer',
    appVersion: '1.3.115',
    platform: 'windows'
  },
  binding: {
    setupToken: 'setup_test',
    targetConfigPath: '/root/.openclaw/openclaw.json'
  },
  purchase: {
    entitlement: 'inactive',
    status: 'idle'
  },
  provisioning: { status: 'idle' },
  configInjection: { status: 'idle' },
  validation: { status: 'idle' },
  resale: { status: 'idle' },
  constraints: [],
  nextActionLabel: 'Activate ClawRouter'
})

test('does not surface an error while purchase confirmation is still syncing', () => {
  const snapshot = baseSnapshot()
  snapshot.phase = 'purchase_pending'
  snapshot.purchase.status = 'checkout_pending'

  assert.equal(getConfirmPurchaseErrorMessage(snapshot), null)
})

test('surfaces backend error message for error phase', () => {
  const snapshot = baseSnapshot()
  snapshot.phase = 'error'
  snapshot.errorMessage = 'Checkout failed or entitlement did not activate.'

  assert.equal(
    getConfirmPurchaseErrorMessage(snapshot),
    'Checkout failed or entitlement did not activate.'
  )
})

test('falls back to generic activation error when flow stalls outside expected phases', () => {
  const snapshot = baseSnapshot()
  snapshot.phase = 'ready_for_activation'

  assert.equal(
    getConfirmPurchaseErrorMessage(snapshot),
    'Activation could not continue after payment'
  )
})
