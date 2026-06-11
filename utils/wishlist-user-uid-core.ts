import {
  WISHLIST_USER_UID_MAX_LENGTH,
  WISHLIST_USER_UID_PATTERN,
} from '@/constants/wishlist-user';

export function isValidWishlistUserUid(uid: string | null | undefined): boolean {
  const trimmed = uid?.trim();
  if (!trimmed) return false;
  return WISHLIST_USER_UID_PATTERN.test(trimmed);
}

function clampWishlistUserUid(uid: string): string {
  return uid.trim().slice(0, WISHLIST_USER_UID_MAX_LENGTH);
}

/** Map Shopify customer gid → opaque uid accepted by `/api/wishlists/[userUid]`. */
export function wishlistUserUidFromCustomerId(customerId: string): string | null {
  const trimmed = customerId.trim();
  if (!trimmed) return null;
  if (isValidWishlistUserUid(trimmed)) return trimmed;

  const legacyMatch = trimmed.match(/Customer\/(\d+)/i);
  if (legacyMatch?.[1]) {
    const uid = clampWishlistUserUid(`shopify-cust-${legacyMatch[1]}`);
    if (isValidWishlistUserUid(uid)) return uid;
  }

  const sanitized = clampWishlistUserUid(trimmed.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-'));
  return isValidWishlistUserUid(sanitized) ? sanitized : null;
}
