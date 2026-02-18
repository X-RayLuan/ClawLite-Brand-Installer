import { spawn } from 'child_process'
import { platform } from 'os'
import { join } from 'path'

const getPathEnv = (): NodeJS.ProcessEnv => ({
  ...process.env,
  PATH: [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    `${process.env.HOME}/.nvm/versions/node`,
    `${process.env.HOME}/.volta/bin`,
    process.env.PATH ?? ''
  ].join(':')
})

const getNpmGlobalBin = (): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn('npm', ['prefix', '-g'], { env: getPathEnv() })
    let out = ''
    child.stdout.on('data', (d) => (out += d.toString()))
    child.on('close', (code) => (code === 0 ? resolve(join(out.trim(), 'bin')) : reject()))
    child.on('error', reject)
  })

const runGateway = async (args: string[]): Promise<string> => {
  const isWindows = platform() === 'win32'
  const openclaw = isWindows
    ? 'openclaw'
    : join(await getNpmGlobalBin(), 'openclaw')
  const cmd = isWindows ? 'wsl' : openclaw
  const fullArgs = isWindows
    ? ['--', 'openclaw', 'gateway', ...args]
    : ['gateway', ...args]

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, fullArgs, {
      shell: isWindows,
      env: getPathEnv()
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(stderr || `exit code ${code}`))
    })
    child.on('error', reject)
  })
}

export const startGateway = (): Promise<string> => runGateway(['start'])

export const stopGateway = (): Promise<string> => runGateway(['stop'])

export const getGatewayStatus = async (): Promise<'running' | 'stopped'> => {
  try {
    const output = await runGateway(['status'])
    return output.toLowerCase().includes('running') ? 'running' : 'stopped'
  } catch {
    return 'stopped'
  }
}
