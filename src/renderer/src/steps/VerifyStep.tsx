import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../components/Button'

interface Props {
  email: string
  onBack: () => void
  onResend: () => void
  onVerify: (code: string) => Promise<void>
  loading: boolean
  error: string | null
  cooldownSecs: number
}

export default function VerifyStep({
  email,
  onBack,
  onResend,
  onVerify,
  loading,
  error,
  cooldownSecs
}: Props): React.JSX.Element {
  const { t } = useTranslation('steps')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (code.every((c) => c.length === 1) && !loading) {
      void onVerify(code.join(''))
    }
  }, [code, loading, onVerify])

  const handleChange = (index: number, value: string): void => {
    if (!/^\d?$/.test(value)) return
    const next = [...code]
    next[index] = value
    setCode(next)
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent): void => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent): void => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 0) return
    e.preventDefault()
    const next = [...code]
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || ''
    }
    setCode(next)
    const lastFilled = Math.min(pasted.length - 1, 5)
    inputsRef.current[lastFilled]?.focus()
  }

  const allFilled = code.every((c) => c.length === 1)

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect
            x="3"
            y="11"
            width="18"
            height="11"
            rx="2"
            ry="2"
            stroke="var(--color-primary)"
            strokeWidth="2"
          />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="var(--color-primary)" strokeWidth="2" />
        </svg>
      </div>

      <div className="text-center">
        <h3 className="text-base font-black tracking-tight">{t('activation.verify.title')}</h3>
        <p className="text-text-muted text-xs mt-0.5">
          {t('activation.verify.subtitle', { email })}
        </p>
      </div>

      {/* 6-digit inputs */}
      <div className="flex gap-1.5" onPaste={handlePaste}>
        {code.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputsRef.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={loading}
            autoFocus={i === 0}
            className="w-10 h-11 text-center text-lg font-black rounded-xl bg-white/5 border border-glass-border text-text placeholder:text-text-muted/30 focus:outline-none focus:border-primary/70 focus:bg-white/[0.07] transition-all duration-200 disabled:opacity-50"
          />
        ))}
      </div>

      {error && (
        <p className="text-xs text-error font-medium text-center bg-error/10 px-3 py-1.5 rounded-xl border border-error/20">
          {error}
        </p>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-xs text-text-muted/60">{t('activation.verify.verifying')}</p>
        </div>
      )}

      {/* Manual verify button when all filled */}
      {!loading && allFilled && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => void onVerify(code.join(''))}
          className="w-full font-bold text-sm"
        >
          Verify Code
        </Button>
      )}

      <div className="w-full flex items-center justify-between text-xs text-text-muted/60">
        <button
          onClick={onBack}
          className="hover:text-text transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-white/10"
        >
          {t('activation.verify.changeEmail')}
        </button>

        {cooldownSecs > 0 ? (
          <span>{t('activation.verify.resendCooldown', { secs: cooldownSecs })}</span>
        ) : (
          <button
            onClick={() => void onResend()}
            className="text-primary hover:text-primary-light font-semibold transition-colors cursor-pointer"
          >
            {t('activation.verify.resend')}
          </button>
        )}
      </div>
    </div>
  )
}
