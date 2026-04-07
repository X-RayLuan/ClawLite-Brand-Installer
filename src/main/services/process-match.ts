// Match openclaw CLI executable in a full command line.
// Avoid matching paths like "/Users/.../.openclaw/workspace/..." which include
// "openclaw" as part of a directory name and can accidentally kill Electron renderer.
export const OPENCLAW_PROCESS_PATTERN = '(^|/)openclaw([[:space:]]|$)'
export const OPENCLAW_PROCESS_REGEX = /(^|\/)openclaw(\s|$)/

