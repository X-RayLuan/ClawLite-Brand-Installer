const scoreDecodedText = (text: string): number => {
  if (!text) return Number.NEGATIVE_INFINITY

  let score = 0
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code === 0) {
      score -= 10
      continue
    }
    if (code === 0xfffd) {
      score -= 5
      continue
    }
    if ((code >= 0x20 && code <= 0x7e) || ch === '\n' || ch === '\r' || ch === '\t') {
      score += 2
      continue
    }
    if (code >= 0x4e00 && code <= 0x9fff) {
      score += 3
      continue
    }
    if (code < 0x20) {
      score -= 3
      continue
    }
    score += 0.5
  }
  return score / text.length
}

export const decodeWindowsCommandOutput = (buf: Buffer): string => {
  if (buf.length === 0) return ''

  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString('utf16le')
  }

  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8')
  }

  const utf16le = buf.length % 2 === 0 ? buf.toString('utf16le') : ''
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buf)
    if (utf16le && scoreDecodedText(utf16le) > scoreDecodedText(utf8) + 0.5) {
      return utf16le
    }
    return utf8
  } catch {
    if (utf16le && scoreDecodedText(utf16le) > 0) {
      return utf16le
    }
    return new TextDecoder('gb18030').decode(buf)
  }
}
