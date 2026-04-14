import test from 'node:test'
import assert from 'node:assert/strict'

import type {
  ActivationBootstrapInput,
  ActivationConfigInjectionInput,
  ActivationFlowSnapshot,
  ActivationProvisionInput,
  ActivationPurchaseInput,
  ActivationValidationInput
} from '../src/shared/activation/types.ts'
import {
  continueManagedActivation,
  getManagedActivationConfigTarget
} from '../src/renderer/src/steps/activation-managed-flow.ts'

const createSnapshot = (): ActivationFlowSnapshot => ({
  flowVersion: '2026-04-03',
  backendMode: 'remote',
  phase: 'ready_for_activation',
  recommendedPath: 'connect_existing_purchase',
  allowedPaths: ['connect_existing_purchase', 'use_own_key'],
  offers: [],
  binding: {
    installerInstanceId: 'clawlite-installer',
    platform: 'windows',
    appVersion: '1.3.89'
  },
  purchase: {
    entitlement: 'active',
    plan: 'clawrouter',
    status: 'completed',
    lastUpdatedAt: '2026-04-14T00:00:00.000Z'
  },
  provisioning: { status: 'idle' },
  configInjection: { status: 'idle' },
  validation: { status: 'idle' },
  resale: { status: 'idle' },
  constraints: [],
  nextActionLabel: 'Connect ClawRouter'
})

test('continueManagedActivation provisions and validates the managed ClawRouter flow', async () => {
  const calls: string[] = []
  const provisioningSnapshot: ActivationFlowSnapshot = {
    ...createSnapshot(),
    phase: 'provisioning'
  }
  const configSnapshot: ActivationFlowSnapshot = {
    ...createSnapshot(),
    phase: 'config_injection',
    provisioning: {
      status: 'bound',
      bindingId: 'binding_123',
      credentialRef: 'cred_ref_123',
      provider: 'clawrouter',
      model: 'clawrouter/auto'
    }
  }
  const validationSnapshot: ActivationFlowSnapshot = {
    ...configSnapshot,
    phase: 'validation',
    configInjection: {
      status: 'written',
      configTarget: '/root/.openclaw/openclaw.json',
      patchPreview: {
        provider: 'clawrouter',
        credentialRef: 'cred_ref_123',
        model: 'clawrouter/auto'
      }
    }
  }
  const completedSnapshot: ActivationFlowSnapshot = {
    ...validationSnapshot,
    phase: 'completed',
    validation: {
      status: 'passed',
      gatewayReachable: true,
      accountConfirmed: true,
      latencyMs: 250
    }
  }

  const result = await continueManagedActivation({
    accountId: 'user@example.com',
    appVersion: '1.3.89',
    platform: 'windows',
    api: {
      bootstrap: async (_input: ActivationBootstrapInput) => {
        calls.push('bootstrap')
        return createSnapshot()
      },
      startPurchase: async (_input: ActivationPurchaseInput) => {
        calls.push('startPurchase')
        return provisioningSnapshot
      },
      provision: async (_input: ActivationProvisionInput) => {
        calls.push('provision')
        return configSnapshot
      },
      injectConfig: async (input: ActivationConfigInjectionInput) => {
        calls.push(`injectConfig:${input.targetConfigPath}`)
        return validationSnapshot
      },
      validate: async (_input: ActivationValidationInput) => {
        calls.push('validate')
        return completedSnapshot
      }
    }
  })

  assert.equal(result.ok, true)
  assert.deepEqual(calls, [
    'bootstrap',
    'startPurchase',
    'provision',
    'injectConfig:/root/.openclaw/openclaw.json',
    'validate'
  ])
})

test('continueManagedActivation refuses to complete when no managed entitlement can be connected', async () => {
  const bootstrapSnapshot: ActivationFlowSnapshot = {
    ...createSnapshot(),
    recommendedPath: 'use_own_key',
    allowedPaths: ['use_own_key'],
    purchase: {
      entitlement: 'inactive',
      plan: 'clawrouter',
      status: 'not_started',
      lastUpdatedAt: '2026-04-14T00:00:00.000Z'
    }
  }

  const result = await continueManagedActivation({
    accountId: 'user@example.com',
    appVersion: '1.3.89',
    platform: 'windows',
    api: {
      bootstrap: async (_input: ActivationBootstrapInput) => bootstrapSnapshot,
      startPurchase: async (_input: ActivationPurchaseInput) => {
        throw new Error('should not be called')
      },
      provision: async (_input: ActivationProvisionInput) => {
        throw new Error('should not be called')
      },
      injectConfig: async (_input: ActivationConfigInjectionInput) => {
        throw new Error('should not be called')
      },
      validate: async (_input: ActivationValidationInput) => {
        throw new Error('should not be called')
      }
    }
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /clawrouter account is not ready|use my own api key/i)
})

test('getManagedActivationConfigTarget uses the WSL config path on windows', () => {
  assert.equal(getManagedActivationConfigTarget('windows'), '/root/.openclaw/openclaw.json')
  assert.equal(getManagedActivationConfigTarget('macos'), '~/.openclaw/openclaw.json')
})
