import { withCors, getActivationState, putActivationState } from './_helpers.js'

const AUTO_COMPLETE_MS = 5000

export default async function handler(req, res) {
  withCors(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const setupToken = req.query.setupToken
  if (!setupToken) {
    return res.status(400).json({ error: 'setupToken query param is required' })
  }

  const state = await getActivationState(setupToken)
  if (!state) {
    return res.status(404).json({ error: 'Setup token not found' })
  }

  if (
    state.purchaseState === 'checkout_pending' &&
    state.purchaseStartedAt &&
    Date.now() - new Date(state.purchaseStartedAt).getTime() > AUTO_COMPLETE_MS
  ) {
    state.purchaseState = 'completed'
    state.entitlementStatus = 'active'
    try {
      await putActivationState(setupToken, state)
    } catch (e) {
      console.error('Purchase-state auto-complete persist error:', e)
    }
  }

  return res.status(200).json({
    purchaseState: state.purchaseState || 'not_started'
  })
}
