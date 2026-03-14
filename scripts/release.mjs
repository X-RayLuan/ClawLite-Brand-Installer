#!/usr/bin/env node

/**
 * 릴리즈 스크립트 (macOS/Windows 공용)
 *
 * 사용법:
 *   npm run release            # patch (1.3.4 → 1.3.5)
 *   npm run release -- minor   # minor (1.3.4 → 1.4.0)
 *   npm run release -- major   # major (1.3.4 → 2.0.0)
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(rootDir, 'dist')
const run = (cmd) => execSync(cmd, { cwd: rootDir, stdio: 'inherit' })
const runSilent = (cmd) => execSync(cmd, { cwd: rootDir, encoding: 'utf8' }).trim()
const shellEscape = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`

const bump = process.argv[2] || 'patch'
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error(`잘못된 버전 타입: ${bump} (patch | minor | major)`)
  process.exit(1)
}

// 1. 워킹 트리 클린 확인
const status = runSilent('git status --porcelain')
if (status) {
  console.error('커밋되지 않은 변경사항이 있습니다. 먼저 커밋하세요.')
  process.exit(1)
}

// 2. 버전 bump
run(`npm version ${bump} --no-git-tag-version`)
const { version } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
const tag = `v${version}`
console.log(`\n>> 버전: ${tag}`)

// 3. 커밋 & 푸시
run('git add package.json package-lock.json')
run(`git commit -m "chore: bump version to ${tag}"`)
run('git push origin main')
console.log('>> 커밋 & 푸시 완료')

// 4. GitHub 릴리즈 생성
run(`gh release create ${tag} --title "${tag}" --notes "Release ${tag}"`)

// 5. dist/에 이미 존재하는 설치 파일 업로드
const releaseAssets = [
  join(distDir, 'clawlite.dmg'),
  join(distDir, 'clawlite-setup.exe')
]

const uploaded = []
const missing = []

for (const assetPath of releaseAssets) {
  if (!existsSync(assetPath)) {
    missing.push(assetPath)
    continue
  }
  run(`gh release upload ${tag} ${shellEscape(assetPath)} --clobber`)
  uploaded.push(assetPath)
}

console.log(`\n릴리즈 ${tag} 완료`)
if (uploaded.length > 0) {
  console.log('업로드된 파일:')
  for (const asset of uploaded) console.log(`  ${asset}`)
}
if (missing.length > 0) {
  console.log('누락된 파일(업로드 안 됨):')
  for (const asset of missing) console.log(`  ${asset}`)
}
console.log(`릴리즈 페이지: https://github.com/X-RayLuan/ClawLite-Installer/releases/tag/${tag}`)
