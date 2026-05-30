/**
 * Yields until the next frame(s) so React can paint loading UI before heavy work.
 */
export function yieldForUiPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}
