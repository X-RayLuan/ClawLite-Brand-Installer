import { list, put } from '@vercel/blob'

const BLOB_FILENAME = 'mvp-sessions.json'
const ALLOWED_ORIGINS = ['https://clawlite.ai', 'https://www.clawlite.ai']

async function getSessions() {
  const { blobs } = await list({ prefix: BLOB_FILENAME })
  if (blobs.length === 0) return []
  const res = await fetch(blobs[0].downloadUrl)
  return res.json()
}

async function putSessions(records) {
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

  const { sessionId, platform = 'unknown', appVersion = 'unknown', source } = req.body || {}
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log('MVP_SESSION:', { sessionId, platform, appVersion, source })
    return res.status(200).json({ success: true, mock: true })
  }

  try {
    const now = new Date().toISOString()
    const records = await getSessions()
    const index = records.findIndex((r) => r.sessionId === sessionId)

    if (index >= 0) {
      records[index] = {
        ...records[index],
        platform: records[index].platform || platform,
        appVersion: records[index].appVersion || appVersion,
        source: records[index].source || source,
        updatedAt: now
      }
    } else {
      records.push({
        sessionId,
        platform,
        appVersion,
        source,
        createdAt: now,
        updatedAt: now
      })
    }

    await putSessions(records)
    return res.status(200).json({ success: true })
  } catch (e) {
    console.error('MVP session store error:', e)
    return res.status(500).json({ error: 'Server error. Please try again later.' })
  }
}
