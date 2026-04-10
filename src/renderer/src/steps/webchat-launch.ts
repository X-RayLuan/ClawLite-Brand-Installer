export function buildWebChatUrl(token: string): string {
  return `http://127.0.0.1:18789/#token=${encodeURIComponent(token)}`
}

const WEBCHAT_CONTROL_HOST = '127.0.0.1'
const WEBCHAT_CONTROL_PORT = 18789

interface ConfigReadResult {
  success: boolean
  config?: {
    gatewayToken?: string
  } | null
}

type WebChatLaunchEvent =
  | { type: 'token_stable'; token: string }
  | { type: 'probe_result'; target: string; ready: boolean }
  | { type: 'open_external_start'; url: string }
  | { type: 'open_external_result'; url: string; success: boolean; error?: string }

async function defaultProbePort(_port: number): Promise<boolean> {
  return false
}

function normalizeToken(token: string | null | undefined): string | null {
  const normalized = token?.trim()
  return normalized ? normalized : null
}

export async function waitForStableGatewayToken(params: {
  initialToken: string | null
  readConfig: () => Promise<ConfigReadResult>
  onEvent?: (event: WebChatLaunchEvent) => void
  attempts?: number
  delayMs?: number
  sleep?: (ms: number) => Promise<void>
}): Promise<string | null> {
  const attempts = params.attempts ?? 8
  const delayMs = params.delayMs ?? 400
  const sleep =
    params.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  let lastToken = normalizeToken(params.initialToken)
  let stableReads = lastToken ? 1 : 0

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await params.readConfig()
    const nextToken = normalizeToken(result.config?.gatewayToken)

    if (nextToken && nextToken === lastToken) {
      stableReads += 1
      if (stableReads >= 2) {
        params.onEvent?.({ type: 'token_stable', token: nextToken })
        return nextToken
      }
    } else if (nextToken) {
      lastToken = nextToken
      stableReads = 1
    } else {
      lastToken = null
      stableReads = 0
    }

    if (attempt < attempts - 1) {
      await sleep(delayMs)
    }
  }

  return null
}

export async function waitForWebChatServicesReady(params: {
  probePort?: (port: number) => Promise<boolean>
  onEvent?: (event: WebChatLaunchEvent) => void
  attempts?: number
  delayMs?: number
  sleep?: (ms: number) => Promise<void>
}): Promise<boolean> {
  const probePort = params.probePort ?? defaultProbePort
  const attempts = params.attempts ?? 10
  const delayMs = params.delayMs ?? 400
  const sleep =
    params.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const target = `${WEBCHAT_CONTROL_HOST}:${WEBCHAT_CONTROL_PORT}`

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const ready = await probePort(WEBCHAT_CONTROL_PORT)
    params.onEvent?.({ type: 'probe_result', target, ready })
    if (ready) {
      return true
    }

    if (attempt < attempts - 1) {
      await sleep(delayMs)
    }
  }

  return false
}

export async function openWebChatExternally(params: {
  initialToken: string | null
  readConfig: () => Promise<ConfigReadResult>
  probePort?: (port: number) => Promise<boolean>
  onEvent?: (event: WebChatLaunchEvent) => void
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
  attempts?: number
  delayMs?: number
  sleep?: (ms: number) => Promise<void>
}): Promise<{ success: boolean; error?: string; token?: string }> {
  const token = await waitForStableGatewayToken({
    initialToken: params.initialToken,
    readConfig: params.readConfig,
    onEvent: params.onEvent,
    attempts: params.attempts,
    delayMs: params.delayMs,
    sleep: params.sleep
  })

  if (!token) {
    return { success: false, error: 'Web Chat token missing. Please re-run setup or switch provider.' }
  }

  const servicesReady = await waitForWebChatServicesReady({
    probePort: params.probePort,
    onEvent: params.onEvent,
    attempts: params.attempts,
    delayMs: params.delayMs,
    sleep: params.sleep
  })
  if (!servicesReady) {
    return { success: false, error: 'Web Chat server is not ready yet. Please keep waiting.' }
  }

  const url = buildWebChatUrl(token)
  params.onEvent?.({ type: 'open_external_start', url })
  const opened = await params.openExternal(url)
  params.onEvent?.({
    type: 'open_external_result',
    url,
    success: opened.success,
    error: opened.error
  })
  if (!opened.success) {
    return { success: false, error: opened.error || 'Failed to open Web Chat in your browser.' }
  }

  return { success: true, token }
}

export function shouldResetMainSessionOnOpen(params: {
  freshSessionRequested: boolean
  freshSessionConsumed: boolean
}): boolean {
  return params.freshSessionRequested && !params.freshSessionConsumed
}
