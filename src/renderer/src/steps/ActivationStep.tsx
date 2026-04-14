import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { continueManagedActivation } from './activation-managed-flow'

interface ActivationStepProps {
  onActivationComplete: () => void
  onUseOwnKey: () => void
  platform: 'macos' | 'windows' | 'linux'
  appVersion: string
}

const ADD_CREDITS_URL = 'https://clawlite.ai/clawrouter/api'

export default function ActivationStep({
  onActivationComplete,
  onUseOwnKey,
  platform,
  appVersion
}: ActivationStepProps): React.JSX.Element {
  const { t } = useTranslation()
  const [opening, setOpening] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddCredits = async (): Promise<void> => {
    setOpening(true)
    setError(null)
    try {
      const result = await window.electronAPI.system.openExternal(ADD_CREDITS_URL)
      if (!result.success) {
        setError(result.error || 'Failed to open ClawRouter credits page.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open ClawRouter credits page.')
    } finally {
      setOpening(false)
    }
  }

  const handleContinueManagedSetup = async (): Promise<void> => {
    setContinuing(true)
    setError(null)
    try {
      const installEmail = await window.electronAPI.activation.readInstallEmail().catch(() => null)
      const result = await continueManagedActivation({
        accountId: installEmail || undefined,
        appVersion,
        platform,
        api: {
          bootstrap: (input) => window.electronAPI.activation.bootstrap(input),
          startPurchase: (input) => window.electronAPI.activation.startPurchase(input),
          provision: (input) => window.electronAPI.activation.provision(input),
          injectConfig: (input) => window.electronAPI.activation.injectConfig(input),
          validate: (input) => window.electronAPI.activation.validate(input)
        }
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      onActivationComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ClawRouter activation failed.')
    } finally {
      setContinuing(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 px-8 pt-6 pb-6">
      <div className="flex-1 overflow-y-auto pb-10 space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold">{t('activation.title')}</h2>
          <p className="text-text-muted text-xs">{t('activation.desc')}</p>
        </div>

        {/* Primary: Add Credits */}
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/20 px-2 py-0.5 rounded-full">
              Recommended
            </span>
          </div>
          <h3 className="text-base font-bold">Get ClawRouter Credits</h3>
          <p className="text-text-muted text-xs leading-relaxed">
            Add credits to your ClawRouter account to start using managed AI routing with cheaper token pricing.
          </p>
          <button
            onClick={handleAddCredits}
            disabled={opening}
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {opening ? 'Opening...' : 'Add Credits →'}
          </button>
        </div>

        {/* Secondary: Continue after adding credits */}
        <button
          onClick={() => void handleContinueManagedSetup()}
          disabled={continuing}
          className="w-full py-2.5 rounded-xl text-sm font-semibold border border-glass-border text-text hover:bg-bg-card-hover transition-colors disabled:opacity-50"
        >
          {continuing ? 'Connecting ClawRouter...' : "I've added credits — continue setup →"}
        </button>

        {/* Tertiary: Use own API key */}
        <div className="rounded-2xl border border-glass-border bg-bg-card p-5 space-y-3">
          <h3 className="text-base font-bold">Use My Own API Key</h3>
          <p className="text-text-muted text-xs leading-relaxed">
            Already have an OpenAI, Anthropic, or other provider key? Skip ClawRouter and configure your own.
          </p>
          <button
            onClick={onUseOwnKey}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-glass-border text-text-muted hover:bg-bg-card-hover transition-colors"
          >
            Use My Own API Key →
          </button>
        </div>

        {error && <p className="text-error text-xs font-medium">{error}</p>}
      </div>
    </div>
  )
}
