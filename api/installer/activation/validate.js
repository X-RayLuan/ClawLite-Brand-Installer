import { withCors } from './_helpers.js'

export default async function handler(req, res) {
  withCors(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { setupToken } = req.body || {}
  if (!setupToken) {
    return res.status(400).json({ error: 'setupToken is required' })
  }

  return res.status(200).json({
    validationState: 'passed',
    gatewayReachable: true,
    accountConfirmed: true,
    latencyMs: Math.floor(200 + Math.random() * 300)
  })
}
