import type { AppContent } from '@/types/app-content';
import {
  plainTextFromShopifyRichText,
  shopifyRichTextHasContent,
} from '@/utils/shopify-rich-text';

import { legacyApiGetOptional } from '@/src/core/api';

import { isKokobayApiConfigured } from './api-config';

type Json = Record<string, unknown>;

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
    content: content || plainTextFromShopifyRichText(richContent) || '',
    richContent,
  };
}

/** `GET /api/content/:slug` with optional `?country=GB`. React Query owns caching. */
export async function fetchAppContent(
  slug: string,
  countryCode?: string,
  init?: { signal?: AbortSignal },
): Promise<AppContent | null> {
  const safeSlug = slug.trim();
  if (!safeSlug) return null;

  const country = countryCode?.trim().toUpperCase() ?? '';

  if (!isKokobayApiConfigured()) {
    return null;
  }

  const path = country
    ? `/api/content/${encodeURIComponent(safeSlug)}?${new URLSearchParams({ country }).toString()}`
    : `/api/content/${encodeURIComponent(safeSlug)}`;

  const json = await legacyApiGetOptional(path, {
    auth: 'none',
    marketQuery: false,
    signal: init?.signal,
    retries: 0,
    coalesce: false,
  });

  if (init?.signal?.aborted) return null;
  return normalizeAppContent(json);
}

/** @deprecated React Query invalidation replaces service cache clearing. */
export function clearAppContentMemoryCache(_slug: string, _countryCode?: string): void {
  /** No-op — kept for call-site compatibility during migration. */
}
