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

const phaseTone: Record<string, string> = {
  session_binding_pending: 'text-text-muted',
  ready_for_activation: 'text-primary',
  purchase_pending: 'text-warning',
  provisioning: 'text-primary',
  config_injection: 'text-primary',
  validation: 'text-primary',
  completed: 'text-success',
  skipped_to_byok: 'text-text-muted',
  manual_path_only: 'text-text-muted',
  error: 'text-error'
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

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const state = await window.electronAPI.activation.bootstrap({
        installerInstanceId: 'clawlite-installer',
        platform,
        appVersion
      })
      setSnapshot(state)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('activation.errors.bootstrap'))
    } finally {
      setLoading(false)
    }
  }, [appVersion, platform, t])

  useEffect(() => {
    void refresh()
  }, [refresh])

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

  const handleConnectExisting = async (): Promise<void> => {
    setWorking(true)
    setError(null)
    try {
      const next = await window.electronAPI.activation.startPurchase({
        path: 'connect_existing_purchase'
      })
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

  const handleStartBuy = async (): Promise<void> => {
    setWorking(true)
    setError(null)
    try {
      const next = await window.electronAPI.activation.startPurchase({ path: 'buy_and_connect' })
      setSnapshot(next)
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

  const handleOwnKey = async (): Promise<void> => {
    setWorking(true)
    setError(null)
    try {
      const next = await window.electronAPI.activation.useOwnKey()
      setSnapshot(next)
      onUseOwnKey()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('activation.errors.generic'))
    } finally {
      setWorking(false)
    }
  }

  const phaseKey = snapshot?.phase ? `activation.phase.${snapshot.phase}` : null
  const canConnectExisting = snapshot?.allowedPaths.includes('connect_existing_purchase') ?? false
  const canBuyAndConnect = snapshot?.allowedPaths.includes('buy_and_connect') ?? false
  const backendMode = snapshot?.backendMode ?? 'mock'
  const checkoutPending = snapshot?.phase === 'purchase_pending'

  return (
    <div className="flex-1 flex flex-col min-h-0 px-8 pt-6">
      <div className="flex-1 overflow-y-auto pb-2 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">{t('activation.title')}</h2>
              <p className="text-text-muted text-xs">{t('activation.desc')}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                backendMode === 'mock'
                  ? 'bg-warning/15 text-warning'
                  : 'bg-success/15 text-success'
              }`}
            >
              {backendMode === 'mock' ? 'Mock Settlement' : 'Remote API'}
            </span>
          </div>
          <p className="text-[11px] text-text-muted/70">
            Purchase flow, config injection, and validation run locally end-to-end. Payment capture is
            mocked unless a remote activation API is configured.
          </p>
        </div>


        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{t('activation.paths.connectTitle')}</p>
                <p className="text-xs text-text-muted">{t('activation.paths.connectDesc')}</p>
              </div>
              {snapshot?.recommendedPath === 'connect_existing_purchase' && (
                <span className="rounded-full bg-primary/20 px-2.5 py-1 text-[10px] font-bold text-primary">
                  {t('activation.recommended')}
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => void handleConnectExisting()}
              disabled={!canConnectExisting || working || loading}
              loading={working}
            >
              {t('activation.paths.connectCta')}
            </Button>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{t('activation.paths.buyTitle')}</p>
                <p className="text-xs text-text-muted">{t('activation.paths.buyDesc')}</p>
              </div>
              <span className="rounded-full bg-primary/20 px-2.5 py-1 text-[10px] font-bold text-primary">
                {t('activation.recommended')}
              </span>
            </div>

            {!checkoutPending && (
              <Button
                size="sm"
                onClick={() => void handleStartBuy()}
                disabled={!canBuyAndConnect || working || loading}
                loading={working}
              >
                {t('activation.paths.buyCta')}
              </Button>
            )}

            {checkoutPending && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 space-y-2">
                <p className="text-xs font-bold text-warning">Checkout staged</p>
                <p className="text-[11px] text-text-muted/80">
                  This MVP opens a checkout URL, then waits for explicit confirmation before provisioning the
                  installer.
                </p>
                {snapshot?.purchase.checkoutUrl && (
                  <p className="text-[11px] font-mono break-all text-text-muted/80">
                    {snapshot.purchase.checkoutUrl}
                  </p>
                )}
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
                    {backendMode === "mock" ? "Simulate Payment Complete" : "I Completed Payment"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-glass-border bg-white/5 p-4 space-y-2">
            <p className="text-sm font-bold">{t('activation.paths.ownKeyTitle')}</p>
            <p className="text-xs text-text-muted">{t('activation.paths.ownKeyDesc')}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleOwnKey()}
              disabled={working || loading}
            >
              {t('activation.paths.ownKeyCta')}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-glass-border bg-white/5 p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-text-muted/60">
                {t('activation.statusLabel')}
              </p>
              <p
                className={`text-sm font-bold ${phaseTone[snapshot?.phase ?? 'session_binding_pending']}`}
              >
                {loading || !phaseKey ? t('activation.loading') : t(phaseKey)}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={working}>
              {t('activation.refresh')}
            </Button>
          </div>

          {snapshot?.binding.account && (
            <p className="text-xs text-text-muted">
              {t('activation.accountBound', { emailMasked: snapshot.binding.account.emailMasked })}
            </p>
          )}

          {snapshot?.constraints?.length ? (
            <ul className="space-y-1 text-[11px] text-text-muted/80">
              {snapshot.constraints.map((constraint) => (
                <li key={constraint}>• {constraint}</li>
              ))}
            </ul>
          ) : null}
        </div>

  
        {snapshot?.offers?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {snapshot.offers.map((offer) => (
              <div
                key={offer.id}
                className={`rounded-2xl border p-4 space-y-2 ${offer.tag === 'official' ? 'border-primary/30 bg-primary/10' : 'border-warning/30 bg-warning/10'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold">{offer.title}</p>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted/70">
                    {offer.tag}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{offer.summary}</p>
                <div className="grid gap-1 text-[11px] text-text-muted/80">
                  <p>{offer.priceLabel}</p>
                  <p>{offer.settlementLabel}</p>
                  <p>{offer.deliveryEstimate}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {snapshot?.provisioning.credentialRef && (
          <div className="rounded-2xl border border-success/30 bg-success/10 p-4 space-y-1.5">
            <p className="text-sm font-bold text-success">{t('activation.summary.title')}</p>
            <p className="text-xs text-text-muted">
              {t('activation.summary.binding', {
                credentialRef: snapshot.provisioning.credentialRef
              })}
            </p>
            {snapshot.configInjection.configTarget && (
              <p className="text-xs text-text-muted">
                {t('activation.summary.target', {
                  configTarget: snapshot.configInjection.configTarget
                })}
              </p>
            )}
          </div>
        )}

        {error && <p className="text-error text-xs font-medium">{error}</p>}
        {snapshot?.errorMessage && (
          <p className="text-error text-xs font-medium">{snapshot.errorMessage}</p>
        )}
      </div>
    </div>
  )
}
