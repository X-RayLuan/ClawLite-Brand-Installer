import test from 'node:test'
import assert from 'node:assert/strict'

import { classifyWslInstallFailure } from '../src/main/services/wsl-error-message.ts'

test('classifyWslInstallFailure returns a generic fallback when output is unreadable', () => {
  const message = classifyWslInstallFailure({
    combined: 'HrCg@b g(c) Microsoft Corporation0OYu@b gCg)RO',
    alreadyRegistered: false
  })

  assert.equal(
    message,
    'WSL installation failed. Please try running "wsl --install" manually in an elevated PowerShell window, then reboot and try again.'
  )
})

test('classifyWslInstallFailure never leaks raw combined output for already-registered failures', () => {
  const message = classifyWslInstallFailure({
    combined: '4294967295 HrCg@b g(c) Microsoft Corporation0OYu@b gCg)RO',
    alreadyRegistered: true
  })

  assert.equal(message, 'WSL already installed but not responding. Please reboot and try again.')
  assert.doesNotMatch(message, /HrCg@b|Microsoft Corporation0OYu/)
})

test('classifyWslInstallFailure still maps stable virtualization signal to a fixed message', () => {
  const message = classifyWslInstallFailure({
    combined: 'hardware virtualization or hyper-v is required',
    alreadyRegistered: false
  })

  assert.equal(
    message,
    'Hardware virtualization is not enabled. Please enable VT-x/AMD-V in your BIOS settings, then try again.'
  )
})
