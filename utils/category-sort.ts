/** PLP category filter display order. Unknown categories sort after these, alphabetically. */
const CATEGORY_ORDER = [
  'Classic Bikinis',
  'Clothing Tops',
  'Cover Ups',
  'Dresses',
  'One-Piece Swimsuits',
  'Pants',
  'Shorts',
  'Skirts',
  'Swim Briefs',
  'Swimwear Tops',
] as const;

const CATEGORY_RANK = new Map<string, number>(
  CATEGORY_ORDER.map((label, index) => [label.toLowerCase(), index]),
);

function categoryRank(label: string): number {
  return CATEGORY_RANK.get(label.trim().toLowerCase()) ?? CATEGORY_ORDER.length;
}

export function sortCategoryLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const ra = categoryRank(a);
    const rb = categoryRank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
}
