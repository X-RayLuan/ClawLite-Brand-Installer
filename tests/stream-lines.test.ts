import test from 'node:test'
import assert from 'node:assert/strict'

import { createDecodedLineCollector } from '../src/main/services/stream-lines.ts'

test('createDecodedLineCollector flushes the final line even without a trailing newline', () => {
  const lines: string[] = []
  const collector = createDecodedLineCollector((line) => lines.push(line))

  collector.push(Buffer.from('first line\nsecond line without newline', 'utf8'))
  collector.end()

  assert.deepEqual(lines, ['first line', 'second line without newline'])
})

test('createDecodedLineCollector preserves multibyte utf8 characters split across chunks', () => {
  const lines: string[] = []
  const collector = createDecodedLineCollector((line) => lines.push(line))
  const text = '中文错误'
  const bytes = Buffer.from(`${text}\n`, 'utf8')

  collector.push(bytes.subarray(0, 5))
  collector.push(bytes.subarray(5))
  collector.end()

  assert.deepEqual(lines, [text])
})
