import test from 'node:test'
import assert from 'node:assert/strict'

import { detectWslStateFromOutputs } from '../src/main/services/wsl-state-detection.ts'

test('detectWslStateFromOutputs keeps needs_reboot when distro launch says restart is required', () => {
  const state = detectWslStateFromOutputs({
    versionOk: true,
    statusOutput: '',
    listOutput: 'Ubuntu',
    distroLaunchError: 'Installation will continue after restart.'
  })

  assert.equal(state, 'needs_reboot')
})

test('detectWslStateFromOutputs returns no_distro when no Ubuntu distro is listed', () => {
  const state = detectWslStateFromOutputs({
    versionOk: true,
    statusOutput: '',
    listOutput: '',
    distroLaunchError: ''
  })

  assert.equal(state, 'no_distro')
})
