import { list, put } from '@vercel/blob'

const BLOB_FILENAME = 'mvp-events.json'
const ALLOWED_ORIGINS = ['https://clawlite.ai', 'https://www.clawlite.ai']
const ALLOWED_EVENT_TYPES = [
  'step_view',
  'step_complete',
  'lead_submit',
  'install_start',
  'install_done',
  'error'
]

async function getEvents() {
  const { blobs } = await list({ prefix: BLOB_FILENAME })
  if (blobs.length === 0) return []
  const res = await fetch(blobs[0].downloadUrl)
  return res.json()
}

async function putEvents(records) {
  await put(BLOB_FILENAME, JSON.stringify(records), {
    contentType: 'application/json',
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0
  })
}

function withCors(req, res) {
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  withCors(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { sessionId, eventType, step, payload } = req.body || {}
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' })
  }
  if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
    return res.status(400).json({ error: 'Invalid eventType' })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log('MVP_EVENT:', { sessionId, eventType, step, payload })
    return res.status(200).json({ success: true, mock: true })
  }

  try {
    const records = await getEvents()
    records.push({
      id: crypto.randomUUID(),
      sessionId,
      eventType,
      step,
      payload: payload || null,
      createdAt: new Date().toISOString()
    })

    await putEvents(records)
    return res.status(200).json({ success: true })
  } catch (e) {
    console.error('MVP event store error:', e)
    return res.status(500).json({ error: 'Server error. Please try again later.' })
  }
}
