import test from 'node:test'
import assert from 'node:assert/strict'

import { isAllowedExternalUrl } from '../src/main/services/external-links.ts'

test('isAllowedExternalUrl allows the local OpenClaw Web Chat control ports', () => {
  assert.equal(isAllowedExternalUrl('http://127.0.0.1:18789/'), true)
  assert.equal(
    isAllowedExternalUrl(
      'http://127.0.0.1:18791/#gatewayUrl=ws%3A%2F%2F127.0.0.1%3A18789&token=test-token'
    ),
    true
  )
  assert.equal(isAllowedExternalUrl('http://localhost:18791/'), true)
})

test('isAllowedExternalUrl rejects non-allowlisted local ports and protocols', () => {
  assert.equal(isAllowedExternalUrl('http://127.0.0.1:3000/'), false)
  assert.equal(isAllowedExternalUrl('file:///tmp/test.html'), false)
})
