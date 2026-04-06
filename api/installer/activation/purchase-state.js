import { withCors, tokenTimestamp } from './_helpers.js'

const AUTO_COMPLETE_MS = 5000

export default async function handler(req, res) {
  withCors(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const setupToken = req.query.setupToken
  if (!setupToken) {
    return res.status(400).json({ error: 'setupToken query param is required' })
  }

  const createdAt = tokenTimestamp(setupToken)
  if (createdAt && Date.now() - createdAt > AUTO_COMPLETE_MS) {
    return res.status(200).json({ purchaseState: 'completed' })
  }

  return res.status(200).json({ purchaseState: 'checkout_pending' })
}
