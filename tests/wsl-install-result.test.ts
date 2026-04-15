import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isWslAlreadyExistsText,
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

test('isWslAlreadyExistsText detects english already-exists output', () => {
  assert.equal(
    isWslAlreadyExistsText('Error code: WSL/InstallDistro/ERROR_ALREADY_EXISTS'),
    true
  )
})

test('isWslAlreadyExistsText detects localized already-exists output', () => {
  assert.equal(
    isWslAlreadyExistsText(
      '已存在具有所提供名称的分发。使用 --name选择其他名称。错误代码:WsL/InstalLDistro/ERROR_ALREADY_EXISTS'
    ),
    true
  )
})
