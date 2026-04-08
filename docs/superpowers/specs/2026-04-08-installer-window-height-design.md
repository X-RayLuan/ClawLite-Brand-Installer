# Installer Window Height Design

## Goal

Increase the installer app window height slightly so the activation screen has enough vertical space to show the `Bring Your Own Key` card without relying on tight scrolling.

## Root Cause

The main Electron window is currently created at `800x700`, which is too short for the activation step's three-card layout plus persistent bottom controls.

## Chosen Approach

Adjust the runtime main window height in `src/main/index.ts` from `700` to `780` and keep width unchanged at `800`.

This is the smallest window-size change that gives the activation page more usable vertical space without redesigning the step layout.

## Alternatives Considered

1. Keep window size and continue tuning activation spacing.
This is brittle because the page already competes with fixed bottom controls.

2. Increase the window height much more.
This would solve the issue, but it is a larger visual change than needed.

## Scope

- Modify the main Electron window default height.
- Modify the main Electron window minimum height to match.
- Do not change width.
- Do not change DMG layout.
- Do not change renderer logic or card content.

## Verification

- Launch the installer.
- Confirm the app window opens taller than before.
- Confirm the activation screen shows more vertical space and the `Bring Your Own Key` card is easier to reach.
