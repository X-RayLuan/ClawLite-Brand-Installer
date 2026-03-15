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
import { existsSync, readFileSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(rootDir, 'dist')
const packageJsonPath = join(rootDir, 'package.json')
const packageLockPath = join(rootDir, 'package-lock.json')
const run = (cmd) => execSync(cmd, { cwd: rootDir, stdio: 'inherit' })
const runSilent = (cmd) => execSync(cmd, { cwd: rootDir, encoding: 'utf8' }).trim()
const shellEscape = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const bump = process.argv[2] || 'patch'
if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error(`잘못된 버전 타입: ${bump} (patch | minor | major)`)
  process.exit(1)
}

const releaseAssets = [
  {
    path: join(distDir, 'clawlite.dmg'),
    label: 'macOS DMG',
    buildCommand: 'npm run build:mac-local',
    platforms: ['darwin']
  },
  {
    path: join(distDir, 'clawlite-setup.exe'),
    label: 'Windows installer',
    buildCommand: 'npm run build:win-local',
    platforms: ['win32']
  }
]

const requiredAssets = releaseAssets.filter(({ platforms }) => platforms.includes(process.platform))
if (requiredAssets.length === 0) {
  console.error(`지원되지 않는 플랫폼입니다: ${process.platform}`)
  process.exit(1)
}

const readPackageVersions = () => {
  const pkg = readJson(packageJsonPath)
  const lock = readJson(packageLockPath)

  return {
    packageVersion: pkg.version,
    packageLockVersion: lock.version ?? lock.packages?.['']?.version ?? null
  }
}

const assertVersionConsistency = () => {
  const { packageVersion, packageLockVersion } = readPackageVersions()

  if (!packageVersion || !packageLockVersion || packageVersion !== packageLockVersion) {
    console.error('버전 불일치가 있습니다. package.json 과 package-lock.json 을 먼저 맞추세요.')
    console.error(`  package.json: ${packageVersion ?? 'missing'}`)
    console.error(`  package-lock.json: ${packageLockVersion ?? 'missing'}`)
    process.exit(1)
  }

  return packageVersion
}

const buildFreshAsset = ({ path, label, buildCommand }) => {
  const buildStartedAt = Date.now()
  run(buildCommand)

  if (!existsSync(path)) {
    console.error(`${label} 빌드 결과물이 없습니다: ${path}`)
    process.exit(1)
  }

  if (statSync(path).mtimeMs < buildStartedAt) {
    console.error(`${label} 결과물이 이번 실행에서 새로 생성되지 않았습니다: ${path}`)
    process.exit(1)
  }

  return path
}

const extractPlistValue = (plist, key) => {
  const match = plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`))
  return match?.[1] ?? null
}

const assertMacBundleVersion = (version) => {
  if (process.platform !== 'darwin') return

  const appPlistPath = join(distDir, 'mac-universal', 'ClawLite.app', 'Contents', 'Info.plist')
  if (!existsSync(appPlistPath)) {
    console.error(`macOS 앱 번들을 찾을 수 없습니다: ${appPlistPath}`)
    process.exit(1)
  }

  const plist = readFileSync(appPlistPath, 'utf8')
  const shortVersion = extractPlistValue(plist, 'CFBundleShortVersionString')
  const bundleVersion = extractPlistValue(plist, 'CFBundleVersion')

  if (shortVersion !== version || bundleVersion !== version) {
    console.error('빌드된 macOS 앱 번들 버전이 package.json 과 일치하지 않습니다.')
    console.error(`  package.json: ${version}`)
    console.error(`  CFBundleShortVersionString: ${shortVersion ?? 'missing'}`)
    console.error(`  CFBundleVersion: ${bundleVersion ?? 'missing'}`)
    process.exit(1)
  }
}

const assertMacDmgVersion = (version) => {
  if (process.platform !== 'darwin') return

  const dmgPath = join(distDir, 'clawlite.dmg')
  run(`node scripts/verify-mac-artifact.mjs ${shellEscape(version)} ${shellEscape(dmgPath)}`)
}

// 1. 워킹 트리 클린 확인
const status = runSilent('git status --porcelain')
if (status) {
  console.error('커밋되지 않은 변경사항이 있습니다. 먼저 커밋하세요.')
  process.exit(1)
}

// 2. 현재 버전 파일 일치 확인
assertVersionConsistency()

// 3. 버전 bump
run(`npm version ${bump} --no-git-tag-version`)
const version = assertVersionConsistency()
const tag = `v${version}`
console.log(`\n>> 버전: ${tag}`)

// 4. 현재 OS 설치 파일 빌드 + 버전 검증
const uploaded = requiredAssets.map(buildFreshAsset)
assertMacBundleVersion(version)
assertMacDmgVersion(version)

// 5. 커밋 & 푸시
run('git add package.json package-lock.json')
run(`git commit -m "chore: bump version to ${tag}"`)
run('git push origin main')
console.log('>> 커밋 & 푸시 완료')

// 6. GitHub 릴리즈 생성
run(`gh release create ${tag} --title "${tag}" --notes "Release ${tag}"`)

// 7. 이번 실행에서 새로 만든 설치 파일만 업로드
const missing = releaseAssets
  .filter(({ path }) => !existsSync(path))
  .map(({ path }) => path)

for (const assetPath of uploaded) {
  run(`gh release upload ${tag} ${shellEscape(assetPath)} --clobber`)
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
