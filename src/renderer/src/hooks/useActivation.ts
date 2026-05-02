import { useState, useCallback, useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivationStatus =
  | 'idle'
  | 'checking'
  | 'need_verify'
  | 'need_topup'
  | 'pending_topup'
  | 'activated'
  | 'need_skip_provider'
  | 'error'

export type LicenseType = 'annual' | 'lifetime' | 'trial' | 'unknown'

export interface ActivationInfo {
  email: string
  licenseType: LicenseType
  expiresAt: string | null // ISO date string, null for lifetime
  apiKey: string
  baseUrl: string
  balanceUsd?: number
}

const API_BASE = 'https://clawlite.ai/api'

// ─── Installer Instance ID ───────────────────────────────────────────────────

function getInstallerInstanceId(): string {
  const key = 'clawlite_installer_instance_id'
  try {
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err: any = new Error((data as { error?: string }).error || `HTTP ${res.status}`)
      err._body = data
      err._status = res.status
      throw err
    }
    return data as T
  } catch (e) {
    throw e
  }
}

interface OtpSendResponse {
  ok: boolean
  error?: string
}

interface VerifyOtpResponse {
  ok: boolean
  accountId?: string
  email?: string
  isActive?: boolean
  error?: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useActivation() {
  const [status, setStatus] = useState<ActivationStatus>('idle')
  const [activationInfo, setActivationInfo] = useState<ActivationInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)

  const pendingEmailRef = useRef<string | null>(null)
  const pendingBalanceRef = useRef<number | undefined>(undefined)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /**
   * Bootstrap + provision + injectConfig + validate — full activation chain.
   * Adapts to Brand Installer's electronAPI.
   */
  const provisionAndActivate = useCallback(
    async (acctId: string, email: string, balanceUsd?: number): Promise<void> => {
      try {
        const instanceId = getInstallerInstanceId()

        // Bootstrap — Brand Installer takes { installerInstanceId, platform, appVersion, accountId }
        const bootstrapData = await window.electronAPI.activation.bootstrap({
          installerInstanceId: instanceId,
          platform: 'macos', // platform is resolved server-side from instanceId
          appVersion: '',
          accountId: acctId
        } as any)

        if (bootstrapData.phase === 'error') {
          const errMsg = bootstrapData.errorMessage || 'Bootstrap failed'
          const err: any = new Error(errMsg)
          err.needTopup = bootstrapData.allowedPaths?.includes('buy_and_connect')
          throw err
        }

        // If purchase is pending, prompt topup
        if (bootstrapData.phase === 'purchase_pending') {
          const err: any = new Error('need_topup')
          err.needTopup = true
          throw err
        }

        // If not ready for activation, check entitlement
        if (bootstrapData.phase !== 'ready_for_activation' && bootstrapData.phase !== 'provisioning') {
          const hasActiveEntitlement =
            bootstrapData.allowedPaths?.includes('buy_and_connect') ||
            bootstrapData.allowedPaths?.includes('connect_existing_purchase')
          if (!hasActiveEntitlement) {
            const err: any = new Error('need_topup')
            err.needTopup = true
            throw err
          }
        }

        // Run provisioning chain
        let snap = bootstrapData
        if (snap.phase === 'ready_for_activation') {
          snap = await window.electronAPI.activation.provision({ deviceLabel: 'ClawLite Installer' })
        }

        if (snap.phase === 'error') {
          const errMsg = snap.errorMessage || 'Provisioning failed'
          const err: any = new Error(errMsg)
          err.needTopup = errMsg.includes('not active') || errMsg.includes('no entitlement')
          throw err
        }

        if (snap.phase === 'provisioning') {
          // Inject config
          const targetConfigPath =
            'win32' === 'win32'
              ? '/root/.openclaw/openclaw.json'
              : '~/.openclaw/openclaw.json'
          snap = await window.electronAPI.activation.injectConfig({ targetConfigPath } as any)
        }

        if (snap.phase === 'error') {
          throw new Error(snap.errorMessage || 'Config injection failed')
        }

        if (snap.phase === 'config_injection') {
          snap = await window.electronAPI.activation.validate({ expectGatewayReachable: true } as any)
        }

        if (snap.phase === 'error') {
          throw new Error(snap.errorMessage || 'Validation failed')
        }

        if (snap.phase === 'completed') {
          // Extract API key from provisioning state
          const credentialRef = snap.provisioning?.credentialRef
          if (!credentialRef) {
            throw new Error('No API key returned from provision endpoint')
          }
          const info: ActivationInfo = {
            email: email || acctId,
            licenseType: 'unknown',
            expiresAt: null,
            apiKey: credentialRef,
            baseUrl: 'https://clawlite.ai/api/openai/v1',
            balanceUsd: balanceUsd ?? pendingBalanceRef.current,
          }
          setActivationInfo(info)
          setStatus('need_skip_provider')
          return
        }

        // Fallback: try injectManualKey with bootstrap's account
        if (snap.phase === 'manual_path_only' || snap.phase === 'skipped_to_byok') {
          const err: any = new Error('need_topup')
          err.needTopup = true
          throw err
        }

        throw new Error('Activation could not complete')
      } catch (e) {
        const err = e as any
        if (err?.needTopup) {
          setAccountId(acctId)
          setStatus('need_topup')
          return
        }
        const msg = e instanceof Error ? e.message : 'Activation failed'
        setError(msg)
        setStatus('error')
      }
    },
    []
  )

