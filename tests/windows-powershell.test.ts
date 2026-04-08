import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildElevatedWslInstallScript,
  buildEncodedPowerShellArgs,
  sanitizePowerShellErrorOutput,
  summarizeElevatedPowerShellFailure
} from '../src/main/services/windows-powershell.ts'

test('buildElevatedWslInstallScript uses an explicit wsl.exe path and argument array', () => {
  const script = buildElevatedWslInstallScript('C:/temp/wsl.stdout.log', 'C:/temp/wsl.stderr.log')
  const encodedInnerMatch = script.match(/\$encodedInner = '([^']+)'/)
  assert.ok(encodedInnerMatch)
  const innerScript = Buffer.from(encodedInnerMatch[1], 'base64').toString('utf16le')

  assert.match(
    script,
    /Start-Process -FilePath "powershell\.exe" -ArgumentList @\("-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", \$encodedInner\) -Verb RunAs -Wait -PassThru/
  )
  assert.match(script, /\$stdoutPath = 'C:\/temp\/wsl\.stdout\.log'/)
  assert.match(script, /\$stderrPath = 'C:\/temp\/wsl\.stderr\.log'/)
  assert.match(script, /\$resultPath = 'C:\/temp\/wsl\.stdout\.log\.result\.json'/)
  assert.match(script, /\$ProgressPreference = 'SilentlyContinue'/)
  assert.match(innerScript, /\$resultPath = 'C:\/temp\/wsl\.stdout\.log\.result\.json'/)
  assert.match(innerScript, /\$attempts = @\(/)
  assert.match(innerScript, /\$PSNativeCommandUseErrorActionPreference = \$false/)
  assert.match(innerScript, /@{ name = "install-no-launch"; args = @\("--install", "-d", "Ubuntu", "--no-launch"\) }/)
  assert.match(innerScript, /@{ name = "install-distro"; args = @\("--install", "-d", "Ubuntu"\) }/)
  assert.match(innerScript, /@{ name = "install-bare"; args = @\("--install"\) }/)
  assert.match(innerScript, /& wsl\.exe @\(\$attempt\.args\) 1> \$stdoutPath 2> \$stderrPath/)
  assert.match(innerScript, /ConvertTo-Json -Depth 6/)
  assert.match(innerScript, /WriteAllText\(\$resultPath, \$resultJson, \[System\.Text\.Encoding]::UTF8\)/)
  assert.doesNotMatch(innerScript, /2>&1 \| Out-String/)
  assert.doesNotMatch(script, /-RedirectStandardOutput/)
  assert.doesNotMatch(script, /FilePath 'wsl"/)
})

test('buildEncodedPowerShellArgs preserves the script when decoded from UTF-16LE base64', () => {
  const script = buildElevatedWslInstallScript('C:/temp/wsl.stdout.log', 'C:/temp/wsl.stderr.log')
  const args = buildEncodedPowerShellArgs(script)

  assert.deepEqual(args.slice(0, 2), ['-NoProfile', '-EncodedCommand'])
  assert.equal(Buffer.from(args[2], 'base64').toString('utf16le'), script)
})

test('sanitizePowerShellErrorOutput removes encoded command noise and CLIXML payloads', () => {
  const raw = `Command failed: powershell -NoProfile -EncodedCommand ABCDEFGH IJKLMNOP QRSTUVWX (exit 1)\n#< CLIXML\n<Objs Version="1.1.0.1"><Obj>noise</Obj></Objs>\nWSL install failed with code 0x80370102`

  assert.equal(
    sanitizePowerShellErrorOutput(raw),
    'WSL install failed with code 0x80370102'
  )
})

test('summarizeElevatedPowerShellFailure reports missing child output instead of only encoded command noise', () => {
  const summary = summarizeElevatedPowerShellFailure({
    fileStdout: '',
    fileStderr: '',
    errLines: '',
    errMsg: 'Command failed: powershell.exe -NoProfile -EncodedCommand ABCDEFGH (exit 1)',
    stdoutExists: false,
    stderrExists: false,
    stdoutSize: 0,
    stderrSize: 0
  })

  assert.match(summary, /No elevated PowerShell output was captured/i)
  assert.match(summary, /stdout log: missing \(0 bytes\)/i)
  assert.match(summary, /stderr log: missing \(0 bytes\)/i)
  assert.doesNotMatch(summary, /\[encoded command hidden\]$/)
})
