import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  ActivationController,
  activationControllerIo
} from '../src/main/services/activation-controller.ts'

test('activation controller connects an already purchased account without exposing a raw key', async () => {
  const prevBase = process.env.CLAWLITE_ACTIVATION_API_BASE
  process.env.CLAWLITE_ACTIVATION_API_BASE = 'https://clawlite.ai'
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (url.endsWith('/api/installer/activation/bootstrap')) {
      return new Response(
        JSON.stringify({
          setupToken: 'stp_active_account',
          account: {
            accountId: 'acct_active_clawrouter',
            emailMasked: 'ra***@clawlite.ai'
          },
          entitlement: { status: 'active', plan: 'clawrouter' },
          allowedPaths: ['connect_existing_purchase', 'buy_and_connect', 'use_own_key'],
          recommendedPath: 'connect_existing_purchase'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    if (url.endsWith('/api/installer/activation/provision')) {
      assert.equal(init?.method, 'POST')
      return new Response(
        JSON.stringify({
          provisioningState: 'bound',
          bindingId: 'bind_live_clawrouter',
          credentialRef: 'credref:ray-mac',
          provider: 'clawrouter',
          model: 'clawrouter/auto'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    if (url.endsWith('/api/installer/activation/inject-config')) {
      return new Response(
        JSON.stringify({
          configInjectionState: 'written',
          configTarget: '~/.openclaw/openclaw.json',
          patchPreview: {
            provider: 'clawrouter',
            credentialRef: 'credref:ray-mac',
            model: 'clawrouter/auto'
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    if (url.endsWith('/api/installer/activation/validate')) {
      return new Response(
        JSON.stringify({
          validationState: 'passed',
          gatewayReachable: true,
          accountConfirmed: true,
          latencyMs: 120
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  try {
    const controller = new ActivationController()
    const bootstrap = await controller.bootstrap({
      installerInstanceId: 'test-installer',
      platform: 'macos',
      appVersion: '1.3.88'
    })

    assert.equal(bootstrap.backendMode, 'remote')
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
  } finally {
    globalThis.fetch = originalFetch
    process.env.CLAWLITE_ACTIVATION_API_BASE = prevBase
  }
})

test('activation controller stages buy flow and captures resale intake for the MVP', async () => {
  const prevBase = process.env.CLAWLITE_ACTIVATION_API_BASE
  process.env.CLAWLITE_ACTIVATION_API_BASE = 'https://clawlite.ai'
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (url.endsWith('/api/installer/activation/bootstrap')) {
      return new Response(
        JSON.stringify({
          setupToken: 'stp_buy_flow',
          account: {
            accountId: 'acct_buy_flow',
            emailMasked: 'ra***@clawlite.ai'
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
          purchaseState: 'completed'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    if (url.endsWith('/api/installer/activation/resale-intake')) {
      assert.equal(init?.method, 'POST')
      return new Response(
        JSON.stringify({
          status: 'submitted',
          intakeId: 'resale_test_case',
          reviewUrl: 'https://clawlite.ai/resale/review'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  try {
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
  } finally {
    globalThis.fetch = originalFetch
    process.env.CLAWLITE_ACTIVATION_API_BASE = prevBase
  }
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

test('remote provision is blocked until purchase-state becomes completed', async () => {
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
    assert.equal(next.phase, 'error')
    assert.equal(next.errorMessage, 'Cannot provision before purchase entitlement is active.')
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.CLAWLITE_ACTIVATION_API_BASE
  }
})

test('injectConfig switches the default route and main agent to clawrouter without touching other agents', async () => {
  const prevBase = process.env.CLAWLITE_ACTIVATION_API_BASE
  process.env.CLAWLITE_ACTIVATION_API_BASE = 'https://clawlite.ai'
  const originalFetch = globalThis.fetch

  const tempDir = mkdtempSync(join(tmpdir(), 'clawlite-activation-config-'))
  const configPath = join(tempDir, 'openclaw.json')
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        models: {
          mode: 'merge',
          providers: {
            ezrouter: {
              baseUrl: 'https://openrouter.ezsite.ai/api/claude',
              apiKey: 'or_existing',
              api: 'anthropic-messages',
              models: [{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' }]
            }
          }
        },
        agents: {
          defaults: {
            model: {
              primary: 'openai-codex/gpt-5.4',
              fallbacks: ['ezrouter/claude-sonnet-4-6']
            }
          },
          list: [
            {
              id: 'main',
              model: {
                primary: 'openai-codex/gpt-5.4',
                fallbacks: ['ezrouter/claude-sonnet-4-6']
              }
            },
            {
              id: 'woody',
              model: {
                primary: 'openai-codex/gpt-5.4',
                fallbacks: ['minimax/MiniMax-M2.5']
              }
            }
          ]
        }
      },
      null,
      2
    )
  )

  try {
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/installer/activation/bootstrap')) {
        return new Response(
          JSON.stringify({
            setupToken: 'stp_config_switch',
            account: {
              accountId: 'acct_config_switch',
              emailMasked: 'ai***@gmail.com'
            },
            entitlement: { status: 'active', plan: 'clawrouter' },
            allowedPaths: ['connect_existing_purchase', 'buy_and_connect', 'use_own_key'],
            recommendedPath: 'connect_existing_purchase'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }

      if (url.endsWith('/api/installer/activation/provision')) {
        assert.equal(init?.method, 'POST')
        return new Response(
          JSON.stringify({
            provisioningState: 'bound',
            bindingId: 'clawrouter-account:acct_config_switch',
            credentialRef: 'or_config_switch_key',
            provider: 'clawrouter',
            model: 'clawrouter/claude-sonnet-4-6'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }

      if (url.endsWith('/api/installer/activation/inject-config')) {
        return new Response(
          JSON.stringify({
            configInjectionState: 'written',
            configTarget: configPath,
            patchPreview: {
              provider: 'clawrouter',
              credentialRef: 'or_config_switch_key',
              model: 'clawrouter/claude-sonnet-4-6'
            }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    }

    const controller = new ActivationController()
    await controller.bootstrap({
      installerInstanceId: 'config-switch-installer',
      platform: 'macos',
      appVersion: '1.3.97'
    })

    let next = await controller.startPurchase({ path: 'connect_existing_purchase' })
    assert.equal(next.phase, 'provisioning')

    next = await controller.provision({ deviceLabel: 'Config Switch Test' })
    assert.equal(next.phase, 'config_injection')

    next = await controller.injectConfig({ targetConfigPath: configPath })
    assert.equal(next.phase, 'validation')

    const written = JSON.parse(readFileSync(configPath, 'utf8'))
    assert.equal(written.models.providers.clawrouter.apiKey, 'or_config_switch_key')
    assert.equal(written.agents.defaults.model.primary, 'clawrouter/claude-sonnet-4-6')
    assert.deepEqual(written.agents.defaults.model.fallbacks, ['ezrouter/claude-sonnet-4-6'])
    assert.equal(written.agents.list[0].model.primary, 'clawrouter/claude-sonnet-4-6')
    assert.deepEqual(written.agents.list[0].model.fallbacks, ['ezrouter/claude-sonnet-4-6'])
    assert.equal(written.agents.list[1].model.primary, 'openai-codex/gpt-5.4')
    assert.deepEqual(written.agents.list[1].model.fallbacks, ['minimax/MiniMax-M2.5'])
    assert.equal(written.gateway.mode, 'local')
    assert.equal(written.gateway.bind, 'custom')
    assert.equal(written.gateway.customBindHost, '127.0.0.1')
    assert.equal(written.gateway.auth.mode, 'token')
    assert.match(written.gateway.auth.token, /^[a-f0-9]{48}$/)
    assert.equal(written.gateway.remote.url, 'ws://127.0.0.1:18789')
    assert.equal(written.gateway.remote.token, written.gateway.auth.token)
  } finally {
    globalThis.fetch = originalFetch
    process.env.CLAWLITE_ACTIVATION_API_BASE = prevBase
  }
})

test('injectConfig writes clawrouter config into WSL on Windows targets', async () => {
  const prevBase = process.env.CLAWLITE_ACTIVATION_API_BASE
  process.env.CLAWLITE_ACTIVATION_API_BASE = 'https://clawlite.ai'
  const originalFetch = globalThis.fetch

  let writtenPath = ''
  let writtenConfig = ''

  mock.method(activationControllerIo, 'platform', () => 'win32')
  mock.method(activationControllerIo, 'readWslFile', async (path: string) => {
    assert.equal(path, '/root/.openclaw/openclaw.json')
    return JSON.stringify(
      {
        models: {
          mode: 'merge',
          providers: {
            minimax: {
              baseUrl: 'https://api.minimax.io/anthropic',
              apiKey: 'sk_minimax_existing',
              api: 'anthropic-messages',
              models: [{ id: 'MiniMax-M2.5', name: 'MiniMax M2.5' }]
            }
          }
        },
        agents: {
          defaults: {
            model: {
              primary: 'minimax/MiniMax-M2.5',
              fallbacks: ['minimax/MiniMax-M2.5']
            }
          },
          list: [
            {
              id: 'main',
              model: {
                primary: 'minimax/MiniMax-M2.5',
                fallbacks: ['minimax/MiniMax-M2.5']
              }
            },
            {
              id: 'woody',
              model: {
                primary: 'openai-codex/gpt-5.4',
                fallbacks: ['minimax/MiniMax-M2.5']
              }
            }
          ]
        }
      },
      null,
      2
    )
  })
  mock.method(activationControllerIo, 'writeWslFile', async (path: string, content: string) => {
    writtenPath = path
    writtenConfig = content
  })

  try {
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/installer/activation/bootstrap')) {
        return new Response(
          JSON.stringify({
            setupToken: 'stp_wsl_config_switch',
            account: {
              accountId: 'acct_wsl_config_switch',
              emailMasked: 'ai***@gmail.com'
            },
            entitlement: { status: 'active', plan: 'clawrouter' },
            allowedPaths: ['connect_existing_purchase', 'buy_and_connect', 'use_own_key'],
            recommendedPath: 'connect_existing_purchase'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }

      if (url.endsWith('/api/installer/activation/provision')) {
        assert.equal(init?.method, 'POST')
        return new Response(
          JSON.stringify({
            provisioningState: 'bound',
            bindingId: 'clawrouter-account:acct_wsl_config_switch',
            credentialRef: 'credref:wsl-clawrouter',
            provider: 'clawrouter',
            model: 'clawrouter/claude-sonnet-4-6'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }

      if (url.endsWith('/api/installer/activation/inject-config')) {
        return new Response(
          JSON.stringify({
            configInjectionState: 'written',
            configTarget: '/root/.openclaw/openclaw.json',
            patchPreview: {
              provider: 'clawrouter',
              credentialRef: 'credref:wsl-clawrouter',
              model: 'clawrouter/claude-sonnet-4-6'
            }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }

      throw new Error(`Unexpected fetch URL: ${url}`)
    }

    const controller = new ActivationController()
    await controller.bootstrap({
      installerInstanceId: 'wsl-config-switch-installer',
      platform: 'windows',
      appVersion: '1.3.118'
    })

    let next = await controller.startPurchase({ path: 'connect_existing_purchase' })
    assert.equal(next.phase, 'provisioning')

    next = await controller.provision({ deviceLabel: 'Windows WSL Config Test' })
    assert.equal(next.phase, 'config_injection')

    next = await controller.injectConfig({ targetConfigPath: '/root/.openclaw/openclaw.json' })
    assert.equal(next.phase, 'validation')

    assert.equal(writtenPath, '/root/.openclaw/openclaw.json')
    const written = JSON.parse(writtenConfig)
    assert.equal(written.models.providers.clawrouter.apiKey, 'credref:wsl-clawrouter')
    assert.equal(written.agents.defaults.model.primary, 'clawrouter/claude-sonnet-4-6')
    assert.deepEqual(written.agents.defaults.model.fallbacks, ['minimax/MiniMax-M2.5'])
    assert.equal(written.agents.list[0].model.primary, 'clawrouter/claude-sonnet-4-6')
    assert.deepEqual(written.agents.list[0].model.fallbacks, ['minimax/MiniMax-M2.5'])
    assert.equal(written.agents.list[1].model.primary, 'openai-codex/gpt-5.4')
    assert.deepEqual(written.agents.list[1].model.fallbacks, ['minimax/MiniMax-M2.5'])
  } finally {
    globalThis.fetch = originalFetch
    process.env.CLAWLITE_ACTIVATION_API_BASE = prevBase
    mock.restoreAll()
  }
})
