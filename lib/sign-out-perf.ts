type SignOutPerfMark = {
  label: string;
  atMs: number;
};

let activeRunId: string | null = null;
const marks: SignOutPerfMark[] = [];

function nowMs(): number {
  return Math.round(performance.now());
}

/** Start a sign-out timing run (dev only). */
export function beginSignOutPerfRun(): string {
  const runId = `sign-out-${Date.now()}`;
  activeRunId = runId;
  marks.length = 0;
  markSignOutPerf('sign_out_pressed');
  return runId;
}

export function markSignOutPerf(label: string): void {
  if (!__DEV__) return;
  marks.push({ label, atMs: nowMs() });
  console.log(`[sign-out] ${label}`);
}

export function logSignOutPerf(label: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (detail && Object.keys(detail).length > 0) {
    console.log(`[sign-out] ${label}`, detail);
    return;
  }
  console.log(`[sign-out] ${label}`);
}

/** Log deltas between marks for the active run. */
export function finishSignOutPerfRun(runId: string): void {
  if (!__DEV__) return;
  if (activeRunId !== runId) return;

  const summary: Record<string, number> = {};
  let prev = marks[0]?.atMs ?? 0;
  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i];
    if (!mark) continue;
    const delta = mark.atMs - prev;
    summary[mark.label] = i === 0 ? 0 : delta;
    prev = mark.atMs;
  }
  const totalMs =
    marks.length > 1 ? (marks[marks.length - 1]!.atMs - marks[0]!.atMs) : 0;

  console.log('[sign-out] summary (ms since previous mark)', summary);
  console.log(`[sign-out] total tracked duration: ${totalMs}ms`);

  activeRunId = null;
  marks.length = 0;
}
