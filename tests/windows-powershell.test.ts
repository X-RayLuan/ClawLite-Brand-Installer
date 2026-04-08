import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildElevatedWslInstallScript,
  buildEncodedPowerShellArgs
} from '../src/main/services/windows-powershell.ts'

test('buildElevatedWslInstallScript uses an explicit wsl.exe path and argument array', () => {
  const script = buildElevatedWslInstallScript('C:/temp/wsl.stdout.log', 'C:/temp/wsl.stderr.log')

  assert.match(
    script,
    /Start-Process -FilePath "powershell\.exe" -ArgumentList @\("-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", \$encodedInner\) -Verb RunAs -Wait -PassThru -RedirectStandardOutput \$stdoutPath -RedirectStandardError \$stderrPath/
  )
  assert.match(script, /\$stdoutPath = 'C:\/temp\/wsl\.stdout\.log'/)
  assert.match(script, /\$stderrPath = 'C:\/temp\/wsl\.stderr\.log'/)
  assert.match(script, /\$ProgressPreference = 'SilentlyContinue'/)
  assert.doesNotMatch(script, /FilePath 'wsl"/)
})

test('buildEncodedPowerShellArgs preserves the script when decoded from UTF-16LE base64', () => {
  const script = buildElevatedWslInstallScript('C:/temp/wsl.stdout.log', 'C:/temp/wsl.stderr.log')
  const args = buildEncodedPowerShellArgs(script)

  assert.deepEqual(args.slice(0, 2), ['-NoProfile', '-EncodedCommand'])
  assert.equal(Buffer.from(args[2], 'base64').toString('utf16le'), script)
})
