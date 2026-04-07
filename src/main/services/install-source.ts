import { spawnSync } from 'child_process'
import { app } from 'electron'
import { platform } from 'os'

/**
 * Reads the original download URL from macOS quarantine extended attribute
 * (com.apple.metadata:kMDItemWhereFroms) and extracts the email param.
 *
 * Returns null if not on macOS, no xattr present, or no email found.
 */
export function readEmailFromInstallSource(): string | null {
  if (platform() !== 'darwin') return null

  try {
    const appPath = app.getAppPath().replace(/\/Contents\/Resources\/app(?:\.asar)?$/, '')
    const result = spawnSync(
      'mdls',
      ['-name', 'kMDItemWhereFroms', '-raw', appPath],
      { encoding: 'utf-8' }
    )

    if (result.status !== 0 || !result.stdout) return null

    // Output is a parenthesized list of URLs, e.g.:
    // (
    //     "https://clawlite.ai/api/installer-download?email=user@example.com",
    //     "https://github.com/.../clawlite.dmg"
    // )
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
