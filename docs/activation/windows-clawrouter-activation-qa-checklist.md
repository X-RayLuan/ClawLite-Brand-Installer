# Windows ClawRouter Activation QA Checklist

This checklist applies to the `Windows installer` flow only.

Out of scope:
- macOS installer
- Linux
- generic BYOK-only validation not related to ClawRouter activation

## Goal

Verify that the Windows installer:
- does not allow users into `Done` before ClawRouter setup is actually complete
- writes a complete local OpenClaw config for the ClawRouter-managed path
- only enables `Done` and `Web Chat` after configuration is valid

## Preconditions

- Use a `Windows` test machine or VM
- WSL is installed and working
- Node and OpenClaw installation steps can complete
- Test with a build that includes the ClawRouter activation fixes
- Have two test account states available if possible:
  - `Account A`: ClawRouter entitlement not ready
  - `Account B`: ClawRouter entitlement active and connectable

## Test 1: Incomplete ClawRouter Setup Must Not Reach Done

Purpose:
Confirm that the installer blocks completion when ClawRouter setup is not actually finished.

Steps:
1. Start the Windows installer from a clean user flow
2. Complete WSL / install steps until the `Activation` step
3. Click `Add Credits`
4. Return to the installer
5. Click `I've added credits — continue setup`
6. Proceed through the remaining installer flow
7. Attempt to continue past config without a valid completed ClawRouter setup

Expected:
- The installer does `not` enter the `Done` step
- The user remains on the configuration flow
- A clear error is shown:
  `ClawRouter setup is incomplete. Please finish ClawRouter connection before continuing.`
- No misleading `Gateway not running`, `Missing config`, or `Web Chat token missing` message is used as the primary outcome

## Test 2: Completed ClawRouter Setup Reaches Done

Purpose:
Confirm that a valid ClawRouter-managed activation can complete end to end.

Steps:
1. Start the Windows installer
2. Complete WSL / install steps
3. On `Activation`, use an account with active ClawRouter entitlement
4. Click `I've added credits — continue setup`
5. Wait for the installer to finish managed activation
6. Continue through config

Expected:
- The installer successfully reaches `Done`
- No blocking error is shown
- The flow does not require manual BYOK input

## Test 3: Windows Config File Is Written

Purpose:
Confirm that the ClawRouter activation path writes OpenClaw config in WSL instead of stopping at model-only injection.

Steps:
1. Complete `Test 2`
2. Open the WSL config file:
   `/root/.openclaw/openclaw.json`
3. Inspect the written JSON

Expected:
- File exists
- `models.providers.clawrouter` exists
- `agents.defaults.model.primary` points to the ClawRouter model
- `gateway` exists
- `gateway.mode` is `local`
- `gateway.bind` is `custom`
- `gateway.customBindHost` is `127.0.0.1`
- `gateway.auth.mode` is `token`
- `gateway.auth.token` exists and is non-empty
- `gateway.remote.url` is `ws://127.0.0.1:18789`
- `gateway.remote.token` matches `gateway.auth.token`

## Test 4: Done Step Web Chat Works Only After Valid Config

Purpose:
Confirm that `Done` and `Web Chat` are only usable after valid ClawRouter configuration exists.

Steps:
1. Complete `Test 2`
2. Enter the `Done` step
3. Click `Web Chat`

Expected:
- Web Chat opens successfully
- No `Web Chat token missing` error is shown
- No `Missing config. Run openclaw setup...` error is shown

## Test 5: Regression Check for BYOK Path

Purpose:
Ensure the Windows-only ClawRouter fix does not break the normal BYOK flow.

Steps:
1. Start the Windows installer
2. Choose `Use My Own API Key`
3. Complete configuration with a valid provider key
4. Finish setup

Expected:
- BYOK flow still reaches `Done`
- BYOK does not require ClawRouter entitlement
- No ClawRouter-specific blocking error appears in the BYOK path

## Test 6: Regression Check for Telegram Optional Step

Purpose:
Ensure optional Telegram setup still behaves normally after the ClawRouter activation changes.

Steps:
1. Run one successful Windows install
2. Leave Telegram empty once
3. Run again with a valid Telegram bot token

Expected:
- Telegram remains optional
- Empty Telegram does not block completion
- Valid Telegram token can still be saved successfully

## Pass Criteria

This Windows-only fix is acceptable when all conditions below are true:
- Incomplete ClawRouter setup cannot reach `Done`
- Successful ClawRouter setup writes a complete gateway configuration
- `Done` and `Web Chat` work after successful setup
- BYOK still works
- Telegram optional flow still works

## Explicit Scope Note

This checklist is for `Windows installer QA only`.

Do not use this checklist as the acceptance checklist for:
- macOS installer
- macOS launchd / gateway behavior
- macOS backup / restore behavior
