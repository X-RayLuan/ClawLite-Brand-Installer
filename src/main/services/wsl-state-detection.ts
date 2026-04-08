import type { WslState } from './wsl-utils'
import { isWslRebootRequiredText } from './wsl-install-result.ts'

export const detectWslStateFromOutputs = ({
  versionOk,
  statusOutput,
  listOutput,
  distroLaunchError
}: {
  versionOk: boolean
  statusOutput: string
  listOutput: string
  distroLaunchError: string
}): WslState => {
  if (!versionOk) {
    return 'not_available'
  }

  if (isWslRebootRequiredText(statusOutput) || isWslRebootRequiredText(distroLaunchError)) {
    return 'needs_reboot'
  }

  const distros = listOutput
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const ubuntuDistro = distros.find((d) => /^ubuntu/i.test(d)) || distros.find((d) => d === 'Ubuntu')

  if (!ubuntuDistro) {
    return 'no_distro'
  }

  return distroLaunchError ? 'not_initialized' : 'ready'
}
