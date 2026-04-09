import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildWslOpenClawCommandArgs,
  buildWslOpenClawShellCommand,
  buildWslOpenClawWrapper
} from '../src/main/services/wsl-openclaw-command.ts'

test('buildWslOpenClawWrapper resolves openclaw via command -v before fixed paths', () => {
  const wrapper = buildWslOpenClawWrapper()

  assert.match(wrapper, /command -v openclaw/)
  assert.match(wrapper, /\/root\/.npm-global\/bin\/openclaw/)
  assert.match(wrapper, /\/usr\/local\/bin\/openclaw/)
  assert.match(wrapper, /\/usr\/bin\/openclaw/)
  assert.match(wrapper, /openclaw CLI not found in WSL/)
})

test('buildWslOpenClawShellCommand quotes args and invokes resolved binary', () => {
  const script = buildWslOpenClawShellCommand(['agent', '--agent', 'main', '--message', "/new openai-codex/gpt-5.3-codex-spark"])

  assert.match(script, /OPENCLAW_BIN=/)
  assert.match(
    script,
    /"\$OPENCLAW_BIN" 'agent' '--agent' 'main' '--message' '\/new openai-codex\/gpt-5\.3-codex-spark'/
  )
})

test('buildWslOpenClawCommandArgs wraps commands in bash -lc for WSL', () => {
  const args = buildWslOpenClawCommandArgs(['doctor', '--fix'])

  assert.deepEqual(args.slice(0, 6), ['-d', 'Ubuntu', '-u', 'root', '--', 'bash'])
  assert.equal(args[6], '-lc')
  assert.match(args[7], /command -v openclaw/)
  assert.match(args[7], /"\$OPENCLAW_BIN" 'doctor' '--fix'/)
})
