import test from 'node:test'
import assert from 'node:assert/strict'

import { OPENCLAW_PROCESS_REGEX } from '../src/main/services/process-match.ts'

test('openclaw process regex matches openclaw cli command', () => {
  const cmd = '/Users/m1/.npm-global/bin/openclaw gateway --port 18789'
  assert.equal(OPENCLAW_PROCESS_REGEX.test(cmd), true)
})

test('openclaw process regex does not match ClawLite renderer path under ~/.openclaw/workspace', () => {
  const cmd = '/Users/m1/.openclaw/workspace/ClawLite-Brand-Installer/node_modules/electron/dist/Electron.app/Contents/Frameworks/Electron Helper (Renderer).app/Contents/MacOS/Electron Helper (Renderer) --type=renderer --app-path=/Users/m1/.openclaw/workspace/ClawLite-Brand-Installer'
  assert.equal(OPENCLAW_PROCESS_REGEX.test(cmd), false)
})
