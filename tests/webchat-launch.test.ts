import test from 'node:test'
import assert from 'node:assert/strict'

import { buildWebChatUrl, shouldResetMainSessionOnOpen } from '../src/renderer/src/steps/webchat-launch.ts'

test('buildWebChatUrl encodes gateway token into the URL hash', () => {
  assert.equal(
    buildWebChatUrl('token with spaces'),
    'http://127.0.0.1:18789/#token=token%20with%20spaces'
  )
})

test('shouldResetMainSessionOnOpen only fires once for fresh BYOK handoff', () => {
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
