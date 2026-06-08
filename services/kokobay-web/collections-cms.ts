import { z } from 'zod';

import { api, isApiError } from '@/src/core/api';

import { isKokobayApiConfigured } from './api-config';

export type CmsCollectionTile = {
  slug: string;
  title: string;
  imageUrl: string;
  url: string;
};

const cmsArraySchema = z.array(z.unknown());

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
  if (!isKokobayApiConfigured()) {
    throw new Error('Koko Bay API is not configured');
  }

  try {
    const response = await api.get('/api/collections-cms', {
      auth: 'none',
      marketQuery: false,
      signal: init?.signal,
      coalesce: false,
      schema: cmsArraySchema,
    });

    const json = response.data;
    if (!Array.isArray(json)) return [];

    const tiles: CmsCollectionTile[] = [];
    for (const entry of json) {
      const tile = normalizeTile(entry);
      if (tile) tiles.push(tile);
    }
    return tiles;
  } catch (error) {
    if (isApiError(error) && error.kind === 'http') {
      const preview =
        typeof error.body === 'string'
          ? error.body.slice(0, 200)
          : JSON.stringify(error.body ?? '').slice(0, 200);
      throw new Error(`collections-cms ${error.status}: ${preview}`);
    }
    if (isApiError(error) && error.kind === 'parse') {
      throw new Error('collections-cms invalid JSON');
    }
    throw error instanceof Error ? error : new Error('collections-cms request failed');
  }
}
