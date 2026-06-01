import type { AppContent } from '@/types/app-content';
import {
  plainTextFromShopifyRichText,
  shopifyRichTextHasContent,
} from '@/utils/shopify-rich-text';

import { isKokobayApiConfigured, resolveKokobayApiBaseUrl } from './api-config';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout';

type Json = Record<string, unknown>;

const memoryCache = new Map<string, AppContent | null>();

function cacheKey(slug: string, countryCode: string): string {
  return `${slug.trim().toLowerCase()}::${countryCode.trim().toUpperCase()}`;
}

export function peekAppContentCache(slug: string, countryCode: string): AppContent | null | undefined {
  const key = cacheKey(slug, countryCode);
  if (!memoryCache.has(key)) return undefined;
  return memoryCache.get(key);
}

/** Only cache successful CMS hits so 404s refetch after content is published. */
function storeAppContentCache(slug: string, countryCode: string, value: AppContent | null): void {
  if (value === null) return;
  memoryCache.set(cacheKey(slug, countryCode), value);
}

/** Clears in-memory CMS cache so the next fetch hits the network. */
export function clearAppContentMemoryCache(slug: string, countryCode?: string): void {
  const safeSlug = slug.trim().toLowerCase();
  if (!safeSlug) return;
  if (countryCode) {
    memoryCache.delete(cacheKey(safeSlug, countryCode));
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(`${safeSlug}::`)) memoryCache.delete(key);
  }
}

function parseRichContent(raw: unknown): unknown | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return undefined;
    }
  }
  if (typeof raw === 'object') return raw;
  return undefined;
}

function normalizeAppContent(json: Json | null): AppContent | null {
  if (!json || json.ok === false) return null;

  const title = typeof json.title === 'string' ? json.title.trim() : '';
  const rawContent = typeof json.content === 'string' ? json.content.trim() : '';
  let richContent = parseRichContent(
    json.richContent ?? json.rich_content ?? json.richText ?? json.rich_text,
  );
  let content = rawContent;

  if (!richContent && rawContent) {
    const embedded = parseRichContent(rawContent);
    if (embedded && shopifyRichTextHasContent(embedded)) {
      richContent = embedded;
      content = plainTextFromShopifyRichText(embedded);
    }
  }

  if (!title && !content && richContent == null) return null;

  return {
    title,
    content,
    richContent,
  };
}

/** `GET /api/content/:slug` with optional `?country=GB`. */
export async function fetchAppContent(
  slug: string,
  countryCode?: string,
  init?: { signal?: AbortSignal },
): Promise<AppContent | null> {
  const safeSlug = slug.trim();
  if (!safeSlug) return null;

  const country = countryCode?.trim().toUpperCase() ?? '';
  const cached = peekAppContentCache(safeSlug, country);
  if (cached !== undefined) return cached;

  const root = resolveKokobayApiBaseUrl();
  if (!root || !isKokobayApiConfigured()) {
    return null;
  }

  const path = `/api/content/${encodeURIComponent(safeSlug)}`;
  const url = country
    ? `${root}${path}?${new URLSearchParams({ country }).toString()}`
    : `${root}${path}`;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: init?.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      return null;
    }
    let json: Json | null = null;
    try {
      json = JSON.parse(text) as Json;
    } catch {
      return null;
    }
    const normalized = normalizeAppContent(json);
    storeAppContentCache(safeSlug, country, normalized);
    return normalized;
  } catch {
    if (init?.signal?.aborted) return null;
    return null;
  }
}
