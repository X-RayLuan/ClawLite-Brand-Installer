/**
 * OTP API helpers for the email+OTP verification flow.
 * Endpoints are at the same base as the installer activation API.
 */

const API_BASE = (() => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3000/api'
  }
  return 'https://clawlite.ai/api'
})()

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
  // Backend may return "balance" instead of "balanceUsd"
  balance?: number
}

export async function sendOtp(email: string): Promise<OtpSendResult> {
  return apiFetch<OtpSendResult>('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ email }),
    signal: AbortSignal.timeout(15000)
  })
}

export async function verifyOtp(email: string, code: string): Promise<OtpVerifyResult> {
  return apiFetch<OtpVerifyResult>('/installer/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
    signal: AbortSignal.timeout(15000)
  })
}
