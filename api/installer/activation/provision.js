import { withCors, generateToken, getActivationState, putActivationState } from './_helpers.js'

export default async function handler(req, res) {
  withCors(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { setupToken, deviceLabel, platform } = req.body || {}
  if (!setupToken) {
    return res.status(400).json({ error: 'setupToken is required' })
  }

  const state = await getActivationState(setupToken)
  if (!state) {
    return res.status(404).json({ error: 'Setup token not found' })
  }

  if (state.entitlementStatus !== 'active') {
    return res.status(400).json({ error: 'Entitlement is not active' })
  }

  const bindingId = generateToken('bind')
  const credentialRef = `credref_${(deviceLabel || 'device').toLowerCase().replace(/\s+/g, '-')}`

  state.bindingId = bindingId
  state.credentialRef = credentialRef

  try {
    await putActivationState(setupToken, state)
  } catch (e) {
    console.error('Provision state persist error:', e)
  }

  return res.status(200).json({
    provisioningState: 'bound',
    bindingId,
    credentialRef,
    provider: 'clawrouter',
    model: 'clawrouter/auto'
  })
}
