import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildElevatedWslInstallScript,
  buildEncodedPowerShellArgs
} from '../src/main/services/windows-powershell.ts'

test('buildElevatedWslInstallScript uses an explicit wsl.exe path and argument array', () => {
  const script = buildElevatedWslInstallScript()

  assert.match(script, /\$argList = @\("--install", "-d", "Ubuntu", "--no-launch"\)/)
  assert.match(script, /Start-Process -FilePath "wsl\.exe" -ArgumentList \$argList -Verb RunAs -Wait -PassThru/)
  assert.doesNotMatch(script, /FilePath 'wsl"/)
})

test('buildEncodedPowerShellArgs preserves the script when decoded from UTF-16LE base64', () => {
  const script = buildElevatedWslInstallScript()
  const args = buildEncodedPowerShellArgs(script)

  assert.deepEqual(args.slice(0, 2), ['-NoProfile', '-EncodedCommand'])
  assert.equal(Buffer.from(args[2], 'base64').toString('utf16le'), script)
})
