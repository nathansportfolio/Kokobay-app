import type { Collection, Image } from '@/types/shopify';

import { fetchKokobayCollectionsJson } from './client';

function normalizeImage(raw: unknown): Image | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  if (!url) return null;
  return {
    id: typeof o.id === 'string' ? o.id : undefined,
    url,
    altText: o.altText == null ? null : String(o.altText),
    width: typeof o.width === 'number' ? o.width : null,
    height: typeof o.height === 'number' ? o.height : null,
  };
}

function kokobayRowToCollection(item: unknown): Collection | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const handle = typeof o.handle === 'string' ? o.handle.trim() : '';
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  if (!id || !handle || !title) return null;
  const description = typeof o.description === 'string' ? o.description : undefined;
  const descriptionHtml = typeof o.descriptionHtml === 'string' ? o.descriptionHtml : undefined;
  const image = normalizeImage(o.image);
  return {
    id,
    handle,
    title,
    description,
    descriptionHtml,
    image,
  };
}

function parseCollectionsPayload(data: Record<string, unknown> | null): Collection[] {
  if (!data) return [];
  const raw = data.collections;
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: Collection[] = [];
  for (const row of raw) {
    const c = kokobayRowToCollection(row);
    if (c) out.push(c);
  }
  return out;
}

/**
 * Published custom + smart collections from `GET /api/collections`.
 * React Query owns caching — no service-layer cache.
 */
export async function getKokobayWebCollections(first = 250): Promise<Collection[] | null> {
  try {
    const json = await fetchKokobayCollectionsJson();
    const collections = parseCollectionsPayload(json);
    return collections.slice(0, first);
  } catch {
    return null;
  }
}

/** @deprecated React Query invalidation replaces service cache clearing. */
export function clearKokobayWebCollectionsCache(): void {
  /** No-op — kept for call-site compatibility during migration. */
}
