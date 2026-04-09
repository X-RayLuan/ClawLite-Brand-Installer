export function buildWebChatUrl(token: string): string {
  const params = new URLSearchParams({
    gatewayUrl: 'ws://127.0.0.1:18789',
    token
  })
  return `http://127.0.0.1:18791/#${params.toString()}`
}

export function shouldResetMainSessionOnOpen(params: {
  freshSessionRequested: boolean
  freshSessionConsumed: boolean
}): boolean {
  return params.freshSessionRequested && !params.freshSessionConsumed
}
