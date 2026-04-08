const encodePowerShellScript = (script: string): string =>
  Buffer.from(script, 'utf16le').toString('base64')

const quotePowerShellPath = (value: string): string => `'${value.replace(/'/g, "''")}'`

export const buildEncodedPowerShellArgs = (script: string): string[] => [
  '-NoProfile',
  '-EncodedCommand',
  encodePowerShellScript(script)
]

export const buildElevatedWslInstallScript = (
  stdoutPath: string,
  stderrPath: string
): string => {
  const innerScript = [
    "$ProgressPreference = 'SilentlyContinue'",
    "$ErrorActionPreference = 'Stop'",
    'wsl.exe --install -d Ubuntu --no-launch',
    'exit $LASTEXITCODE'
  ].join('\n')

  return [
    "$ProgressPreference = 'SilentlyContinue'",
    "$ErrorActionPreference = 'Stop'",
    `  $stdoutPath = ${quotePowerShellPath(stdoutPath)}`,
    `  $stderrPath = ${quotePowerShellPath(stderrPath)}`,
    `  $encodedInner = '${encodePowerShellScript(innerScript)}'`,
    'try {',
    '  $p = Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedInner) -Verb RunAs -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath',
    '  if (Test-Path $stdoutPath) { Get-Content -Path $stdoutPath }',
    '  if (Test-Path $stderrPath) { Get-Content -Path $stderrPath }',
    '  exit $p.ExitCode',
    '} catch {',
    '  Write-Output $_.Exception.ToString()',
    '  if (Test-Path $stdoutPath) { Get-Content -Path $stdoutPath }',
    '  if (Test-Path $stderrPath) { Get-Content -Path $stderrPath }',
    '  exit 1',
    '}'
  ].join('\n')
}
