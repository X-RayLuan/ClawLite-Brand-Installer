import { spawnSync } from 'child_process'
import { app, clipboard } from 'electron'
import { platform } from 'os'

/**
 * Reads the original download URL from macOS quarantine extended attribute
 * (com.apple.metadata:kMDItemWhereFroms) and extracts the email param.
 *
 * Returns null if not on macOS, no xattr present, or no email found.
 */
export function readEmailFromInstallSource(): string | null {
  // Try clipboard first — website copies email on download click
  try {
    const clip = clipboard.readText().trim()
    if (clip && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clip)) {
      return clip
    }
  } catch {
    /* ignore */
  }

  // Fallback: try macOS xattr
  if (platform() !== 'darwin') return null

  try {
    const appPath = app.getAppPath().replace(/\/Contents\/Resources\/app(?:\.asar)?$/, '')
    const result = spawnSync(
      'mdls',
      ['-name', 'kMDItemWhereFroms', '-raw', appPath],
      { encoding: 'utf-8' }
    )

    if (result.status !== 0 || !result.stdout) return null

    const matches = result.stdout.match(/https?:\/\/[^\s",)]+/g)
    if (!matches) return null

    for (const url of matches) {
      try {
        const parsed = new URL(url)
        const email = parsed.searchParams.get('email')
        if (email) return email
      } catch {
        /* skip invalid URLs */
      }
    }

    return null
  } catch {
    return null
  }
}
