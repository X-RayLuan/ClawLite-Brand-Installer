import test from 'node:test'
import assert from 'node:assert/strict'

import type { ActivationFlowSnapshot } from '../src/shared/activation/types.ts'
import { shouldAutoResumeProvisioning } from '../src/renderer/src/steps/activation-flow-helpers.ts'

const baseSnapshot = (): ActivationFlowSnapshot => ({
  flowVersion: '2026-04-03',
  backendMode: 'remote',
  phase: 'ready_for_activation',
  recommendedPath: 'buy_and_connect',
  allowedPaths: ['buy_and_connect', 'use_own_key'],
  offers: [],
  binding: {
    installerInstanceId: 'installer-test',
    platform: 'macos',
    appVersion: '1.0.0'
  },
  purchase: {
    entitlement: 'inactive',
    plan: 'clawrouter',
    status: 'not_started',
    lastUpdatedAt: new Date().toISOString()
  },
  provisioning: { status: 'idle' },
  configInjection: { status: 'idle' },
  validation: { status: 'idle' },
  resale: { status: 'idle' },
  constraints: [],
  nextActionLabel: 'Activate ClawRouter'
})

test('auto-resume triggers when bootstrap returns an active ClawRouter purchase', () => {
  const snapshot = baseSnapshot()
  snapshot.recommendedPath = 'connect_existing_purchase'
  snapshot.allowedPaths = ['connect_existing_purchase', 'buy_and_connect', 'use_own_key']
  snapshot.purchase.entitlement = 'active'
  snapshot.purchase.status = 'completed'

  assert.equal(shouldAutoResumeProvisioning(snapshot), true)
})

test('auto-resume stays off while checkout is still pending', () => {
  const snapshot = baseSnapshot()
  snapshot.phase = 'purchase_pending'
  snapshot.purchase.status = 'checkout_pending'

  assert.equal(shouldAutoResumeProvisioning(snapshot), false)
})
