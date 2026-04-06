import { withCors, generateToken, nowIso, putActivationState } from './_helpers.js'

export default async function handler(req, res) {
  withCors(req, res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { downloadSessionId, installerInstanceId, platform, appVersion } = req.body || {}
  if (!installerInstanceId) {
    return res.status(400).json({ error: 'installerInstanceId is required' })
  }

  const setupToken = generateToken('stp')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  const state = {
    setupToken,
    setupTokenExpiresAt: expiresAt,
    downloadSessionId: downloadSessionId || null,
    installerInstanceId,
    platform: platform || 'unknown',
    appVersion: appVersion || 'unknown',
    accountId: `acct_${generateToken('a')}`,
    emailMasked: 'us***@clawlite.ai',
    entitlementStatus: 'inactive',
    purchaseState: 'not_started',
    purchaseStartedAt: null,
    bindingId: null,
    credentialRef: null,
    createdAt: nowIso()
  }

  try {
    await putActivationState(setupToken, state)
  } catch (e) {
    console.error('Bootstrap state persist error:', e)
  }

  return res.status(200).json({
    setupToken,
    setupTokenExpiresAt: expiresAt,
    account: {
      accountId: state.accountId,
      emailMasked: state.emailMasked
    },
    entitlement: {
      status: 'inactive',
      plan: 'clawrouter'
    },
    allowedPaths: ['buy_and_connect', 'use_own_key'],
    recommendedPath: 'buy_and_connect'
  })
}
