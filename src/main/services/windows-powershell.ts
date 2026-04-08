const encodePowerShellScript = (script: string): string =>
  Buffer.from(script, 'utf16le').toString('base64')

const quotePowerShellPath = (value: string): string => `'${value.replace(/'/g, "''")}'`

export const buildEncodedPowerShellArgs = (script: string): string[] => [
  '-NoProfile',
  '-EncodedCommand',
  encodePowerShellScript(script)
]

export const sanitizePowerShellErrorOutput = (raw: string): string => {
  const withoutControlChars = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  const withoutClixml = withoutControlChars
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !line.startsWith('#< CLIXML') &&
        !line.startsWith('<Objs') &&
        !line.startsWith('<Obj') &&
        !line.startsWith('<TN') &&
        !line.startsWith('<T>') &&
        !line.startsWith('</') &&
        !line.startsWith('<MS>') &&
        !line.startsWith('<PR>') &&
        !line.startsWith('<AV>') &&
        !line.startsWith('<Nil')
    )
    .join('\n')

  const withoutCommandBlob = withoutClixml
    .replace(
      /Command failed:\s*powershell(?:\.exe)?[\s\S]*?\(exit\s+\d+\)/gi,
      'Command failed: powershell.exe [encoded command hidden]'
    )
    .replace(/-EncodedCommand(?:\s+[A-Za-z0-9+/=]{8,})+/g, '-EncodedCommand [hidden]')
    .replace(/[A-Za-z0-9+/=]{120,}/g, '[encoded data hidden]')

  return withoutCommandBlob
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    // Strip .NET exception class names and stack traces
    .filter((line) => !line.match(/^\s*at\s+(System|Microsoft)\./i))
    .filter((line) => !line.match(/^\s*at\s+\S+\.\S+\([^)]*\)/))
    .map((line) =>
      line
        // Strip .NET exception prefixes
        .replace(/System\.Management\.Automation\.[\w.]+Exception:\s*/g, '')
        .replace(/ParameterBindingException[^:]*:\s*/g, '')
        // Strip garbled replacement characters (diamond question marks)
        .replace(/[\uFFFD]+/g, '')
        .replace(/\?{4,}/g, '')
        .trim()
    )
    .filter(Boolean)
    .filter((line) => line !== 'Command failed: powershell.exe [encoded command hidden]' || withoutCommandBlob.split('\n').filter(Boolean).length === 1)
    .join('\n')
    .trim()
}

export const buildElevatedWslInstallScript = (
  stdoutPath: string,
  stderrPath: string
): string => {
  const fallbackMatcher = [
    '$stderrText = ""',
    'if (Test-Path $stderrPath) { $stderrText = Get-Content -Path $stderrPath -Raw }',
    '$stdoutText = ""',
    'if (Test-Path $stdoutPath) { $stdoutText = Get-Content -Path $stdoutPath -Raw }',
    '$combinedText = ($stdoutText + "`n" + $stderrText)',
    '$needsLegacyFallback = ($LASTEXITCODE -ne 0) -and ($combinedText -match "wsl.exe \\[|--install <|wsl --list --online|no-launch|invalid command line option|unrecognized option")'
  ].join('\n')

  const innerScript = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "[Console]::InputEncoding = [System.Text.Encoding]::UTF8",
    "$ProgressPreference = 'SilentlyContinue'",
    "$ErrorActionPreference = 'Stop'",
    `$stdoutPath = ${quotePowerShellPath(stdoutPath)}`,
    `$stderrPath = ${quotePowerShellPath(stderrPath)}`,
    'wsl.exe --install -d Ubuntu --no-launch 1> $stdoutPath 2> $stderrPath',
    fallbackMatcher,
    'if ($needsLegacyFallback) {',
    '  wsl.exe --install -d Ubuntu 1> $stdoutPath 2> $stderrPath',
    '  $stderrText = ""',
    '  if (Test-Path $stderrPath) { $stderrText = Get-Content -Path $stderrPath -Raw -Encoding UTF8 }',
    '  $stdoutText = ""',
    '  if (Test-Path $stdoutPath) { $stdoutText = Get-Content -Path $stdoutPath -Raw -Encoding UTF8 }',
    '  $combinedText = ($stdoutText + "`n" + $stderrText)',
    '  $needsLegacyFallback = ($LASTEXITCODE -ne 0) -and ($combinedText -match "wsl.exe \\[|--install <|wsl --list --online|invalid command line option|unrecognized option")',
    '}',
    'if ($needsLegacyFallback) {',
    '  wsl.exe --install 1> $stdoutPath 2> $stderrPath',
    '}',
    'exit $LASTEXITCODE'
  ].join('\n')

  return [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "[Console]::InputEncoding = [System.Text.Encoding]::UTF8",
    "$ProgressPreference = 'SilentlyContinue'",
    "$ErrorActionPreference = 'Stop'",
    `  $stdoutPath = ${quotePowerShellPath(stdoutPath)}`,
    `  $stderrPath = ${quotePowerShellPath(stderrPath)}`,
    `  $encodedInner = '${encodePowerShellScript(innerScript)}'`,
    'try {',
    '  $p = Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedInner) -Verb RunAs -Wait -PassThru',
    '  if (Test-Path $stdoutPath) { Get-Content -Path $stdoutPath -Encoding UTF8 }',
    '  if (Test-Path $stderrPath) { Get-Content -Path $stderrPath -Encoding UTF8 }',
    '  exit $p.ExitCode',
    '} catch {',
    '  Write-Output $_.Exception.ToString()',
    '  if (Test-Path $stdoutPath) { Get-Content -Path $stdoutPath -Encoding UTF8 }',
    '  if (Test-Path $stderrPath) { Get-Content -Path $stderrPath -Encoding UTF8 }',
    '  exit 1',
    '}'
  ].join('\n')
}