  /** Send OTP code to email. */
  const sendCode = useCallback(async (email: string): Promise<boolean> => {
    setStatus('checking')
    setError(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const data = await apiFetch<OtpSendResponse>('/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ email }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (data.ok) {
        pendingEmailRef.current = email
        setStatus('idle')
        return true
      } else {
        setError(data.error || 'Failed to send code')
        setStatus('error')
        return false
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error'
      setError(msg)
      setStatus('error')
      return false
    }
  }, [])

  /**
   * Verify OTP code via /installer/auth/verify-otp.
   */
  const verifyCode = useCallback(
    async (email: string, code: string): Promise<boolean> => {
      setStatus('checking')
      setError(null)
      try {
        const data = await apiFetch<VerifyOtpResponse>('/installer/auth/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ email, code })
        })

        if (!data.ok) {
          setError(data.error || 'Invalid code')
          setStatus('error')
          return false
        }

        pendingEmailRef.current = data.email || email
        const acctId = data.accountId || email

        if (data.isActive) {
          const balance = (data as any).balance as number | undefined
          pendingBalanceRef.current = balance
          await provisionAndActivate(acctId, data.email || email, balance)
        } else {
          setAccountId(acctId)
          setStatus('need_topup')
        }
        return true
      } catch (e) {
        const err = e as any
        if (err?.needTopup) {
          setAccountId(pendingEmailRef.current || email)
          setStatus('need_topup')
          return false
        }
        const msg = e instanceof Error ? e.message : 'Network error'
        setError(msg)
        setStatus('error')
        return false
      }
    },
    [provisionAndActivate]
  )

  /**
   * Start topup: create Stripe checkout and open browser.
   */
  const startTopup = useCallback(
    async (_amount: 5 | 10 | 20): Promise<boolean> => {
      if (!accountId) {
        setError('Account not ready. Please verify your email first.')
        setStatus('need_topup')
        return false
      }
      setStatus('checking')
      setError(null)
      try {
        const email = pendingEmailRef.current || ''
        // Call the Brand Installer's purchase flow
        const snap = await window.electronAPI.activation.startPurchase({
          path: 'buy_and_connect',
          accountId,
          email
        } as any)

        if (snap.phase === 'purchase_pending' && snap.purchase?.checkoutUrl) {
          await window.electronAPI.system.openExternal(snap.purchase.checkoutUrl)
          setStatus('pending_topup')

          // Start polling for topup completion
          let attempts = 0
          const maxAttempts = 60

          pollingRef.current = setInterval(async () => {
            attempts++
            try {
              const next = await window.electronAPI.activation.confirmPurchase()
              if (next.phase === 'provisioning' || next.phase === 'config_injection' || next.phase === 'validation') {
                if (pollingRef.current) clearInterval(pollingRef.current)
                pollingRef.current = null

                // Run the rest of the chain
                let snap2 = next
                if (snap2.phase === 'provisioning') {
                  const targetConfigPath = '~/.openclaw/openclaw.json'
                  snap2 = await window.electronAPI.activation.injectConfig({ targetConfigPath } as any)
                }
                if (snap2.phase === 'config_injection') {
                  snap2 = await window.electronAPI.activation.validate({ expectGatewayReachable: true } as any)
                }
                if (snap2.phase === 'completed') {
                  const credentialRef = snap2.provisioning?.credentialRef
                  if (credentialRef) {
                    const info: ActivationInfo = {
                      email: email || accountId,
                      licenseType: 'unknown',
                      expiresAt: null,
                      apiKey: credentialRef,
                      baseUrl: 'https://clawlite.ai/api/openai/v1',
                    }
                    setActivationInfo(info)
                    setStatus('need_skip_provider')
                  }
                } else {
                  setError('Activation could not complete after payment.')
                  setStatus('need_topup')
                }
              } else if (attempts >= maxAttempts) {
                if (pollingRef.current) clearInterval(pollingRef.current)
                pollingRef.current = null
                setError('Payment is taking longer than expected.')
                setStatus('need_topup')
              }
            } catch {
              if (attempts >= maxAttempts) {
                if (pollingRef.current) clearInterval(pollingRef.current)
                pollingRef.current = null
                setError('Failed to check payment status.')
                setStatus('need_topup')
              }
            }
          }, 3000)
        } else if (snap.phase === 'provisioning') {
          // Short-circuited — already entitled, run provisioning
          let snap2 = snap
          const targetConfigPath = '~/.openclaw/openclaw.json'
          snap2 = await window.electronAPI.activation.injectConfig({ targetConfigPath } as any)
          if (snap2.phase === 'config_injection') {
            snap2 = await window.electronAPI.activation.validate({ expectGatewayReachable: true } as any)
          }
          if (snap2.phase === 'completed') {
            const credentialRef = snap2.provisioning?.credentialRef
            if (credentialRef) {
              const info: ActivationInfo = {
                email: email || accountId,
                licenseType: 'unknown',
                expiresAt: null,
                apiKey: credentialRef,
                baseUrl: 'https://clawlite.ai/api/openai/v1',
              }
              setActivationInfo(info)
              setStatus('need_skip_provider')
            }
          } else {
            setError('Activation could not complete.')
            setStatus('need_topup')
          }
        } else {
          setError('Could not start checkout. Please try again.')
          setStatus('need_topup')
        }
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to start topup'
        setError(msg)
        setStatus('need_topup')
        return false
      }
    },
    [accountId]
  )

  /** Cancel pending topup and return to topup selection. */
  const cancelTopup = useCallback((): void => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setStatus('need_topup')
  }, [])

  /** Logout — clear local activation data. */
  const logout = useCallback(async (): Promise<void> => {
    setStatus('checking')
    try {
      // logout not available in Brand Installer — clear local state only
      setActivationInfo(null)
    } catch { /* ignore */ }
    setActivationInfo(null)
    setAccountId(null)
    setStatus('need_verify')
  }, [])

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [])

  return {
    status,
    activationInfo,
    error,
    accountId,
    sendCode,
    verifyCode,
    startTopup,
    cancelTopup,
    logout
  }
}
