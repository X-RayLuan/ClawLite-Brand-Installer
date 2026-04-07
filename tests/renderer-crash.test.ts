import test from 'node:test'
import assert from 'node:assert/strict'

import { buildRendererCrashHtml } from '../src/main/services/renderer-crash.ts'

test('buildRendererCrashHtml includes reason and exit code', () => {
  const html = buildRendererCrashHtml({ reason: 'crashed', exitCode: 139 })
  assert.match(html, /Reason: crashed/)
  assert.match(html, /Exit code: 139/)
})

test('buildRendererCrashHtml escapes unsafe text', () => {
  const html = buildRendererCrashHtml({ reason: '<script>alert(1)<\/script>' })
  assert.equal(html.includes('<script>'), false)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})

