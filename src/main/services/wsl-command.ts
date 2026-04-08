export const isLegacyWslCommandHelpText = (text: string): boolean => {
  const lower = text.toLowerCase()
  return (
    lower.includes('wsl.exe [argument] [options...] [commandline]') ||
    lower.includes('--exec, -e <commandline>') ||
    lower.includes('--distribution, -d <') ||
    lower.includes('--cd <directory>')
  )
}

export const buildWslCommandVariants = (
  commandArgs: string[],
  options: {
    distro?: string
    user?: string
  } = {}
): string[][] => {
  const baseArgs: string[] = []
  if (options.distro) {
    baseArgs.push('-d', options.distro)
  }
  if (options.user) {
    baseArgs.push('-u', options.user)
  }
  if (commandArgs.length === 0) {
    return [baseArgs]
  }
  return [
    [...baseArgs, '--', ...commandArgs],
    [...baseArgs, ...commandArgs]
  ]
}
