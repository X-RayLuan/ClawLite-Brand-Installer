#!/usr/bin/env node
import fs from 'node:fs'

const path = process.argv[2]
if (!path) {
  console.error('Usage: node scripts/content-brand-check.mjs <file>')
  process.exit(2)
}

const text = fs.readFileSync(path, 'utf8')
const errors = []

if (/LazyClaw/i.test(text)) errors.push('Forbidden brand term found: LazyClaw')
if (!/https:\/\/clawlite\.ai\b/.test(text)) errors.push('Missing required product link: https://clawlite.ai')
if (!/https?:\/\//.test(text)) errors.push('Missing source link (at least one URL required)')

if (errors.length) {
  console.error('❌ Content gate failed:')
  for (const e of errors) console.error('-', e)
  process.exit(1)
}

console.log('✅ Content gate passed')
