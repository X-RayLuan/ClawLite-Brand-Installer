import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildElevatedWslInstallScript,
  buildEncodedPowerShellArgs,
  sanitizePowerShellErrorOutput
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
  assert.match(script, /\$ProgressPreference = 'SilentlyContinue'/)
  assert.match(innerScript, /wsl\.exe --install -d Ubuntu --no-launch 1> \$stdoutPath 2> \$stderrPath/)
  assert.match(innerScript, /if \(\$LASTEXITCODE -ne 0\) \{\n  wsl\.exe --install -d Ubuntu 1> \$stdoutPath 2> \$stderrPath/)
  assert.match(innerScript, /wsl\.exe --install -d Ubuntu 1> \$stdoutPath 2> \$stderrPath/)
  assert.match(innerScript, /wsl\.exe --install 1> \$stdoutPath 2> \$stderrPath/)
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
