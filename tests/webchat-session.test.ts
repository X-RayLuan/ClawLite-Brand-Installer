import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildPrepareMainSessionCommand,
  buildResetMainSessionCommand
} from '../src/main/services/webchat-session-command.ts'

test('getResetMainSessionCommand keeps using /reset for existing reset flow', () => {
  const command = buildResetMainSessionCommand('/mock/openclaw', 'darwin')
  assert.match(command.cmd, /openclaw$/)
  assert.deepEqual(command.args, ['agent', '--agent', 'main', '--message', '/reset'])
  assert.equal(command.useShellEnv, true)
})

test('getResetMainSessionCommand skips blocking agent commands on Windows', () => {
  const command = buildResetMainSessionCommand('/mock/openclaw', 'win32')

  assert.equal(command.skip, true)
  assert.equal(command.cmd, '')
  assert.deepEqual(command.args, [])
  assert.equal(command.useShellEnv, false)
})

test('getPrepareMainSessionCommand uses /new with target model on macOS', () => {
  const command = buildPrepareMainSessionCommand(
    '/mock/openclaw',
    'clawrouter/claude-sonnet-4-6',
    'darwin'
  )
  assert.match(command.cmd, /openclaw$/)
  assert.deepEqual(command.args, [
    'agent',
    '--agent',
    'main',
    '--message',
    '/new clawrouter/claude-sonnet-4-6'
  ])
  assert.equal(command.useShellEnv, true)
})

test('getPrepareMainSessionCommand skips blocking agent commands on Windows', () => {
  const command = buildPrepareMainSessionCommand('/mock/openclaw', 'clawrouter/claude-sonnet-4-6', 'win32')

  assert.equal(command.skip, true)
  assert.equal(command.cmd, '')
  assert.deepEqual(command.args, [])
  assert.equal(command.useShellEnv, false)
})
