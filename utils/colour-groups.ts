import {
  COLOUR_GROUP_DEFINITIONS,
  COLOUR_GROUP_SORT_ORDER,
  COLOUR_GROUP_SWATCH_FALLBACK_HEX,
  COLOUR_GROUP_SWATCH_HEX,
} from '@/constants/colour-groups';

export function normColourLabel(s: string): string {
  return s.trim().toLowerCase();
}

/** Hex for a colour-family filter chip (case-insensitive group label). */
export function swatchHexForColourGroup(label: string): string {
  return COLOUR_GROUP_SWATCH_HEX[normColourLabel(label)] ?? COLOUR_GROUP_SWATCH_FALLBACK_HEX;
}

/** All group labels a catalogue colour string maps to (e.g. “Black & White” → Black + White). */
export function groupsForRawColourValue(raw: string): string[] {
  const key = normColourLabel(raw);
  const hits = new Set<string>();
  for (const { group, members } of COLOUR_GROUP_DEFINITIONS) {
    if (members.some((m) => normColourLabel(m) === key)) {
      hits.add(group);
    }
  }
  if (hits.size > 0) {
    return [...hits];
  }
  return [raw.trim()];
}

/** Unique facet chips to show for the current catalogue slice. */
export function colourGroupLabelsFromRawValues(
  rawValues: Iterable<string>,
  counts?: Record<string, number>,
): string[] {
  const out = new Set<string>();
  for (const raw of rawValues) {
    for (const g of groupsForRawColourValue(raw)) {
      out.add(g);
    }
  }
  const labels = [...out];
  if (counts) {
    return sortColourGroupLabelsByCount(labels, counts);
  }
  return sortColourGroupLabels(labels);
}

export function sortColourGroupLabelsByCount(
  labels: string[],
  counts: Record<string, number>,
): string[] {
  return [...labels].sort((a, b) => {
    const countDiff = (counts[b] ?? 0) - (counts[a] ?? 0);
    if (countDiff !== 0) return countDiff;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
}

export function sortColourGroupLabels(labels: string[]): string[] {
  const rank = new Map(COLOUR_GROUP_SORT_ORDER.map((g, i) => [g, i]));
  return [...labels].sort((a, b) => {
    const ra = rank.get(a);
    const rb = rank.get(b);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
}

/** Expand filter chip selections to normalised raw colour values for OR-matching variants. */
export function expandColourFilterSelection(selectedGroups: string[]): Set<string> {
  const out = new Set<string>();
  for (const sel of selectedGroups) {
    const def = COLOUR_GROUP_DEFINITIONS.find((d) => d.group === sel);
    if (def) {
      out.add(normColourLabel(def.group));
      for (const m of def.members) {
        out.add(normColourLabel(m));
      }
    } else {
      out.add(normColourLabel(sel));
    }
  }
  return out;
}

/**
 * Estimate unique products for a colour group from Shopify per-label facet counts.
 * Summing member counts double-counts products with variants in multiple member labels
 * (e.g. Floral + Print). Filter application uses OR semantics — this aligns chip counts.
 */
export function estimateColourGroupUnionCount(memberCounts: number[]): number {
  if (memberCounts.length === 0) return 0;
  if (memberCounts.length === 1) return memberCounts[0]!;

  const sum = memberCounts.reduce((a, b) => a + b, 0);
  const max = Math.max(...memberCounts);
  const excessMass = sum - max;
  if (excessMass <= 0) return max;

  const doubleCountAllowance = Math.min(
    excessMass,
    Math.ceil((memberCounts.length - 1) * (2 / 3)),
  );
  return Math.max(max, sum - doubleCountAllowance);
}
