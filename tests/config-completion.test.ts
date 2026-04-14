import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getPrefilledConfigCompletionError,
  isPrefilledConfigComplete
} from '../src/renderer/src/steps/config-completion.ts'

test('isPrefilledConfigComplete returns false when gateway token is missing', () => {
  assert.equal(
    isPrefilledConfigComplete({
      provider: 'clawrouter',
      model: 'clawrouter/claude-sonnet-4-6'
    }),
    false
  )
})

test('isPrefilledConfigComplete returns true when gateway token exists', () => {
  assert.equal(
    isPrefilledConfigComplete({
      provider: 'clawrouter',
      model: 'clawrouter/claude-sonnet-4-6',
      gatewayToken: 'gw_test_123'
    }),
    true
  )
})

test('getPrefilledConfigCompletionError explains incomplete ClawRouter setup', () => {
  assert.equal(
    getPrefilledConfigCompletionError({
      provider: 'clawrouter',
      model: 'clawrouter/claude-sonnet-4-6'
    }),
    'ClawRouter setup is incomplete. Please finish ClawRouter connection before continuing.'
  )
})

test('getPrefilledConfigCompletionError returns null when config is complete', () => {
  assert.equal(
    getPrefilledConfigCompletionError({
      provider: 'clawrouter',
      model: 'clawrouter/claude-sonnet-4-6',
      gatewayToken: 'gw_test_123'
    }),
    null
  )
})
