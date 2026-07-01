/** Dev-only — trace PLP header spacer / chrome height settling after navigation. */
const SESSION_STARTED_AT = Date.now();

export function logPlpChromeSnap(event: string, meta?: Record<string, unknown>): void {
  if (!__DEV__) return;
  const elapsedMs = Date.now() - SESSION_STARTED_AT;
  if (meta && Object.keys(meta).length > 0) {
    console.log(`[plp-chrome-snap +${elapsedMs}ms] ${event}`, meta);
    return;
  }
  console.log(`[plp-chrome-snap +${elapsedMs}ms] ${event}`);
}

/** Log when a screen branch or layout mode changes (e.g. PLP skeleton → grid). */
export function logPlpChromeSnapTransition(
  screen: string,
  field: string,
  from: unknown,
  to: unknown,
  meta?: Record<string, unknown>,
): void {
  if (!__DEV__) return;
  if (from === to) return;
  logPlpChromeSnap(`${screen}_${field}_transition`, {
    from,
    to,
    ...meta,
  });
}
