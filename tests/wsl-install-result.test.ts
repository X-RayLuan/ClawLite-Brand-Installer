import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isLikelySuccessfulWslInstallResult,
  isWslRebootRequiredText
} from '../src/main/services/wsl-install-result.ts'

test('isWslRebootRequiredText detects english reboot guidance', () => {
  assert.equal(
    isWslRebootRequiredText('Installation will continue after restart. Restart your computer to finish.'),
    true
  )
})

test('isWslRebootRequiredText detects chinese reboot guidance', () => {
  assert.equal(isWslRebootRequiredText('安装将在重新启动后继续。'), true)
})

test('isLikelySuccessfulWslInstallResult treats reboot-required output as success', () => {
  assert.equal(
    isLikelySuccessfulWslInstallResult({
      finalExitCode: 1,
      reached: false,
      attempts: [{ exitCode: 1, stderrBytes: 0 }],
      outputText: 'Installation will continue after restart.'
    }),
    true
  )
})
