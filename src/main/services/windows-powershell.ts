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
  const innerScript = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "[Console]::InputEncoding = [System.Text.Encoding]::UTF8",
    "$OutputEncoding = [System.Text.Encoding]::UTF8",
    "$ProgressPreference = 'SilentlyContinue'",
    "$ErrorActionPreference = 'Stop'",
    `$stdoutPath = ${quotePowerShellPath(stdoutPath)}`,
    `$stderrPath = ${quotePowerShellPath(stderrPath)}`,
    'wsl.exe --install -d Ubuntu --no-launch 1> $stdoutPath 2> $stderrPath',
    'foreach ($f in @($stdoutPath, $stderrPath)) {',
    '  if (Test-Path $f) {',
    '    try {',
      '      $raw = [System.IO.File]::ReadAllBytes($f)',
      '      if ($raw.Length -ge 2 -and $raw[0] -eq 0xFF -and $raw[1] -eq 0xFE) {',
      '        $text = [System.Text.Encoding]::Unicode.GetString($raw)',
      '        [System.IO.File]::WriteAllText($f, $text, [System.Text.Encoding]::UTF8)',
      '      }',
    '    } catch {}',
    '  }',
    '}',
    'if ($LASTEXITCODE -ne 0) {',
    '  wsl.exe --install -d Ubuntu 1> $stdoutPath 2> $stderrPath',
    '  foreach ($f in @($stdoutPath, $stderrPath)) {',
    '    if (Test-Path $f) {',
    '      try {',
    '        $raw = [System.IO.File]::ReadAllBytes($f)',
    '        if ($raw.Length -ge 2 -and $raw[0] -eq 0xFF -and $raw[1] -eq 0xFE) {',
    '          $text = [System.Text.Encoding]::Unicode.GetString($raw)',
    '          [System.IO.File]::WriteAllText($f, $text, [System.Text.Encoding]::UTF8)',
    '        }',
    '      } catch {}',
    '    }',
    '  }',
    '}',
    'if ($LASTEXITCODE -ne 0) {',
    '  wsl.exe --install 1> $stdoutPath 2> $stderrPath',
    '  foreach ($f in @($stdoutPath, $stderrPath)) {',
    '    if (Test-Path $f) {',
    '      try {',
    '        $raw = [System.IO.File]::ReadAllBytes($f)',
    '        if ($raw.Length -ge 2 -and $raw[0] -eq 0xFF -and $raw[1] -eq 0xFE) {',
    '          $text = [System.Text.Encoding]::Unicode.GetString($raw)',
    '          [System.IO.File]::WriteAllText($f, $text, [System.Text.Encoding]::UTF8)',
    '        }',
    '      } catch {}',
    '    }',
    '  }',
    '}',
    'exit $LASTEXITCODE'
  ].join('\n')

  return [
    "chcp 65001 | Out-Null",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "[Console]::InputEncoding = [System.Text.Encoding]::UTF8",
    "$OutputEncoding = [System.Text.Encoding]::UTF8",
    "$ProgressPreference = 'SilentlyContinue'",
    "$ErrorActionPreference = 'Stop'",
    `  $stdoutPath = ${quotePowerShellPath(stdoutPath)}`,
    `  $stderrPath = ${quotePowerShellPath(stderrPath)}`,
    `  $encodedInner = '${encodePowerShellScript(innerScript)}'`,
    // Helper function to read file with BOM detection
    'function Read-FileAutoEncoding($path) {',
    '  if (!(Test-Path $path)) { return "" }',
    '  $raw = [System.IO.File]::ReadAllBytes($path)',
    '  if ($raw.Length -ge 2 -and $raw[0] -eq 0xFF -and $raw[1] -eq 0xFE) {',
    '    return [System.Text.Encoding]::Unicode.GetString($raw, 2, $raw.Length - 2)',
    '  }',
    '  if ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF) {',
    '    return [System.Text.Encoding]::UTF8.GetString($raw, 3, $raw.Length - 3)',
    '  }',
    '  return [System.Text.Encoding]::UTF8.GetString($raw)',
    '}',
    'try {',
    '  $p = Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedInner) -Verb RunAs -Wait -PassThru',
    '  Write-Output (Read-FileAutoEncoding $stdoutPath)',
    '  Write-Output (Read-FileAutoEncoding $stderrPath)',
    '  exit $p.ExitCode',
    '} catch {',
    '  Write-Output $_.Exception.ToString()',
    '  Write-Output (Read-FileAutoEncoding $stdoutPath)',
    '  Write-Output (Read-FileAutoEncoding $stderrPath)',
    '  exit 1',
    '}'
  ].join('\n')
}
