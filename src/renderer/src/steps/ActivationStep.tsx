import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../components/Button'
import type { ActivationFlowSnapshot } from '@shared/activation/types'
import { shouldAutoResumeProvisioning } from './activation-flow-helpers'
import { getConfirmPurchaseErrorMessage } from './activation-purchase-feedback'
import { sendOtp, verifyOtp } from './otp-api'

// ─── Sub-component: Email Step ────────────────────────────────────────────────
function EmailStep({
  onSendCode,
  loading,
  error
}: {
  onSendCode: (email: string) => Promise<void>
  loading: boolean
  error: string | null
}): React.JSX.Element {
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
    <div className="flex flex-col items-center gap-5 w-full max-w-sm mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
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
        <h2 className="text-xl font-black tracking-tight">{t('activation.email.title')}</h2>
        <p className="text-text-muted text-sm mt-1">{t('activation.email.subtitle')}</p>
      </div>
      <div className="w-full space-y-3">
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setLocalError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
            onFocus={() => setInputActive(true)}
            onBlur={() => setInputActive(false)}
            placeholder={t('activation.email.placeholder')}
            autoFocus
            disabled={loading}
            className={`w-full px-4 py-3 rounded-xl bg-white/5 border text-sm text-text placeholder:text-text-muted/40 transition-all duration-200 disabled:opacity-50 ${
              displayError
                ? 'border-error/60 focus:border-error/80 focus:bg-error/5'
                : inputActive
                ? 'border-primary/60 focus:border-primary/80 bg-white/[0.07]'
                : 'border-glass-border focus:border-primary/60 focus:bg-white/[0.07]'
            }`}
          />
          {displayError && (
            <p className="mt-1.5 text-xs text-error font-medium pl-1">{displayError}</p>
          )}
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={!isValidEmail(email) || isSending}
          onClick={() => void handleSend()}
          className="w-full font-black text-[15px] shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/50 hover:brightness-110 active:scale-[0.97] transition-all duration-150"
        >
          {isSending ? t('activation.email.sending') : t('activation.email.sendCode')}
        </Button>
      </div>
    </div>
  )
}

// ─── Sub-component: Verify Step ───────────────────────────────────────────────
function VerifyStep({
  email,
  onBack,
  onResend,
  onVerify,
  loading,
  error,
  cooldownSecs
}: {
  email: string
  onBack: () => void
  onResend: () => void
  onVerify: (code: string) => Promise<void>
  loading: boolean
  error: string | null
  cooldownSecs: number
}): React.JSX.Element {
  const { t } = useTranslation('steps')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (code.every((c) => c.length === 1)) {
      void onVerify(code.join(''))
    }
  }, [code, onVerify])

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

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="var(--color-primary)" strokeWidth="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="var(--color-primary)" strokeWidth="2" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-xl font-black tracking-tight">{t('activation.verify.title')}</h2>
        <p className="text-text-muted text-sm mt-1">{t('activation.verify.subtitle', { email })}</p>
      </div>
      <div className="flex gap-2" onPaste={handlePaste}>
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
            className="w-11 h-13 text-center text-xl font-black rounded-xl bg-white/5 border border-glass-border text-text placeholder:text-text-muted/30 focus:outline-none focus:border-primary/70 focus:bg-white/[0.07] transition-all duration-200 disabled:opacity-50"
          />
        ))}
      </div>
      {error && (
        <p className="text-xs text-error font-medium text-center bg-error/10 px-3 py-2 rounded-xl border border-error/20">{error}</p>
      )}
      {loading && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-xs text-text-muted/60">{t('activation.verify.verifying')}</p>
        </div>
      )}
      {!loading && code.every((c) => c.length === 1) && (
        <button
          onClick={() => void onVerify(code.join(''))}
          className="w-full py-3 rounded-xl bg-primary text-white font-black text-[15px] shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/50 hover:brightness-110 active:scale-[0.97] transition-all duration-150"
        >
          Verify Code
        </button>
      )}
      <div className="w-full flex items-center justify-between text-xs text-text-muted/60">
        <button
          onClick={onBack}
          className="text-xs text-text-muted/60 hover:text-text font-medium transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-white/10"
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

