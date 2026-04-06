import { withCors, generateToken, nowIso } from './_helpers.js'

export default async function handler(req, res) {
  withCors(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { setupToken, sellerEmail, seats, note } = req.body || {}
  if (!setupToken) {
    return res.status(400).json({ error: 'setupToken is required' })
  }
  if (!sellerEmail) {
    return res.status(400).json({ error: 'sellerEmail is required' })
  }

  const intakeId = generateToken('resale')

  return res.status(200).json({
    status: 'submitted',
    intakeId,
    reviewUrl: `https://clawlite.ai/resale/${intakeId}`
  })
}
