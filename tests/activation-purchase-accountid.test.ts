import test from 'node:test'
import assert from 'node:assert/strict'

import { ActivationController } from '../src/main/services/activation-controller.ts'

test('startPurchase sends accountId to installer purchase API', async () => {
  const prevBase = process.env.CLAWLITE_ACTIVATION_API_BASE
  process.env.CLAWLITE_ACTIVATION_API_BASE = 'https://example.com'

  const calls: Array<{ url: string; init?: RequestInit }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    calls.push({ url: u, init })

    if (u.endsWith('/api/installer/activation/bootstrap')) {
      return new Response(
        JSON.stringify({
          setupToken: 'stp_test_token',
          account: { accountId: '20625939-3108-44d3-b00c-2b14df139662', emailMasked: 'ai***@gmail.com' },
          entitlement: { status: 'inactive', plan: 'clawrouter' },
          allowedPaths: ['buy_and_connect', 'use_own_key'],
          recommendedPath: 'buy_and_connect'
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    if (u.endsWith('/api/installer/activation/purchase')) {
      return new Response(
        JSON.stringify({ purchaseState: 'checkout_pending', checkoutUrl: 'https://checkout', pollAfterMs: 2000 }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch

  try {
    const controller = new ActivationController()
    await controller.bootstrap({
      installerInstanceId: 'installer-test',
      platform: 'macos',
      appVersion: '1.0.0',
      accountId: 'aiagentautomation@gmail.com'
    })

    await controller.startPurchase({ path: 'buy_and_connect' })

    const purchaseCall = calls.find((c) => c.url.endsWith('/api/installer/activation/purchase'))
    assert.ok(purchaseCall, 'purchase API should be called')

    const body = JSON.parse(String(purchaseCall?.init?.body || '{}'))
    assert.equal(body.setupToken, 'stp_test_token')
    assert.equal(body.accountId, '20625939-3108-44d3-b00c-2b14df139662')
  } finally {
    globalThis.fetch = originalFetch
    process.env.CLAWLITE_ACTIVATION_API_BASE = prevBase
  }
})
