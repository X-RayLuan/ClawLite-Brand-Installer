export const isWslRebootRequiredText = (text: string): boolean => {
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

export const isWslAlreadyExistsText = (text: string): boolean => {
  const lower = text.toLowerCase()
  return (
    lower.includes('error_already_exists') ||
    lower.includes('already exists') ||
    lower.includes('already installed') ||
    lower.includes('installdistro/error_already_exists') ||
    text.includes('已存在具有所提供名称的分发')
  )
}

export const isLikelySuccessfulWslInstallResult = (input: {
  finalExitCode?: number | null
  reached?: boolean
  attempts?: Array<{ exitCode?: number | null; stderrBytes?: number }>
  outputText?: string
}): boolean => {
  const attempts = Array.isArray(input.attempts) ? input.attempts : []
  const anySuccess = attempts.some(
    (a) => a.exitCode === 0 || (a.exitCode === 1 && (a.stderrBytes ?? 0) === 0)
  )

  if (isWslRebootRequiredText(input.outputText ?? '')) {
    return true
  }

  return Boolean(input.reached) || input.finalExitCode === 0 || anySuccess
}
