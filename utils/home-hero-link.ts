import type { Href } from 'expo-router';
import { Linking } from 'react-native';

import { deepLinkTargetHref, resolveDeepLinkUrl } from '@/lib/deep-link-router';
import { newInCollectionHref } from '@/utils/collection-handles';

export type HomeHeroCtaTarget =
  | { kind: 'internal'; href: Href }
  | { kind: 'external'; url: string };

/** Resolve CMS button link — falls back to New In collection. */
export function resolveHomeHeroCtaTarget(
  buttonLink: string | undefined,
  pathname: string,
): HomeHeroCtaTarget {
  const fallback = newInCollectionHref(pathname);
  const trimmed = buttonLink?.trim();
  if (!trimmed) return { kind: 'internal', href: fallback };

  if (/^https?:\/\//i.test(trimmed)) {
    const deep = resolveDeepLinkUrl(trimmed);
    if (deep.href) {
      return { kind: 'internal', href: deep.href };
    }
    return { kind: 'external', url: trimmed };
  }

  if (trimmed.startsWith('/')) {
    return { kind: 'internal', href: trimmed as Href };
  }

  if (trimmed.startsWith('collections/')) {
    return { kind: 'internal', href: `/${trimmed}` as Href };
  }

  return { kind: 'internal', href: `/collection/${trimmed}` as Href };
}

export function openExternalHomeHeroLink(url: string): void {
  void Linking.openURL(url).catch(() => {});
}
