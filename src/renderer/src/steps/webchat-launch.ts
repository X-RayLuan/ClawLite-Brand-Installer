export function buildWebChatUrl(token: string): string {
  return `http://127.0.0.1:18789/#token=${encodeURIComponent(token)}`
}

export function shouldResetMainSessionOnOpen(params: {
  freshSessionRequested: boolean
  freshSessionConsumed: boolean
}): boolean {
  return params.freshSessionRequested && !params.freshSessionConsumed
}
