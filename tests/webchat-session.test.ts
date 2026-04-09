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

test('getResetMainSessionCommand uses WSL bash wrapper instead of relying on openclaw in PATH', () => {
  const command = buildResetMainSessionCommand('/mock/openclaw', 'win32')

  assert.equal(command.cmd, 'wsl')
  assert.deepEqual(command.args.slice(0, 6), ['-d', 'Ubuntu', '-u', 'root', '--', 'bash'])
  assert.equal(command.args[6], '-lc')
  assert.match(command.args[7], /command -v openclaw/)
  assert.match(command.args[7], /"\$OPENCLAW_BIN" 'agent' '--agent' 'main' '--message' '\/reset'/)
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

test('getPrepareMainSessionCommand uses WSL bash wrapper instead of relying on openclaw in PATH', () => {
  const command = buildPrepareMainSessionCommand('/mock/openclaw', 'clawrouter/claude-sonnet-4-6', 'win32')

  assert.equal(command.cmd, 'wsl')
  assert.deepEqual(command.args.slice(0, 6), ['-d', 'Ubuntu', '-u', 'root', '--', 'bash'])
  assert.equal(command.args[6], '-lc')
  assert.match(command.args[7], /command -v openclaw/)
  assert.match(
    command.args[7],
    /"\$OPENCLAW_BIN" 'agent' '--agent' 'main' '--message' '\/new clawrouter\/claude-sonnet-4-6'/
  )
  assert.equal(command.useShellEnv, false)
})
