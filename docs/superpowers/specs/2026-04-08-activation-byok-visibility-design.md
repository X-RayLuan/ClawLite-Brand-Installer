# Activation BYOK Visibility Design

## Goal

Fix the `Activate ClawRouter -> Bring Your Own Key` screen so the bottom BYOK card is fully visible and scrollable on first open.

## Root Cause

The activation step uses a nested flex layout with an inner scroll container. Bottom spacing is split between the outer wrapper and the scrollable content area, which causes the last card to sit too close to the viewport edge and appear clipped by the bottom boundary.

## Chosen Approach

Apply the smallest layout-only fix in `ActivationStep.tsx`:

- Remove the extra bottom padding from the outer activation wrapper.
- Increase the bottom padding on the scrollable inner container.

This keeps the existing card order, copy, styles, and interaction logic unchanged while ensuring the final card can scroll fully into view.

## Alternatives Considered

1. Increase contrast or card styling.
This does not address the clipping root cause.

2. Rework the entire activation page layout.
This is higher risk and unnecessary for the reported issue.

## Data Flow / Behavior

- No state changes.
- No IPC changes.
- No backend/config changes.
- Only vertical spacing and scroll reach change.

## Error Handling

No runtime error handling changes are needed because this is a presentational layout fix only.

## Verification

- Open installer to `Activate ClawRouter`.
- Confirm the `Bring Your Own Key` card is fully visible or can be fully scrolled into view.
- Confirm no clipping at the bottom edge on the default window size.
- Confirm no regression to the buy/connect cards above it.
