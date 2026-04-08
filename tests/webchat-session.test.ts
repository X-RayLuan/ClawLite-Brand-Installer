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

test('getPrepareMainSessionCommand uses /new with target model on Windows via WSL', () => {
  assert.deepEqual(buildPrepareMainSessionCommand('/mock/openclaw', 'clawrouter/claude-sonnet-4-6', 'win32'), {
    cmd: 'wsl',
    args: [
      '-d',
      'Ubuntu',
      '-u',
      'root',
      '--',
      'openclaw',
      'agent',
      '--agent',
      'main',
      '--message',
      '/new clawrouter/claude-sonnet-4-6'
    ],
    useShellEnv: false
  })
})
