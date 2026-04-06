import { withCors, nowIso, getActivationState, putActivationState } from './_helpers.js'

export default async function handler(req, res) {
  withCors(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { setupToken, intent } = req.body || {}
  if (!setupToken) {
    return res.status(400).json({ error: 'setupToken is required' })
  }

  const state = await getActivationState(setupToken)
  if (!state) {
    return res.status(404).json({ error: 'Setup token not found' })
  }

  state.purchaseState = 'checkout_pending'
  state.purchaseStartedAt = nowIso()

  try {
    await putActivationState(setupToken, state)
  } catch (e) {
    console.error('Purchase state persist error:', e)
  }

  return res.status(200).json({
    purchaseState: 'checkout_pending',
    checkoutUrl: `https://clawlite.ai/checkout/${setupToken}`,
    pollAfterMs: 2500
  })
}
