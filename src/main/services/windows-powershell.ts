export const buildEncodedPowerShellArgs = (script: string): string[] => [
  '-NoProfile',
  '-EncodedCommand',
  Buffer.from(script, 'utf16le').toString('base64')
]

export const buildElevatedWslInstallScript = (): string =>
  [
    'try {',
    '  $argList = @("--install", "-d", "Ubuntu", "--no-launch")',
    '  $p = Start-Process -FilePath "wsl.exe" -ArgumentList $argList -Verb RunAs -Wait -PassThru',
    '  exit $p.ExitCode',
    '} catch {',
    '  Write-Output $_.Exception.Message',
    '  exit 1',
    '}'
  ].join('\n')
