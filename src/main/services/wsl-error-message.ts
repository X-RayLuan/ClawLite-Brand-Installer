const GENERIC_FAILURE_MESSAGE =
  'WSL installation failed. Please try running "wsl --install" manually in an elevated PowerShell window, then reboot and try again.'

export const classifyWslInstallFailure = ({
  combined,
  alreadyRegistered
}: {
  combined: string
  alreadyRegistered: boolean
}): string => {
  if (alreadyRegistered) {
    return 'WSL already installed but not responding. Please reboot and try again.'
  }

  const lower = combined.toLowerCase()

  if (lower.includes('virtualization') || lower.includes('hyper-v')) {
    return 'Hardware virtualization is not enabled. Please enable VT-x/AMD-V in your BIOS settings, then try again.'
  }

  if (
    lower.includes('canceled') ||
    lower.includes('cancelled') ||
    lower.includes('elevation') ||
    lower.includes('access denied') ||
    lower.includes('permission')
  ) {
    return 'Administrator access was denied. Please approve the UAC prompt when it appears.'
  }

  if (lower.includes('not recognized') || lower.includes('not found')) {
    return 'Your Windows version does not support "wsl --install". Please update Windows to version 1903 or later, or install WSL manually.'
  }

  if (
    lower.includes('download') ||
    lower.includes('network') ||
    lower.includes('0x800') ||
    lower.includes('timeout') ||
    lower.includes('connection')
  ) {
    return 'WSL download failed. Please check your internet connection and try again.'
  }

  if (
    lower.includes('optional feature') ||
    lower.includes('dism') ||
    lower.includes('windowsoptionalfeature') ||
    lower.includes('enable-windowsoptionalfeature')
  ) {
    return 'Required Windows features are not enabled. Please enable "Windows Subsystem for Linux" and "Virtual Machine Platform", then reboot and try again.'
  }

  if (
    lower.includes('execution policy') ||
    lower.includes('is not digitally signed') ||
    lower.includes('cannot be loaded because running scripts is disabled')
  ) {
    return 'PowerShell execution policy is blocking the installer. Please allow local scripts, then try again.'
  }

  return GENERIC_FAILURE_MESSAGE
}

export { GENERIC_FAILURE_MESSAGE }
