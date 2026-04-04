# ClawRouter Installer Activation Flow

Last updated: 2026-04-03

## Scope

This document defines the first implementation foundation for a ClawRouter purchase-and-configure flow inside the ClawLite installer. All work in this document is scoped to this repository only.

Explicit constraint: do not modify any existing repos. This repo is the only implementation surface.

## Product Goal

Let a user who is already logged in on `clawlite.ai` move from installer download to a working OpenClaw configuration with the least possible friction.

The activation experience must support:

- A) user already purchased ClawRouter access and wants to connect now
- B) user has not purchased yet and should be able to activate, buy, and auto-configure
- C) user skips ClawRouter and uses their own API key

The preferred direction is account-bound provisioning. The installer should not ask the user to manually copy raw API keys when ClawRouter is used.

## Recommended Architecture

Use a controller-first, schema-first architecture:

1. Website creates a `downloadSessionId` when the logged-in user downloads the installer.
2. Installer exchanges the download session for a short-lived `setupToken`.
3. Backend returns account purchase status and whether the installer can auto-provision ClawRouter.
4. Installer drives the activation state machine from that response.
5. If the user buys or already owns access, backend provisions an account-bound credential reference, not a raw key.
6. Installer writes OpenClaw config using the provisioned binding and validates connectivity.

## Why `downloadSessionId -> setupToken`

This is the best fit for the stated product assumptions:

- The user is already logged in before download.
- The website is the right place to mint a browser-authenticated session binding.
- The installer should not depend on browser cookies directly.
- A short-lived installer setup token is safer than exposing long-lived account or API credentials.

## State Machine

### Top-Level States

| State                     | Meaning                                                                            | Next                                                           |
| ------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `session_binding_pending` | Installer has launched and is trying to resolve the website-bound download session | `ready_for_activation`, `manual_path_only`, `error`            |
| `ready_for_activation`    | Installer has a valid bound setup token and knows purchase status                  | `purchase_pending`, `provisioning`, `skipped_to_byok`, `error` |
| `purchase_pending`        | User started checkout/activation but entitlement is not active yet                 | `provisioning`, `ready_for_activation`, `error`                |
| `provisioning`            | Backend is issuing or binding a credential reference for this account/device       | `config_injection`, `error`                                    |
| `config_injection`        | Installer is writing OpenClaw config using the bound credential reference          | `validation`, `error`                                          |
| `validation`              | Installer is testing gateway connectivity with the injected config                 | `completed`, `error`                                           |
| `completed`               | ClawRouter is connected and OpenClaw is configured                                 | terminal                                                       |
| `skipped_to_byok`         | User chose to use their own API key instead                                        | terminal for this flow, continue installer BYOK path           |
| `manual_path_only`        | No account-bound session could be resolved, so only BYOK is available              | `skipped_to_byok`                                              |
| `error`                   | Flow failed at a distinct stage with retryable metadata                            | retry or fallback                                              |

### State Entry Rules

- If entitlement already exists: enter `ready_for_activation` with recommended path `connect_existing_purchase`.
- If entitlement is missing but setup token is valid: enter `ready_for_activation` with recommended path `buy_and_connect`.
- If session binding fails entirely: enter `manual_path_only`.

## Backend / Frontend Interface Contract

These are the contracts the installer should target.

### 1. Setup Token / Installer Session Binding

`POST /api/installer/activation/bootstrap`

Request:

```json
{
  "downloadSessionId": "dlsn_123",
  "installerInstanceId": "inst_456",
  "platform": "macos",
  "appVersion": "1.3.88"
}
```

Response:

```json
{
  "setupToken": "stp_opaque_short_lived",
  "setupTokenExpiresAt": "2026-04-03T16:30:00.000Z",
  "account": {
    "accountId": "acct_123",
    "emailMasked": "ra***@example.com"
  },
  "entitlement": {
    "status": "inactive",
    "plan": "clawrouter"
  },
  "allowedPaths": ["buy_and_connect", "use_own_key"],
  "recommendedPath": "buy_and_connect"
}
```

Rules:

- `setupToken` must be short-lived and installer-scoped.
- Installer never stores browser cookies.
- If binding fails, backend should return a clean fallback payload that enables BYOK only.

### 2. Purchase State

`POST /api/installer/activation/purchase`

Request:

```json
{
  "setupToken": "stp_opaque_short_lived",
  "intent": "buy_and_connect"
}
```

Response:

```json
{
  "purchaseState": "checkout_pending",
  "checkoutUrl": "https://clawlite.ai/checkout/abc",
  "pollAfterMs": 2500
}
```

Polling:

`GET /api/installer/activation/purchase-state?setupToken=...`

Returns one of:

- `not_started`
- `checkout_pending`
- `completed`
- `failed`

### 3. Provisioning / Credential Binding

`POST /api/installer/activation/provision`

Request:

```json
{
  "setupToken": "stp_opaque_short_lived",
  "deviceLabel": "Ray’s MacBook Pro",
  "platform": "macos"
}
```

Response:

```json
{
  "provisioningState": "bound",
  "bindingId": "bind_789",
  "credentialRef": "credref_clawrouter_default",
  "provider": "clawrouter",
  "model": "clawrouter/auto"
}
```

Rules:

- Prefer opaque `bindingId` and `credentialRef`.
- Avoid returning a reusable raw API key unless there is no alternative.
- Backend can rotate the underlying secret without changing installer UX.

### 4. OpenClaw Config Injection

`POST /api/installer/activation/inject-config`

Request:

```json
{
  "setupToken": "stp_opaque_short_lived",
  "bindingId": "bind_789",
  "targetConfigPath": "~/.openclaw/openclaw.json"
}
```

Response:

```json
{
  "configInjectionState": "written",
  "configTarget": "~/.openclaw/openclaw.json",
  "patchPreview": {
    "provider": "clawrouter",
    "credentialRef": "credref_clawrouter_default",
    "model": "clawrouter/auto"
  }
}
```

### 5. Validation / Test Connection

`POST /api/installer/activation/validate`

Request:

```json
{
  "setupToken": "stp_opaque_short_lived",
  "bindingId": "bind_789"
}
```

Response:

```json
{
  "validationState": "passed",
  "latencyMs": 318,
  "gatewayReachable": true,
  "accountConfirmed": true
}
```

## Installer UX Mapping

### Path A: Already Purchased

1. Installer resolves setup token.
2. Backend reports active entitlement.
3. CTA is `Connect ClawRouter`.
4. Installer provisions binding, injects config, validates connection.
5. User lands in completed state without seeing any raw key.

### Path B: Not Yet Purchased

1. Installer resolves setup token.
2. Backend reports inactive entitlement.
3. CTA is `Activate ClawRouter`.
4. Installer starts checkout and polls purchase state.
5. After entitlement flips active, installer provisions binding, injects config, validates.
6. User lands in completed state with no separate API-key ceremony.

### Path C: Use Own API Key

1. Installer resolves setup token or falls back to manual mode.
2. User selects `Use My Own API Key`.
3. Installer exits activation state machine into the existing BYOK onboarding flow.

## First Slice Implemented In This Repo

This repo now includes:

- a typed activation schema in shared code
- a main-process activation controller with explicit state transitions
- IPC and preload bridges for the activation flow
- a renderer activation step in the wizard
- a controller smoke test for the main-process state machine

This first slice is intentionally backend-stubbed. It proves the installer contract and flow shape before live website and billing integration are added.

## Non-Goals For This Slice

- real website checkout integration
- real credential issuance
- real OpenClaw config mutation
- real server validation

Those are the next build steps once the backend endpoints exist.
