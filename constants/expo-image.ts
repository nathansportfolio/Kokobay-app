/**
 * Shared expo-image defaults for catalog / list performance (disk + memory cache).
 * Pair with `recyclingKey` on list cells so recycled rows swap bitmaps cleanly.
 */
export const catalogImageCache = {
  cachePolicy: 'memory-disk' as const,
  priority: 'normal' as const,
};
