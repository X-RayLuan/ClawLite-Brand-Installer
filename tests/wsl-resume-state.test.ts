import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveResumedWslState } from '../src/renderer/src/steps/wsl-resume-state.ts'

test('resolveResumedWslState keeps needs_reboot after restart when wizard state says WSL install was in progress', () => {
  const resolved = resolveResumedWslState('not_initialized', {
    step: 'wslSetup',
    wslInstalled: true,
    timestamp: Date.now()
  })

  assert.equal(resolved, 'needs_reboot')
})

test('resolveResumedWslState preserves ready state after reboot', () => {
  const resolved = resolveResumedWslState('ready', {
    step: 'wslSetup',
    wslInstalled: true,
    timestamp: Date.now()
  })

  assert.equal(resolved, 'ready')
})

test('resolveResumedWslState does not change fresh sessions', () => {
  const resolved = resolveResumedWslState('no_distro', null)

  assert.equal(resolved, 'no_distro')
})
