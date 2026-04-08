import test from 'node:test'
import assert from 'node:assert/strict'

import { decodeWindowsCommandOutput } from '../src/main/services/windows-output-decoder.ts'

test('decodeWindowsCommandOutput decodes UTF-16LE text without a BOM', () => {
  const text = '请求的操作需要提升。'
  const buf = Buffer.from(text, 'utf16le')

  assert.equal(decodeWindowsCommandOutput(buf), text)
})

test('decodeWindowsCommandOutput keeps UTF-8 text readable', () => {
  const text = 'wsl.exe --install -d Ubuntu'
  const buf = Buffer.from(text, 'utf8')

  assert.equal(decodeWindowsCommandOutput(buf), text)
})
