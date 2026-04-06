import { withCors, generateToken } from './_helpers.js'

export default async function handler(req, res) {
  withCors(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { setupToken, deviceLabel } = req.body || {}
  if (!setupToken) {
    return res.status(400).json({ error: 'setupToken is required' })
  }

  const bindingId = generateToken('bind')
  const credentialRef = `credref_${(deviceLabel || 'device').toLowerCase().replace(/\s+/g, '-')}`

  return res.status(200).json({
    provisioningState: 'bound',
    bindingId,
    credentialRef,
    provider: 'clawrouter',
    model: 'clawrouter/auto'
  })
}
