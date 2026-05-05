/**
 * Schema for activate.json — persisted after successful OTP verification
 * so the installer can resume from where it left off on subsequent runs.
 */

export interface ActivateData {
  accountId: string
  email: string
  apiKey: string
  baseUrl: string
  balance: number
  verifiedAt: string // ISO timestamp
}
