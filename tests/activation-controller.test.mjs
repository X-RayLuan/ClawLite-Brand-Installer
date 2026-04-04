import test from 'node:test'
import assert from 'node:assert/strict'

test('activation controller connects an already purchased account without exposing a raw key', async () => {
  const { ActivationController } =
    await import('../tmp/activation-node-test/main/services/activation-controller.js')
  process.env.CLAWLITE_ACTIVATION_SCENARIO = 'already-purchased'

  const controller = new ActivationController()
  const bootstrap = controller.bootstrap({
    installerInstanceId: 'test-installer',
    platform: 'macos',
    appVersion: '1.3.88'
  })

  assert.equal(bootstrap.phase, 'ready_for_activation')
  assert.equal(bootstrap.recommendedPath, 'connect_existing_purchase')
  assert.equal(bootstrap.purchase.entitlement, 'active')

  let next = controller.startPurchase({ path: 'connect_existing_purchase' })
  assert.equal(next.phase, 'provisioning')

  next = controller.provision({ deviceLabel: 'Ray Mac' })
  assert.equal(next.phase, 'config_injection')
  assert.match(next.provisioning.credentialRef, /^credref:/)

  next = controller.injectConfig({ targetConfigPath: '~/.openclaw/openclaw.json' })
  assert.equal(next.phase, 'validation')
  assert.equal(next.configInjection.patchPreview.provider, 'clawrouter')

  next = controller.validate({ expectGatewayReachable: true })
  assert.equal(next.phase, 'completed')
  assert.equal(next.validation.status, 'passed')
})

test('activation controller supports buy then connect and fallback to own key', async () => {
  const { ActivationController } =
    await import('../tmp/activation-node-test/main/services/activation-controller.js')
  process.env.CLAWLITE_ACTIVATION_SCENARIO = 'not-purchased'

  const controller = new ActivationController()
  const bootstrap = controller.bootstrap({
    installerInstanceId: 'test-installer',
    platform: 'windows',
    appVersion: '1.3.88'
  })

  assert.equal(bootstrap.recommendedPath, 'buy_and_connect')
  assert.equal(bootstrap.purchase.entitlement, 'inactive')

  let next = controller.startPurchase({ path: 'buy_and_connect' })
  assert.equal(next.phase, 'purchase_pending')
  assert.equal(next.purchase.status, 'checkout_pending')

  next = controller.confirmPurchase()
  assert.equal(next.purchase.entitlement, 'active')

  next = controller.useOwnKey()
  assert.equal(next.phase, 'skipped_to_byok')
  assert.equal(next.selectedPath, 'use_own_key')
})
