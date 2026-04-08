import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildWslCommandVariants,
  isLegacyWslCommandHelpText
} from '../src/main/services/wsl-command.ts'

test('buildWslCommandVariants tries modern syntax before legacy syntax', () => {
  const variants = buildWslCommandVariants(['echo', 'ok'], {
    distro: 'Ubuntu',
    user: 'root'
  })

  assert.deepEqual(variants, [
    ['-d', 'Ubuntu', '-u', 'root', '--', 'echo', 'ok'],
    ['-d', 'Ubuntu', '-u', 'root', 'echo', 'ok']
  ])
})

test('buildWslCommandVariants does not add duplicate legacy fallback when no command args are provided', () => {
  const variants = buildWslCommandVariants([], {
    distro: 'Ubuntu',
    user: 'root'
  })

  assert.deepEqual(variants, [['-d', 'Ubuntu', '-u', 'root']])
})

test('isLegacyWslCommandHelpText detects old wsl.exe command help output', () => {
  const text = `wsl.exe [Argument] [Options...] [CommandLine]
Linux Shell
--exec, -e <CommandLine>
--cd <Directory>
--distribution, -d <Distro>`

  assert.equal(isLegacyWslCommandHelpText(text), true)
})

test('isLegacyWslCommandHelpText ignores ordinary command failures', () => {
  assert.equal(isLegacyWslCommandHelpText('The Windows Subsystem for Linux instance has terminated.'), false)
})
