const WSL_OPENCLAW_CANDIDATES = [
  '/root/.npm-global/bin/openclaw',
  '/usr/local/bin/openclaw',
  '/usr/bin/openclaw'
]

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`

export function buildWslOpenClawWrapper(): string {
  const candidateChecks = WSL_OPENCLAW_CANDIDATES.map(
    (candidate) => `elif [ -x ${shellQuote(candidate)} ]; then OPENCLAW_BIN=${shellQuote(candidate)}`
  ).join('\n')

  return [
    'if command -v openclaw >/dev/null 2>&1; then',
    '  OPENCLAW_BIN="$(command -v openclaw)"',
    candidateChecks,
    'else',
    "  echo 'openclaw CLI not found in WSL' >&2",
    '  exit 127',
    'fi'
  ].join('\n')
}

export function buildWslOpenClawShellCommand(args: string[]): string {
  const quotedArgs = args.map(shellQuote).join(' ')
  return `${buildWslOpenClawWrapper()}\n"$OPENCLAW_BIN" ${quotedArgs}`
}

export function buildWslOpenClawCommandArgs(
  args: string[],
  options: {
    distro?: string
    user?: string
  } = {}
): string[] {
  const distro = options.distro ?? 'Ubuntu'
  const user = options.user ?? 'root'
  return ['-d', distro, '-u', user, '--', 'bash', '-lc', buildWslOpenClawShellCommand(args)]
}
