/**
 * OTP API helpers for the email+OTP verification flow.
 */

const API_BASE = (() => {
  const override = import.meta.env.VITE_CLAWLITE_API_BASE?.trim()
  if (override) return override.replace(/\/$/, '')
  return 'https://clawlite.ai/api'
})()

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request timed out')), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timeoutId!)
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await withTimeout(
    fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    }),
    15000
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err: any = new Error((data as { error?: string }).error || `HTTP ${res.status}`)
    err._body = data
    err._status = res.status
    throw err
  }
  return data as T
}

export function formatOtpApiError(error: unknown): string {
  if (!(error instanceof Error)) return 'Failed to send code. Check your connection and try again.'

  const status = (error as any)._status
  const bodyError = (error as any)._body?.error
  const message = bodyError || error.message

  if (status === 404) {
    return 'Verification service is missing on clawlite.ai (HTTP 404). Please update the ClawLite backend deployment.'
  }

  if (status) {
    return `Verification service failed (${status}): ${message}`
  }

  return message || 'Failed to send code. Check your connection and try again.'
}

export interface OtpSendResult {
  ok: boolean
  error?: string
}

export interface OtpVerifyResult {
  ok: boolean
  accountId?: string
  email?: string
  isActive?: boolean
  error?: string
  balance?: number
  apiKey?: string
  baseUrl?: string
}

export async function sendOtp(email: string): Promise<OtpSendResult> {
  // Check session storage for a record of a recently-created account for this email.
  // The backend /auth/otp/send historically created a new account on every call
  // without checking for duplicates, which resulted in multiple account rows
  // for the same email (e.g. biz@bjhwbr.com having 3 records).
  // Storing the created accountId lets us detect re-sends within the same session
  // and avoid triggering another INSERT on the backend.
  const storageKey = `otp_sent_account_${email.toLowerCase()}`
  try {
    const prev = sessionStorage.getItem(storageKey)
    if (prev) {
      return {
        ok: false,
        error: 'A verification code was already sent to this email in this session. Please check your inbox or wait before requesting again.'
      }
    }
  } catch {
    // sessionStorage not available — proceed normally
  }

  const result = await apiFetch<OtpSendResult>('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ email })
  })

  // If the send succeeded, record the email so a repeat call in the same session
  // is caught above and does not hit the backend a second time.
  if (result.ok) {
    try {
      sessionStorage.setItem(storageKey, '1')
    } catch {
      // sessionStorage write failure is non-fatal
    }
  }
  return result
}

export async function verifyOtp(email: string, code: string): Promise<OtpVerifyResult> {
  return apiFetch<OtpVerifyResult>('/installer/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code })
  })
}
