import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../components/Button'

interface Props {
  onSendCode: (email: string) => Promise<void>
  loading: boolean
  error: string | null
}

export default function EmailStep({ onSendCode, loading, error }: Props): React.JSX.Element {
  const { t } = useTranslation('steps')
  const [email, setEmail] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [inputActive, setInputActive] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const isValidEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

  const handleSend = async (): Promise<void> => {
    if (!isValidEmail(email)) {
      setLocalError(t('activation.email.invalid'))
      return
    }
    setLocalError(null)
    setIsSending(true)
    try {
      await onSendCode(email)
    } finally {
      setIsSending(false)
    }
  }

  const displayError = localError || error

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="text-center">
        <h3 className="text-base font-black tracking-tight">{t('activation.email.title')}</h3>
        <p className="text-text-muted text-xs mt-0.5">{t('activation.email.subtitle')}</p>
      </div>

      <div className="w-full space-y-2.5">
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setLocalError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
            onFocus={() => setInputActive(true)}
            onBlur={() => setInputActive(false)}
            placeholder={t('activation.email.placeholder')}
            autoFocus
            disabled={loading}
            className={`w-full px-4 py-2.5 rounded-xl bg-white/5 border text-sm text-text placeholder:text-text-muted/40 transition-all duration-200 disabled:opacity-50 ${
              displayError
                ? 'border-error/60 focus:border-error/80'
                : inputActive
                ? 'border-primary/60 bg-white/[0.07]'
                : 'border-glass-border focus:border-primary/60 bg-white/[0.07]'
            }`}
          />
          {displayError && (
            <p className="mt-1 text-xs text-error font-medium pl-1">{displayError}</p>
          )}
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!isValidEmail(email) || isSending}
          onClick={() => void handleSend()}
          loading={isSending}
          className="w-full font-bold text-sm"
        >
          {isSending
            ? t('activation.email.sending', 'Sending...')
            : t('activation.email.sendCode')}
        </Button>
      </div>
    </div>
  )
}
