# ClawLite Brand Installer — Activation Gap Checklist

Last updated: 2026-04-04

## Current status
**Status: PARTIAL BUT BUILDABLE**

What is already true:
- activation step exists in the installer wizard
- activation state machine exists
- buy-and-connect path exists in installer-side code
- preload and IPC wiring exist
- typecheck passes
- build passes

What is not yet true:
- real ClawRouter purchase is not fully wired end-to-end
- real entitlement verification is not wired
- real credential binding/provisioning is not wired
- production-grade purchase callback/polling is not wired
- final commit/ship state is not complete

---

## P0 — Must be done before this can be called complete

### P0-1. Replace demo checkout URL with real backend-owned checkout flow
Current evidence:
- `https://clawlite.ai/checkout/demo-clawrouter`
- local demo purchase progression in activation controller

Done means:
- installer receives a real checkout URL or activation start response from backend
- checkout session is tied to real user/account state
- installer no longer depends on demo checkout placeholders

### P0-2. Replace local `confirmPurchase()` shortcut with real purchase-state polling
Current evidence:
- purchase completion can be simulated locally without real backend confirmation

Done means:
- installer polls backend for purchase state
- purchase transitions only after real entitlement becomes active
- failure / timeout / retry paths are handled explicitly

### P0-3. Wire provisioning to real ClawRouter credential binding
Current evidence:
- demo binding ids and demo credential refs are used

Done means:
- installer receives real binding metadata from backend
- no raw token is exposed in renderer UI
- account-bound credential reference is usable for config injection

### P0-4. Wire config injection to real production payload
Current evidence:
- config injection uses simulated provisioning payload

Done means:
- injected OpenClaw config matches real production binding contract
- provider/model/credentialRef are production-valid
- write path is verified on supported installer platforms

### P0-5. Verify end-to-end happy path
Happy path that must work:
1. user downloads installer from logged-in website session
2. installer resolves activation bootstrap
3. user buys ClawRouter in flow (or already owns it)
4. backend confirms entitlement
5. installer provisions binding
6. installer writes config
7. installer validates connection
8. installer lands in completed state

Done means:
- this is proven in a real environment, not only by local simulation

---

## P1 — Needed for safe ship quality

### P1-1. Add explicit error handling for purchase / provisioning / validation failures
Need explicit UX for:
- checkout abandoned
- entitlement never flips active
- provisioning fails
- config injection fails
- validation fails
- fallback to BYOK remains available

### P1-2. Add test entry and activation smoke tests
Current evidence:
- activation test file exists
- `npm test` script does not exist

Done means:
- a standard test script exists
- activation controller tests run through package scripts
- at least one smoke test covers buy/connect flow transitions

### P1-3. Confirm platform-specific config target handling
Need explicit validation for:
- macOS config target
- Windows config target
- Linux behavior if supported

### P1-4. Commit and document current activation slice cleanly
Current repo state still has uncommitted activation-related work.

Done means:
- working tree is clean
- activation slice is committed with a clear message
- docs match actual shipped behavior

---

## P2 — Nice-to-have but not ship-blocking

### P2-1. Improve installer copy and confidence messaging
- reduce ambiguity between “buy”, “connect”, and “use own key”
- explain account-bound credential model more clearly

### P2-2. Add analytics / instrumentation
Useful events:
- bootstrap resolved
- checkout started
- checkout completed
- provisioning started/completed
- config injected
- validation passed/failed
- BYOK fallback selected

### P2-3. Add resumable activation state recovery
If installer is closed mid-flow, user should not need to restart blindly.

---

## Minimal definition of done
This task can be called **DONE** only if all of the following are true:
- real checkout flow is wired
- real purchase-state confirmation is wired
- real credential binding is wired
- config injection uses production-valid payload
- end-to-end happy path is verified
- failure paths are handled
- tests/build pass
- activation changes are committed and ship-ready

---

## Practical summary
Right now the installer side is **far enough along to prove the product flow**, but **not yet far enough to claim production-complete in-installer ClawRouter purchase**.
