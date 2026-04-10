import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildWebChatUrl,
  openWebChatExternally,
  shouldResetMainSessionOnOpen,
  waitForStableGatewayToken
} from '../src/renderer/src/steps/webchat-launch.ts'

test('buildWebChatUrl encodes gateway token into the URL hash', () => {
  assert.equal(
    buildWebChatUrl('token with spaces'),
    'http://127.0.0.1:18791/#gatewayUrl=ws%3A%2F%2F127.0.0.1%3A18789&token=token+with+spaces'
  )
})

test('shouldResetMainSessionOnOpen only fires once for fresh activation handoff', () => {
  assert.equal(
    shouldResetMainSessionOnOpen({ freshSessionRequested: true, freshSessionConsumed: false }),
    true
  )
  assert.equal(
    shouldResetMainSessionOnOpen({ freshSessionRequested: true, freshSessionConsumed: true }),
    false
  )
  assert.equal(
    shouldResetMainSessionOnOpen({ freshSessionRequested: false, freshSessionConsumed: false }),
    false
  )
})

test('waitForStableGatewayToken waits for the same token across consecutive reads', async () => {
  const reads = [
    { success: true, config: { gatewayToken: undefined } },
    { success: true, config: { gatewayToken: 'first-token' } },
    { success: true, config: { gatewayToken: 'second-token' } },
    { success: true, config: { gatewayToken: 'second-token' } }
  ]
  const delays: number[] = []

  const token = await waitForStableGatewayToken({
    initialToken: null,
    readConfig: async () => reads.shift() ?? { success: true, config: { gatewayToken: undefined } },
    attempts: 4,
    delayMs: 25,
    sleep: async (ms) => delays.push(ms)
  })

  assert.equal(token, 'second-token')
  assert.deepEqual(delays, [25, 25, 25])
})

test('openWebChatExternally opens the browser only after the gateway token stabilizes', async () => {
  const reads = [
    { success: true, config: { gatewayToken: 'next-token' } },
    { success: true, config: { gatewayToken: 'next-token' } }
  ]
  const opened: string[] = []

  const result = await openWebChatExternally({
    initialToken: 'stale-token',
    readConfig: async () => reads.shift() ?? { success: true, config: { gatewayToken: 'next-token' } },
    openExternal: async (url) => {
      opened.push(url)
      return { success: true }
    },
    attempts: 3,
    delayMs: 10,
    sleep: async () => {}
  })

  assert.deepEqual(result, { success: true, token: 'next-token' })
  assert.deepEqual(opened, [
    'http://127.0.0.1:18791/#gatewayUrl=ws%3A%2F%2F127.0.0.1%3A18789&token=next-token'
  ])
})

test('openWebChatExternally does not open the browser when no stable gateway token is available', async () => {
  let opened = false

  const result = await openWebChatExternally({
    initialToken: null,
    readConfig: async () => ({ success: true, config: { gatewayToken: undefined } }),
    openExternal: async () => {
      opened = true
      return { success: true }
    },
    attempts: 2,
    delayMs: 10,
    sleep: async () => {}
  })

  assert.equal(result.success, false)
  assert.match(result.error || '', /token missing/i)
  assert.equal(opened, false)
})
