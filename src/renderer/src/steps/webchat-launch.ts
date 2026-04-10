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
  const urls = ['http://127.0.0.1:18789/', 'http://127.0.0.1:18791/']

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const checks = await Promise.all(urls.map((url) => probeUrl(url)))
    if (checks.every(Boolean)) {
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
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
  attempts?: number
  delayMs?: number
  sleep?: (ms: number) => Promise<void>
}): Promise<{ success: boolean; error?: string; token?: string }> {
  const token = await waitForStableGatewayToken({
    initialToken: params.initialToken,
    readConfig: params.readConfig,
    attempts: params.attempts,
    delayMs: params.delayMs,
    sleep: params.sleep
  })

  if (!token) {
    return { success: false, error: 'Web Chat token missing. Please re-run setup or switch provider.' }
  }

  const servicesReady = await waitForWebChatServicesReady({
    probeUrl: params.probeUrl,
    attempts: params.attempts,
    delayMs: params.delayMs,
    sleep: params.sleep
  })
  if (!servicesReady) {
    return { success: false, error: 'Web Chat server is not ready yet. Please keep waiting.' }
  }

  const opened = await params.openExternal(buildWebChatUrl(token))
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
