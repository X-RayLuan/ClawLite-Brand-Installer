const ALLOWED_ORIGINS = ['https://clawlite.ai', 'https://www.clawlite.ai']

export function withCors(req, res) {
  const origin = req.headers.origin
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export function generateToken(prefix) {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${ts}_${rand}`
}

export function tokenTimestamp(token) {
  const parts = token.split('_')
  if (parts.length < 2) return null
  const ts = parseInt(parts[1], 36)
  return isNaN(ts) ? null : ts
}

export function nowIso() {
  return new Date().toISOString()
}
