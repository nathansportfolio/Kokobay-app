/**
 * Semantic version compare.
 * @returns negative when `a` < `b`, zero when equal, positive when `a` > `b`
 */
export function compareVersions(a: string, b: string): number {
  const parsePart = (value: string): number[] =>
    value
      .trim()
      .split('.')
      .map((part) => {
        const match = part.match(/^\d+/);
        return match ? Number.parseInt(match[0], 10) : 0;
      });

  const left = parsePart(a);
  const right = parsePart(b);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const lv = left[index] ?? 0;
    const rv = right[index] ?? 0;
    if (lv < rv) return -1;
    if (lv > rv) return 1;
  }
  return 0;
}

export function isVersionLessThan(currentVersion: string, targetVersion: string): boolean {
  return compareVersions(currentVersion, targetVersion) < 0;
}

export function isVersionAtLeast(currentVersion: string, targetVersion: string): boolean {
  return compareVersions(currentVersion, targetVersion) >= 0;
}
