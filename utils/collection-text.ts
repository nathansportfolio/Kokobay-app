import type { Collection } from '@/types/shopify';

/** True when the collection has a usable cover URL (lists and rails hide entries without one). */
export function collectionHasCoverImage(c: Collection): boolean {
  return Boolean(c.image?.url?.trim());
}

export function collectionsWithCoverImage(collections: Collection[]): Collection[] {
  return collections.filter(collectionHasCoverImage);
}

/** Plain text for previews — prefers `description`, falls back to stripped `descriptionHtml`. */
export function collectionBlurb(c: Collection): string | undefined {
  const plain = c.description?.trim();
  if (plain) return plain;
  const html = c.descriptionHtml?.trim();
  if (!html) return undefined;
  const stripped = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped || undefined;
}

/** Small-caps editorial label from handle (e.g. `new-in` → `NEW IN`). */
export function collectionEditorialEyebrow(handle: string): string {
  return handle
    .split('-')
    .filter(Boolean)
    .map((word) => word.toUpperCase())
    .join(' ');
}
