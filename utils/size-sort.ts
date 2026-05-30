/** Editorial PLP / filter size order — longest explicit matches win within each tier. */
const PURE_NUMERIC_ORDER = ['4', '6', '8', '10', '12', '14', '16'] as const;
const LETTER_ONLY_ORDER = ['xs', 's', 'm', 'l'] as const;
const COMBINED_SIZE_ORDER = ['xs (4-6)', 's (6-8)', 'm (8-10)', 'l (10-12)'] as const;

const SIZE_BUCKET_RANK = {
  numeric: 0,
  letter: 1,
  combined: 2,
  oneSize: 3,
  other: 4,
} as const;

type SizeBucket =
  | { kind: 'numeric'; index: number }
  | { kind: 'letter'; index: number }
  | { kind: 'combined'; index: number }
  | { kind: 'oneSize' }
  | { kind: 'other' };

function normalizeSizeLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-');
}

function isOneSizeLabel(label: string): boolean {
  const norm = normalizeSizeLabel(label);
  return norm === 'os' || norm === 'onesize' || norm === 'one size';
}

function classifySizeLabel(label: string): SizeBucket {
  const norm = normalizeSizeLabel(label);

  if (isOneSizeLabel(label)) {
    return { kind: 'oneSize' };
  }

  const numericIndex = PURE_NUMERIC_ORDER.indexOf(norm as (typeof PURE_NUMERIC_ORDER)[number]);
  if (numericIndex >= 0) {
    return { kind: 'numeric', index: numericIndex };
  }

  const combinedIndex = COMBINED_SIZE_ORDER.indexOf(norm as (typeof COMBINED_SIZE_ORDER)[number]);
  if (combinedIndex >= 0) {
    return { kind: 'combined', index: combinedIndex };
  }

  if (!norm.includes('(')) {
    const letterIndex = LETTER_ONLY_ORDER.indexOf(norm as (typeof LETTER_ONLY_ORDER)[number]);
    if (letterIndex >= 0) {
      return { kind: 'letter', index: letterIndex };
    }
  }

  return { kind: 'other' };
}

function bucketRank(bucket: SizeBucket): number {
  return SIZE_BUCKET_RANK[bucket.kind];
}

function indexedRank(bucket: SizeBucket): number {
  if (bucket.kind === 'numeric' || bucket.kind === 'letter' || bucket.kind === 'combined') {
    return bucket.index;
  }
  return 0;
}

export function sortSizeLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const bucketA = classifySizeLabel(a);
    const bucketB = classifySizeLabel(b);
    const rankDiff = bucketRank(bucketA) - bucketRank(bucketB);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    const indexDiff = indexedRank(bucketA) - indexedRank(bucketB);
    if (indexDiff !== 0) {
      return indexDiff;
    }

    return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  });
}
