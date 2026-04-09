# WebChat Auto Wait Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the installer Web Chat button loading until the local Gateway becomes reachable and then open Web Chat automatically.

**Architecture:** Use the existing renderer polling loop in `DoneStep.tsx`, but extend the readiness plan to 60 seconds so normal Windows Gateway startup completes without an extra click. Keep the no-browser-on-timeout guard to avoid `ERR_CONNECTION_REFUSED` pages.

**Tech Stack:** Electron renderer, React state, Node test runner, TypeScript.

---

### Task 1: Extend WebChat Readiness Wait

**Files:**
- Modify: `src/renderer/src/steps/webchat-open-state.ts`
- Modify: `tests/webchat-open-state.test.ts`
- Modify: `src/renderer/src/steps/DoneStep.tsx`
- Modify: `src/shared/i18n/locales/en/management.json`
- Modify: `src/shared/i18n/locales/zh/management.json`
- Modify: `src/shared/i18n/locales/ja/management.json`

- [ ] **Step 1: Write the failing test**

Update the readiness plan test to expect `attempts: 120` and `delayMs: 500` so the UI waits up to 60 seconds.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/webchat-open-state.test.ts`
Expected: FAIL because `getWebChatReadinessPlan()` still returns `attempts: 20`.

- [ ] **Step 3: Write minimal implementation**

Change `getWebChatReadinessPlan()` to return `attempts: 120`, `delayMs: 500`. Update timeout log and localized slow-state text to explain that the Gateway did not become ready within 60 seconds.

- [ ] **Step 4: Run verification**

Run: `node --test tests/webchat-open-state.test.ts tests/webchat-session.test.ts tests/wsl-openclaw-command.test.ts`
Expected: all tests pass.

Run: `npm run typecheck`
Expected: exit 0.

Run: `npm run build:win-local`
Expected: exit 0 and `dist/clawlite-setup.exe` generated.

- [ ] **Step 5: Commit and release**

Commit message: `fix(webchat): keep waiting until gateway is ready`
Release tag: `v1.3.128`
