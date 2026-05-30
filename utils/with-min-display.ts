/**
 * Ensures loading UI can render for at least `ms` while `work()` runs.
 * Keeps skeletons visible briefly when cached data resolves instantly.
 */
export async function withMinDisplay<T>(work: () => Promise<T>, ms = 280): Promise<T> {
  const started = Date.now();
  const result = await work();
  const elapsed = Date.now() - started;
  if (elapsed < ms) {
    await new Promise((r) => setTimeout(r, ms - elapsed));
  }
  return result;
}
