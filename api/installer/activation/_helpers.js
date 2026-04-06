import { list, put } from '@vercel/blob'

const ALLOWED_ORIGINS = ['https://clawlite.ai', 'https://www.clawlite.ai']
const fallbackMemoryStore = new Map()

function isFallbackAllowed() {
  return process.env.NODE_ENV !== 'production'
}

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

export function isActivationStatePersisted() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN) || isFallbackAllowed()
}

export async function getActivationState(setupToken) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (isFallbackAllowed()) {
      return fallbackMemoryStore.get(setupToken) || null
    }
    console.error('BLOB_READ_WRITE_TOKEN missing; cannot read activation state')
    return null
  }

  try {
    const { blobs } = await list({ prefix: blobKey(setupToken) })
    if (blobs.length === 0) return null
    const res = await fetch(blobs[0].downloadUrl)
    return res.json()
  } catch (error) {
    console.error('Failed to read activation state:', error)
    return null
  }
}

export async function putActivationState(setupToken, data) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (isFallbackAllowed()) {
      fallbackMemoryStore.set(setupToken, data)
      return
    }
    throw new Error('BLOB_READ_WRITE_TOKEN is required for activation state persistence')
  }
  await put(blobKey(setupToken), JSON.stringify(data), {
    contentType: 'application/json',
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  })
}
