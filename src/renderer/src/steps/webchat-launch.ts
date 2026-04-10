export function buildWebChatUrl(token: string): string {
  const params = new URLSearchParams({
    gatewayUrl: 'ws://127.0.0.1:18789',
    token
  })
  return `http://127.0.0.1:18791/#${params.toString()}`
}

interface ConfigReadResult {
  success: boolean
  config?: {
    gatewayToken?: string
  } | null
}

type WebChatLaunchEvent =
  | { type: 'token_stable'; token: string }
  | { type: 'probe_result'; url: string; ready: boolean }
  | { type: 'open_external_start'; url: string }
  | { type: 'open_external_result'; url: string; success: boolean; error?: string }

async function defaultProbeUrl(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1000)

  try {
    await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
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
  probeUrl?: (url: string) => Promise<boolean>
  onEvent?: (event: WebChatLaunchEvent) => void
  attempts?: number
  delayMs?: number
  sleep?: (ms: number) => Promise<void>
}): Promise<boolean> {
  const probeUrl = params.probeUrl ?? defaultProbeUrl
  const attempts = params.attempts ?? 10
  const delayMs = params.delayMs ?? 400
  const sleep =
    params.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const url = 'http://127.0.0.1:18791/'

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const ready = await probeUrl(url)
    params.onEvent?.({ type: 'probe_result', url, ready })
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
  probeUrl?: (url: string) => Promise<boolean>
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
    probeUrl: params.probeUrl,
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
