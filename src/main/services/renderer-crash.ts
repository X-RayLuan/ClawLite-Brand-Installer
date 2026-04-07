type RendererGoneDetails = {
  reason?: string
  exitCode?: number
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function buildRendererCrashHtml(details?: RendererGoneDetails): string {
  const reason = details?.reason ? escapeHtml(String(details.reason)) : 'unknown'
  const exitCode = Number.isFinite(details?.exitCode) ? String(details?.exitCode) : 'unknown'

  return (
    '<html><body style="font-family:-apple-system,system-ui;padding:24px;background:#0b1020;color:#e5e7eb">' +
    '<h2>ClawLite Renderer Crashed</h2>' +
    '<p>Please reinstall the latest build and try again.</p>' +
    `<p style="font-size:12px;opacity:.85">Reason: ${reason} | Exit code: ${exitCode}</p>` +
    '</body></html>'
  )
}