// ─── Sub-component: Topup Step ────────────────────────────────────────────────
function TopupStep({
  onBack,
  onSelectAmount
}: {
  onBack: () => void
  onSelectAmount: (amount: 5 | 10 | 20) => void
}): React.JSX.Element {
  const { t } = useTranslation('steps')
  const amounts = [
    { amount: 5 as const, label: t('activation.topup.amount5') },
    { amount: 10 as const, label: t('activation.topup.amount10') },
    { amount: 20 as const, label: t('activation.topup.amount20') }
  ]
  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-xl font-black tracking-tight">{t('activation.topup.title')}</h2>
        <p className="text-text-muted text-sm mt-1">{t('activation.topup.subtitle')}</p>
      </div>
      <div className="w-full flex flex-col gap-3">
        {amounts.map(({ amount, label }) => (
          <button
            key={amount}
            onClick={() => onSelectAmount(amount)}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-gradient-to-r from-success/10 to-success/5 border border-success/30 hover:border-success/60 hover:from-success/20 hover:to-success/10 transition-all duration-200 cursor-pointer group active:scale-[0.98]"
          >
            <span className="text-base font-black">{label}</span>
            <span className="text-xs text-text-muted/60 group-hover:text-primary">{t('activation.topup.credits')}</span>
          </button>
        ))}
      </div>
      <button onClick={onBack} className="text-xs text-text-muted/60 hover:text-text-muted transition-colors cursor-pointer">
        {t('activation.topup.back')}
      </button>
    </div>
  )
}

// ─── Sub-component: Pending Topup Step ───────────────────────────────────────
function PendingTopupStep({ onCancel }: { onCancel: () => void }): React.JSX.Element {
  const { t } = useTranslation('steps')
  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="animate-spin" style={{ animationDuration: '2s' }}>
          <circle cx="12" cy="12" r="10" stroke="var(--color-primary)" strokeWidth="2" strokeDasharray="30 60" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-xl font-black tracking-tight">{t('activation.pendingTopup.title')}</h2>
        <p className="text-text-muted text-sm mt-1">{t('activation.pendingTopup.subtitle')}</p>
      </div>
      <p className="text-center text-xs text-text-muted/60 px-4">{t('activation.pendingTopup.hint')}</p>
      <p className="text-center text-xs text-text-muted/40">{t('activation.pendingTopup.checking')}</p>
      <button onClick={onCancel} className="text-xs text-text-muted/60 hover:text-text-muted transition-colors cursor-pointer">
        {t('activation.pendingTopup.cancel')}
      </button>
    </div>
  )
}

// ─── Sub-component: Activated Step ──────────────────────────────────────────
// ─── OTP View type ────────────────────────────────────────────────────────────
type OtpView = 'buy' | 'email' | 'verify' | 'topup' | 'pending_topup' | 'activated'

