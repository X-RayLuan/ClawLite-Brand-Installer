import { list, put } from '@vercel/blob'

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
  const rand = Math.random().toString(36).slice(2, 14)
  return `${prefix}_${rand}`
}

export function nowIso() {
  return new Date().toISOString()
}

function blobKey(setupToken) {
  return `activation-state-${setupToken}.json`
}

export async function getActivationState(setupToken) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null
  try {
    const { blobs } = await list({ prefix: blobKey(setupToken) })
    if (blobs.length === 0) return null
    const res = await fetch(blobs[0].downloadUrl)
    return res.json()
  } catch {
    return null
  }
}

export async function putActivationState(setupToken, data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log('ACTIVATION_STATE:', setupToken, JSON.stringify(data))
    return
  }
  await put(blobKey(setupToken), JSON.stringify(data), {
    contentType: 'application/json',
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  })
}
