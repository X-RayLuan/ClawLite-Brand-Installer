import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../components/Button'
import type { ActivationFlowSnapshot } from '@shared/activation/types'

interface Props {
  appVersion: string
  platform: 'macos' | 'windows' | 'linux'
  onUseOwnKey: () => void
  onActivationComplete: () => void
}

export default function ActivationStep({
  appVersion,
  platform,
  onUseOwnKey,
  onActivationComplete
}: Props): React.JSX.Element {
  const { t } = useTranslation('steps')
  const [snapshot, setSnapshot] = useState<ActivationFlowSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [emailLinked, setEmailLinked] = useState(false)
  const [manualKeyProvider, setManualKeyProvider] = useState<'clawrouter' | 'ezrouter'>('clawrouter')
  const [manualKeyInput, setManualKeyInput] = useState('')

  const bootstrap = useCallback(
    async (accountId: string): Promise<ActivationFlowSnapshot | null> => {
      setLoading(true)
      setError(null)
      try {
        const state = await window.electronAPI.activation.bootstrap({
          installerInstanceId: 'clawlite-installer',
          platform,
          appVersion,
          accountId
        })
        setSnapshot(state)
        setEmailLinked(true)
        return state
      } catch (e) {
        setError(e instanceof Error ? e.message : t('activation.errors.bootstrap'))
        return null
      } finally {
        setLoading(false)
      }
    },
    [appVersion, platform, t]
  )

  // Auto-detect email from macOS quarantine xattr
  useEffect(() => {
    void window.electronAPI.activation.readInstallEmail().then((detectedEmail) => {
      if (detectedEmail) {
        setEmail(detectedEmail)
        void bootstrap(detectedEmail)
      } else {
        setLoading(false)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runProvisioningChain = useCallback(
    async (current: ActivationFlowSnapshot): Promise<void> => {
      let next = current
      next = await window.electronAPI.activation.provision({ deviceLabel: 'ClawLite Installer' })
      setSnapshot(next)
      next = await window.electronAPI.activation.injectConfig({
        targetConfigPath:
          platform === 'windows' ? '/root/.openclaw/openclaw.json' : '~/.openclaw/openclaw.json'
      })
      setSnapshot(next)
      next = await window.electronAPI.activation.validate({ expectGatewayReachable: true })
      setSnapshot(next)
      if (next.phase === 'completed') {
        onActivationComplete()
      }
    },
    [onActivationComplete, platform]
  )

  // Auto-poll purchase-state when checkout is pending
  useEffect(() => {
    if (snapshot?.phase !== 'purchase_pending') return
    const interval = setInterval(async () => {
      try {
        const next = await window.electronAPI.activation.confirmPurchase()
        setSnapshot(next)
        if (next.phase === 'provisioning') {
          clearInterval(interval)
          await runProvisioningChain(next)
        }
      } catch {
        /* keep polling */
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [snapshot?.phase, runProvisioningChain])

  // --- Buy ClawRouter handlers ---

  const handleBuyClick = async (): Promise<void> => {
    setWorking(true)
    setError(null)
    try {
      // Bootstrap first if not yet linked
      let snap = snapshot
      if (!emailLinked && email.trim()) {
        snap = await bootstrap(email.trim())
      }
      if (!snap) {
        setWorking(false)
        return
      }

      // If already active, go straight to provisioning
      if (snap.purchase.entitlement === 'active') {
        const next = await window.electronAPI.activation.startPurchase({
          path: 'connect_existing_purchase'
        })
        setSnapshot(next)
        if (next.phase === 'provisioning') {
          await runProvisioningChain(next)
        }
      } else {
        const next = await window.electronAPI.activation.startPurchase({ path: 'buy_and_connect' })
        setSnapshot(next)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('activation.errors.generic'))
    } finally {
      setWorking(false)
    }
  }

  const handleOpenCheckout = async (): Promise<void> => {
    if (!snapshot?.purchase.checkoutUrl) return
    const result = await window.electronAPI.system.openExternal(snapshot.purchase.checkoutUrl)
    if (!result.success) {
      setError(result.error ?? 'Failed to open checkout URL.')
    }
  }

  const handleConfirmBuy = async (): Promise<void> => {
    setWorking(true)
    setError(null)
    try {
      const next = await window.electronAPI.activation.confirmPurchase()
      setSnapshot(next)
      if (next.phase === 'provisioning') {
        await runProvisioningChain(next)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('activation.errors.generic'))
    } finally {
      setWorking(false)
    }
  }

  // --- Connect existing key handler ---

  const handleManualKey = async (): Promise<void> => {
    if (!manualKeyInput.trim()) {
      setError('API key is required')
      return
    }
    setWorking(true)
    setError(null)
    try {
      const result = await window.electronAPI.activation.injectManualKey({
        provider: manualKeyProvider,
        apiKey: manualKeyInput.trim(),
        targetConfigPath:
          platform === 'windows' ? '/root/.openclaw/openclaw.json' : '~/.openclaw/openclaw.json'
      })
      if (result.success) {
        onActivationComplete()
      } else {
        setError(result.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to write API key')
    } finally {
      setWorking(false)
    }
  }

  const checkoutPending = snapshot?.phase === 'purchase_pending'

  return (
    <div className="flex-1 flex flex-col min-h-0 px-8 pt-6 pb-6">
      <div className="flex-1 overflow-y-auto pb-10 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold">{t('activation.title')}</h2>
          <p className="text-text-muted text-xs">{t('activation.desc')}</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {/* Card 1: Buy ClawRouter */}
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold">Buy ClawRouter</p>
              <p className="text-xs text-text-muted">
                Get a ClawRouter API key with discounted credits. We'll set everything up for you.
              </p>
            </div>

            {!checkoutPending && (
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="Your email (from clawlite.ai)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button
                  size="sm"
                  onClick={() => void handleBuyClick()}
                  disabled={!email.trim() || working || loading}
                  loading={working}
                >
                  {loading ? 'Checking...' : 'Buy ClawRouter'}
                </Button>
              </div>
            )}

            {checkoutPending && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 space-y-2">
                <p className="text-xs font-bold text-warning">Waiting for payment...</p>
                <p className="text-[11px] text-text-muted/80">
                  Complete the checkout in your browser. This page will update automatically.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleOpenCheckout()} disabled={working}>
                    Open Checkout
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleConfirmBuy()}
                    disabled={working}
                    loading={working}
                  >
                    I Completed Payment
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Connect to ClawRouter / EZRouter */}
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold">Connect to ClawRouter / EZRouter</p>
              <p className="text-xs text-text-muted">
                Already have a ClawRouter or EZRouter API key? Paste it here.
              </p>
            </div>
            <div className="space-y-2">
              <select
                value={manualKeyProvider}
                onChange={(e) =>
                  setManualKeyProvider(e.target.value as 'clawrouter' | 'ezrouter')
                }
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2 text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="clawrouter">ClawRouter</option>
                <option value="ezrouter">EZRouter</option>
              </select>
              <input
                type="text"
                placeholder="or_xxx... or your API key"
                value={manualKeyInput}
                onChange={(e) => setManualKeyInput(e.target.value)}
                className="w-full rounded-xl border border-glass-border bg-white/5 px-3 py-2 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button
                size="sm"
                onClick={() => void handleManualKey()}
                disabled={!manualKeyInput.trim() || working}
                loading={working}
              >
                Save &amp; Continue
              </Button>
            </div>
          </div>

          {/* Card 3: Bring My Own Key */}
          <div className="rounded-2xl border border-glass-border bg-white/5 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold">Bring My Own Key</p>
              <p className="text-xs text-text-muted">
                Use your own API key from OpenAI, Anthropic, or another provider.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onUseOwnKey()}
              disabled={working}
            >
              Configure API Key
            </Button>
          </div>
        </div>

        {error && <p className="text-error text-xs font-medium">{error}</p>}
        {snapshot?.errorMessage && (
          <p className="text-error text-xs font-medium">{snapshot.errorMessage}</p>
        )}
      </div>
    </div>
  )
}
