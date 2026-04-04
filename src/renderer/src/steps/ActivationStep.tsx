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

  const runConnectFlow = async (
    mode: 'connect_existing_purchase' | 'buy_and_connect'
  ): Promise<void> => {
    setWorking(true)
    setError(null)
    try {
      let next = await window.electronAPI.activation.startPurchase({ path: mode })
      setSnapshot(next)

      if (mode === 'buy_and_connect') {
        next = await window.electronAPI.activation.confirmPurchase()
        setSnapshot(next)
      }

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

  return (
    <div className="flex-1 flex flex-col min-h-0 px-8 pt-6">
      <div className="flex-1 overflow-y-auto pb-2 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold">{t('activation.title')}</h2>
          <p className="text-text-muted text-xs">{t('activation.desc')}</p>
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

        <div className="grid gap-3">
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
              onClick={() => void runConnectFlow('connect_existing_purchase')}
              disabled={!canConnectExisting || working || loading}
              loading={working}
            >
              {t('activation.paths.connectCta')}
            </Button>
          </div>

          <div className="rounded-2xl border border-glass-border bg-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{t('activation.paths.buyTitle')}</p>
                <p className="text-xs text-text-muted">{t('activation.paths.buyDesc')}</p>
              </div>
              {snapshot?.recommendedPath === 'buy_and_connect' && (
                <span className="rounded-full bg-primary/20 px-2.5 py-1 text-[10px] font-bold text-primary">
                  {t('activation.recommended')}
                </span>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void runConnectFlow('buy_and_connect')}
              disabled={!canBuyAndConnect || working || loading}
              loading={working}
            >
              {t('activation.paths.buyCta')}
            </Button>
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
