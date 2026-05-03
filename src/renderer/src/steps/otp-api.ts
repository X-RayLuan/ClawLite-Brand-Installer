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
}

export async function sendOtp(email: string): Promise<OtpSendResult> {
  return apiFetch<OtpSendResult>('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ email })
  })
}

export async function verifyOtp(email: string, code: string): Promise<OtpVerifyResult> {
  return apiFetch<OtpVerifyResult>('/installer/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code })
  })
}
