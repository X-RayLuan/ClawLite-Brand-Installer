import test from 'node:test'
import assert from 'node:assert/strict'

import { ActivationController } from '../src/main/services/activation-controller.ts'

test('activation controller connects an already purchased account without exposing a raw key', async () => {
  process.env.CLAWLITE_ACTIVATION_SCENARIO = 'already-purchased'
  delete process.env.CLAWLITE_ACTIVATION_API_BASE

  const controller = new ActivationController()
  const bootstrap = await controller.bootstrap({
    installerInstanceId: 'test-installer',
    platform: 'macos',
    appVersion: '1.3.88'
  })

  assert.equal(bootstrap.backendMode, 'mock')
  assert.equal(bootstrap.phase, 'ready_for_activation')
  assert.equal(bootstrap.recommendedPath, 'connect_existing_purchase')
  assert.equal(bootstrap.purchase.entitlement, 'active')

  let next = await controller.startPurchase({ path: 'connect_existing_purchase' })
  assert.equal(next.phase, 'provisioning')

  next = await controller.provision({ deviceLabel: 'Ray Mac' })
  assert.equal(next.phase, 'config_injection')
  assert.match(next.provisioning.credentialRef ?? '', /^credref:/)

  next = await controller.injectConfig({ targetConfigPath: '~/.openclaw/openclaw.json' })
  assert.equal(next.phase, 'validation')
  assert.equal(next.configInjection.patchPreview?.provider, 'clawrouter')

  next = await controller.validate({ expectGatewayReachable: true })
  assert.equal(next.phase, 'completed')
  assert.equal(next.validation.status, 'passed')
})

test('activation controller stages buy flow and captures resale intake for the MVP', async () => {
  process.env.CLAWLITE_ACTIVATION_SCENARIO = 'not-purchased'
  delete process.env.CLAWLITE_ACTIVATION_API_BASE

  const controller = new ActivationController()
  const bootstrap = await controller.bootstrap({
    installerInstanceId: 'test-installer',
    platform: 'windows',
    appVersion: '1.3.88'
  })

  assert.equal(bootstrap.recommendedPath, 'buy_and_connect')
  assert.equal(bootstrap.purchase.entitlement, 'inactive')
  assert.equal(bootstrap.offers.length, 2)

  let next = await controller.startPurchase({ path: 'buy_and_connect' })
  assert.equal(next.phase, 'purchase_pending')
  assert.equal(next.purchase.status, 'checkout_pending')
  assert.match(next.purchase.checkoutUrl ?? '', /^https:\/\/clawlite\.ai\/checkout\//)

  next = await controller.confirmPurchase()
  assert.equal(next.purchase.entitlement, 'active')
  assert.equal(next.phase, 'provisioning')

  next = await controller.submitResale({
    sellerEmail: 'seller@example.com',
    seats: 2,
    note: 'Two seats available after offboarding.'
  })
  assert.equal(next.resale.status, 'submitted')
  assert.equal(next.resale.sellerEmail, 'seller@example.com')
  assert.equal(next.resale.seats, 2)
  assert.match(next.resale.intakeId ?? '', /^resale_/)

  next = controller.useOwnKey()
  assert.equal(next.phase, 'skipped_to_byok')
  assert.equal(next.selectedPath, 'use_own_key')
})

test('activation controller falls back to mock state when remote bootstrap is unreachable', async () => {
  process.env.CLAWLITE_ACTIVATION_SCENARIO = 'not-purchased'
  process.env.CLAWLITE_ACTIVATION_API_BASE = 'http://127.0.0.1:1'

  const controller = new ActivationController()
  const bootstrap = await controller.bootstrap({
    installerInstanceId: 'remote-fallback-installer',
    platform: 'linux',
    appVersion: '1.3.88'
  })

  assert.equal(bootstrap.phase, 'manual_path_only')
  assert.equal(bootstrap.backendMode, 'remote')
  assert.equal(bootstrap.recommendedPath, 'use_own_key')
  assert.equal(bootstrap.purchase.entitlement, 'unknown')
  assert.equal(Boolean(bootstrap.errorMessage), true)

  delete process.env.CLAWLITE_ACTIVATION_API_BASE
})

test('remote provision can continue after payment even if purchase-state is still pending', async () => {
  process.env.CLAWLITE_ACTIVATION_API_BASE = 'https://clawlite.ai'
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (url.endsWith('/api/installer/activation/bootstrap')) {
      return new Response(
        JSON.stringify({
          setupToken: 'stp_live_payment_sync',
          account: {
            accountId: 'acct_payment_sync',
            emailMasked: 'ai***@gmail.com'
          },
          entitlement: { status: 'inactive', plan: 'clawrouter' },
          allowedPaths: ['buy_and_connect', 'use_own_key'],
          recommendedPath: 'buy_and_connect'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    if (url.endsWith('/api/installer/activation/purchase')) {
      return new Response(
        JSON.stringify({
          purchaseState: 'checkout_pending',
          checkoutUrl: 'https://clawlite.ai/checkout/demo-clawrouter'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    if (url.includes('/api/installer/activation/purchase-state?')) {
      return new Response(
        JSON.stringify({
          purchaseState: 'checkout_pending'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    if (url.endsWith('/api/installer/activation/provision')) {
      assert.equal(init?.method, 'POST')
      return new Response(
        JSON.stringify({
          provisioningState: 'bound',
          bindingId: 'clawrouter-account:acct_payment_sync',
          credentialRef: 'or_live_inventory_key',
          provider: 'clawrouter',
          model: 'clawrouter/auto'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  try {
    const controller = new ActivationController()
    let next = await controller.bootstrap({
      installerInstanceId: 'test-installer',
      platform: 'macos',
      appVersion: '1.3.96',
      accountId: 'acct_payment_sync'
    })

    assert.equal(next.backendMode, 'remote')
    assert.equal(next.phase, 'ready_for_activation')

    next = await controller.startPurchase({ path: 'buy_and_connect' })
    assert.equal(next.phase, 'purchase_pending')
    assert.equal(next.purchase.status, 'checkout_pending')

    next = await controller.confirmPurchase()
    assert.equal(next.phase, 'purchase_pending')

    next = await controller.provision({ deviceLabel: 'ClawLite Installer' })
    assert.equal(next.phase, 'config_injection')
    assert.equal(next.purchase.entitlement, 'active')
    assert.equal(next.purchase.status, 'completed')
    assert.equal(next.provisioning.credentialRef, 'or_live_inventory_key')
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.CLAWLITE_ACTIVATION_API_BASE
  }
})
