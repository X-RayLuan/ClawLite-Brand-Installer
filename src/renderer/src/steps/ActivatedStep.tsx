import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../components/Button'
import type { LicenseType } from '../hooks/useActivation'

function maskApiKey(key: string): string {
  if (key.length <= 8) return '*'.repeat(key.length)
  return key.slice(0, 4) + '*'.repeat(key.length - 8) + key.slice(-4)
}

interface Props {
  info: {
    email: string
    licenseType?: LicenseType
    expiresAt?: string | null
    apiKey: string
    baseUrl: string
    balanceUsd?: number
  }
  onLogout: () => void
  onLaunch: () => void
  loading: boolean
}

export default function ActivatedStep({
  info,
  onLogout,
  onLaunch,
  loading
}: Props): React.JSX.Element {
  const { t } = useTranslation('steps')

  const maskedKey = maskApiKey(info.apiKey)
  const balance =
    typeof info.balanceUsd === 'number' ? `$${info.balanceUsd.toFixed(2)}` : '—'
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const handleCopyKey = (): void => {
    navigator.clipboard.writeText(info.apiKey).then(() => {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    })
  }

  const handleCopyUrl = (): void => {
    navigator.clipboard.writeText(info.baseUrl).then(() => {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    })
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Success icon */}
      <div className="relative">
        <div className="absolute inset-0 bg-success/10 rounded-full blur-2xl scale-125" />
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
              stroke="var(--color-success)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <polyline
              points="22 4 12 14.01 9 11.01"
              stroke="var(--color-success)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <h3 className="text-base font-black tracking-tight">{t('activation.activated.title')}</h3>
        <p className="text-text-muted text-xs mt-0.5">{t('activation.activated.subtitle')}</p>
      </div>

      {/* Account info card */}
      <div className="w-full rounded-2xl bg-white/5 border border-glass-border p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted/60">{t('activation.activated.email')}</span>
          <span className="text-sm font-semibold truncate max-w-[160px]" title={info.email}>
            {info.email}
          </span>
        </div>
        <div className="h-px bg-glass-border" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted/60">{t('activation.activated.balance')}</span>
          <span className="text-sm font-semibold text-success">{balance}</span>
        </div>
        <div className="h-px bg-glass-border" />
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-text-muted/60 shrink-0">{t('activation.activated.apiKey')}</span>
          <div className="flex items-start gap-1">
            <code className="text-xs font-mono text-text-muted/80 break-all">{maskedKey}</code>
            <button
              onClick={handleCopyKey}
              className="p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title={t('activation.activated.copyKey')}
            >
              {copiedKey ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <polyline points="20 6 9 17 4 12" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div className="h-px bg-glass-border" />
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-text-muted/60 shrink-0">{t('activation.activated.baseUrl')}</span>
          <div className="flex items-start gap-1">
            <code className="text-xs font-mono text-text-muted/80 break-all">{info.baseUrl}</code>
            <button
              onClick={handleCopyUrl}
              className="p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title={t('activation.activated.copyUrl')}
            >
              {copiedUrl ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <polyline points="20 6 9 17 4 12" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full flex flex-col gap-2">
        <Button variant="primary" size="sm" onClick={onLaunch} className="w-full font-bold text-sm">
          {t('activation.activated.launch')}
        </Button>
        <button
          onClick={onLogout}
          disabled={loading}
          className="w-full py-2 text-xs font-semibold text-text-muted/60 hover:text-text-muted transition-colors cursor-pointer disabled:opacity-40"
        >
          {t('activation.activated.logout')}
        </button>
      </div>
    </div>
  )
}
