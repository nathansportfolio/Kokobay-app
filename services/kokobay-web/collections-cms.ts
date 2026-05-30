import { isKokobayApiConfigured, resolveKokobayApiBaseUrl } from './api-config';

export type CmsCollectionTile = {
  slug: string;
  title: string;
  imageUrl: string;
  url: string;
};

function normalizeTile(raw: unknown): CmsCollectionTile | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const slug = typeof o.slug === 'string' ? o.slug.trim() : '';
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  const imageUrl =
    (typeof o.imageUrl === 'string' ? o.imageUrl : typeof o.image_url === 'string' ? o.image_url : '')
      .trim();
  const url = typeof o.url === 'string' ? o.url.trim() : '';
  if (!slug || !title || !url) return null;
  return { slug, title, imageUrl, url };
}

/** `GET /api/collections-cms` — Shopify `collections` metaobject tiles. */
export async function getCollectionsCms(
  init?: { signal?: AbortSignal },
): Promise<CmsCollectionTile[]> {
  const root = resolveKokobayApiBaseUrl();
  if (!root || !isKokobayApiConfigured()) {
    throw new Error('Koko Bay API is not configured');
  }

  const url = `${root}/api/collections-cms`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: init?.signal,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`collections-cms ${res.status}: ${text.slice(0, 200)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error('collections-cms invalid JSON');
  }

  if (!Array.isArray(json)) return [];

  const tiles: CmsCollectionTile[] = [];
  for (const entry of json) {
    const tile = normalizeTile(entry);
    if (tile) tiles.push(tile);
  }
  return tiles;
}
