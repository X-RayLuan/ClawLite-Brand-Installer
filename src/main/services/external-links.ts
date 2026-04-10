export function isAllowedExternalUrl(url: string): boolean {
  const parsed = new URL(url)
  const isHttps = parsed.protocol === 'https:'
  const isTelegram = parsed.protocol === 'tg:'
  const isLocalWebChat =
    parsed.protocol === 'http:' &&
    (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') &&
    (parsed.port === '18789' || parsed.port === '18791')

  return isHttps || isTelegram || isLocalWebChat
}
