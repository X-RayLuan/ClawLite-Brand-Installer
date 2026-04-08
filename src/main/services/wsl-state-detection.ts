import type { WslState } from './wsl-utils'

const isRebootRequiredText = (text: string): boolean => {
  const lower = text.toLowerCase()
  return (
    lower.includes('reboot') ||
    lower.includes('restart') ||
    lower.includes('restart your computer') ||
    lower.includes('restart is required') ||
    lower.includes('installation will continue after restart') ||
    text.includes('重启') ||
    text.includes('重新启动')
  )
}

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

  if (isRebootRequiredText(statusOutput) || isRebootRequiredText(distroLaunchError)) {
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