// ─── Email-verified activation info (stored during OTP flow) ─────────────────
interface EmailActivationInfo {
  email: string
  apiKey: string
  baseUrl: string
  balanceUsd?: number
}
// ─── Main Component ────────────────────────────────────────────────────────────
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
  const [manualKeyProvider, setManualKeyProvider] = useState<'clawrouter' | 'ezrouter'>('clawrouter')
  const [manualKeyInput, setManualKeyInput] = useState('')

  // ── OTP flow state ────────────────────────────────────────────────────────
  const [otpView, setOtpView] = useState<OtpView>('buy')
  const [pendingEmail, setPendingEmail] = useState('')
  const [cooldownSecs, setCooldownSecs] = useState(0)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [_emailActivationInfo, _setEmailActivationInfo] = useState<EmailActivationInfo | null>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
      if (next.phase === 'provisioning') {
        next = await window.electronAPI.activation.provision({ deviceLabel: 'ClawLite Installer' })
        setSnapshot(next)
      }
      if (next.phase === 'error') {
        setError(next.errorMessage || 'Provisioning failed')
        return
      }
      if (next.phase === 'config_injection') {
        next = await window.electronAPI.activation.injectConfig({
          targetConfigPath: platform === 'windows' ? '/root/.openclaw/openclaw.json' : '~/.openclaw/openclaw.json'
        })
        setSnapshot(next)
      }
      if (next.phase === 'error') {
        setError(next.errorMessage || 'Config injection failed')
        return
      }
      if (next.phase === 'validation') {
        next = await window.electronAPI.activation.validate({ expectGatewayReachable: true })
        setSnapshot(next)
      }
      if (next.phase === 'completed') {
        onActivationComplete()
        return
      }
      setError(next.errorMessage || 'Activation could not continue after payment')
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
          try {
            await runProvisioningChain(next)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Provisioning chain failed')
          }
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [snapshot?.phase, runProvisioningChain])

  useEffect(() => {
    if (!shouldAutoResumeProvisioning(snapshot) || working) return
    let cancelled = false
    void (async () => {
      try {
        setWorking(true)
        setError(null)
        const next = await window.electronAPI.activation.startPurchase({ path: 'connect_existing_purchase' })
        if (cancelled) return
        setSnapshot(next)
        if (next.phase === 'provisioning' || next.phase === 'config_injection' || next.phase === 'validation') {
          await runProvisioningChain(next)
          return
        }
        if (next.phase === 'error') {
          setError(next.errorMessage || 'Failed to resume ClawRouter activation')
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to resume ClawRouter activation')
        }
      } finally {
        if (!cancelled) setWorking(false)
      }
    })()
    return () => { cancelled = true }
  }, [snapshot, runProvisioningChain, working])

  // Cooldown timer for OTP resend
  useEffect(() => {
    if (cooldownSecs > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldownSecs((c) => Math.max(0, c - 1))
      }, 1000)
    } else if (cooldownRef.current) {
      clearInterval(cooldownRef.current)
      cooldownRef.current = null
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [cooldownSecs > 0])

  const handleOtpSendCode = useCallback(
    async (inputEmail: string): Promise<void> => {
      setPendingEmail(inputEmail)
      setOtpError(null)
      setCooldownSecs(60)
      const result = await sendOtp(inputEmail)
      if (result.ok) {
        setOtpView('verify')
      } else {
        setOtpError(result.error || 'Failed to send code')
        setCooldownSecs(0)
      }
    },
    []
  )

  const handleOtpVerify = useCallback(
    async (code: string): Promise<void> => {
      setOtpError(null)
      setWorking(true)
      try {
        const result = await verifyOtp(pendingEmail, code)
        if (!result.ok) {
          setOtpError(result.error || t('activation.verify.invalidCode'))
          return
        }
        // OTP verified — proceed to bootstrap → provisioning
        const snap = await bootstrap(pendingEmail)
        if (!snap) {
          setOtpError(t('activation.errors.bootstrap'))
          return
        }
        // If active entitlement → run provisioning chain → done
        if (snap.purchase.entitlement === 'active') {
          if (snap.phase === 'provisioning' || snap.phase === 'config_injection' || snap.phase === 'validation') {
            await runProvisioningChain(snap)
            setEmailActivationInfo({
              email: pendingEmail,
              apiKey: snap.provisioning?.credentialRef || '',
              baseUrl: 'https://clawlite.ai/api/openai/v1',
            })
            setOtpView('activated')
          } else if (snap.phase === 'purchase_pending') {
            const next = await window.electronAPI.activation.startPurchase({ path: 'buy_and_connect' })
            setSnapshot(next)
            if (next.phase === 'purchase_pending' && next.purchase.checkoutUrl) {
              await window.electronAPI.system.openExternal(next.purchase.checkoutUrl)
            } else if (next.phase === 'provisioning') {
              await runProvisioningChain(next)
              setEmailActivationInfo({
                email: pendingEmail,
                apiKey: next.provisioning?.credentialRef || '',
                baseUrl: 'https://clawlite.ai/api/openai/v1',
              })
              setOtpView('activated')
            }
          } else if (snap.phase === 'ready_for_activation') {
            let snap2 = await window.electronAPI.activation.provision({ deviceLabel: 'ClawLite Installer' })
            setSnapshot(snap2)
            if (snap2.phase === 'provisioning' || snap2.phase === 'config_injection' || snap2.phase === 'validation') {
              await runProvisioningChain(snap2)
              setEmailActivationInfo({
                email: pendingEmail,
                apiKey: snap2.provisioning?.credentialRef || '',
                baseUrl: 'https://clawlite.ai/api/openai/v1',
              })
              setOtpView('activated')
            } else if (snap2.phase === 'error') {
              setOtpError(snap2.errorMessage || t('activation.errors.generic'))
            }
          }
          // Fall through: provisioning chain handles completion / parent handles next step
        } else {
          // No active entitlement → show topup
          setOtpView('topup')
        }
      } finally {
        setWorking(false)
      }
    },
    [pendingEmail, bootstrap, runProvisioningChain, onActivationComplete, t]
  )

  const handleOtpResend = useCallback(async (): Promise<void> => {
    if (cooldownSecs > 0) return
    await handleOtpSendCode(pendingEmail)
  }, [cooldownSecs, pendingEmail, handleOtpSendCode])

  const handleOtpTopup = useCallback(
    async (_amount: 5 | 10 | 20): Promise<void> => {
      setWorking(true)
      setError(null)
      try {
        const snap = await bootstrap(pendingEmail)
        if (!snap) { setWorking(false); return }
        const next = await window.electronAPI.activation.startPurchase({ path: 'buy_and_connect' })
        setSnapshot(next)
        if (next.phase === 'purchase_pending' && next.purchase.checkoutUrl) {
          await window.electronAPI.system.openExternal(next.purchase.checkoutUrl)
          setOtpView('pending_topup')
        } else if (next.phase === 'provisioning') {
          await runProvisioningChain(next)
          setEmailActivationInfo({
            email: pendingEmail,
            apiKey: next.provisioning?.credentialRef || '',
            baseUrl: 'https://clawlite.ai/api/openai/v1',
          })
          setOtpView('activated')
        }
      } finally {
        setWorking(false)
      }
    },
    [bootstrap, pendingEmail, runProvisioningChain]
  )

  const handleOtpPendingCancel = useCallback((): void => {
    setOtpView('topup')
    setWorking(false)
  }, [])

  // ── Existing Buy ClawRouter handler ───────────────────────────────────────

  const handleBuyClick = async (): Promise<void> => {
    setWorking(true)
    setError(null)
    try {
      const snap = email.trim() ? await bootstrap(email.trim()) : snapshot
      if (!snap) { setWorking(false); return }

      const next = await window.electronAPI.activation.startPurchase({ path: 'buy_and_connect' })
      setSnapshot(next)
      if (next.phase === 'purchase_pending' && next.purchase.checkoutUrl) {
        const opened = await window.electronAPI.system.openExternal(next.purchase.checkoutUrl)
        if (!opened.success) {
          setError(opened.error ?? 'Failed to open checkout URL.')
        }
      } else if (next.phase === 'provisioning') {
        await runProvisioningChain(next)
      } else if (next.phase === 'error') {
        setError(next.errorMessage || t('activation.errors.generic'))
      } else {
        setError('Checkout URL not ready. Please try again.')
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
      let next = await window.electronAPI.activation.confirmPurchase()
      setSnapshot(next)
      if (next.phase === 'provisioning' || next.phase === 'config_injection' || next.phase === 'validation') {
        await runProvisioningChain(next)
        return
      }
      const nextError = getConfirmPurchaseErrorMessage(next)
      if (nextError) setError(nextError)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('activation.errors.generic'))
    } finally {
      setWorking(false)
    }
  }

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
        targetConfigPath: platform === 'windows' ? '/root/.openclaw/openclaw.json' : '~/.openclaw/openclaw.json'
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

  // ── Render OTP overlay when email/verify/topup flow is active ─────────────
  if (otpView !== 'buy') {
    return (
      <div className="flex-1 flex flex-col min-h-0 px-8 pt-6 pb-6">
        <div className="flex-1 overflow-y-auto pb-10 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold">{t('activation.title')}</h2>
            <p className="text-text-muted text-xs">{t('activation.desc')}</p>
          </div>

          <div className="rounded-2xl border border-glass-border bg-bg-card p-6">
            {otpView === 'email' && (
              <EmailStep
                onSendCode={handleOtpSendCode}
                loading={working}
                error={otpError}
              />
            )}
            {otpView === 'verify' && (
              <VerifyStep
                email={pendingEmail}
                onBack={() => setOtpView('email')}
                onResend={handleOtpResend}
                onVerify={handleOtpVerify}
                loading={working}
                error={otpError}
                cooldownSecs={cooldownSecs}
              />
            )}
            {otpView === 'topup' && (
              <TopupStep
                onBack={() => setOtpView('email')}
                onSelectAmount={handleOtpTopup}
              />
            )}
            {otpView === 'pending_topup' && (
              <PendingTopupStep onCancel={handleOtpPendingCancel} />
            )}
            {otpView === 'activated' && emailActivationInfo && (
              <ActivatedStep
                info={emailActivationInfo}
                onLaunch={function (): void {
                  setOtpView('buy')
                  setEmailActivationInfo(null)
                  onActivationComplete()
                }}
                onLogout={function (): void {
                  setOtpView('email')
                  setEmailActivationInfo(null)
                }}
                loading={working}
              />
            )}
          </div>

          {otpView !== 'pending_topup' && (
            <div className="flex items-center justify-center gap-2 text-[10px] text-text-muted/40">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span>{t('activation.footer.secure')}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Default: show buy cards ────────────────────────────────────────────────
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
                Get a ClawRouter API key with discounted credits. We&apos;ll set everything up for you.
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
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void handleBuyClick()}
                    disabled={!email.trim() || working || loading}
                    loading={working}
                    className="flex-1"
                  >
                    {loading ? 'Checking...' : 'Buy ClawRouter'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setOtpView('email')}
                    disabled={!email.trim() || working || loading}
                  >
                    Use Email+OTP
                  </Button>
                </div>
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
                onChange={(e) => setManualKeyProvider(e.target.value as 'clawrouter' | 'ezrouter')}
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
