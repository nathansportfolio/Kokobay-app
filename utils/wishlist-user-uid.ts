import * as SecureStore from 'expo-secure-store';

import { WISHLIST_DEVICE_USER_UID_KEY } from '@/constants/wishlist-user';
import { createGuestId } from '@/utils/create-guest-id';
import {
  isValidWishlistUserUid,
  wishlistUserUidFromCustomerId,
} from '@/utils/wishlist-user-uid-core';

export { isValidWishlistUserUid, wishlistUserUidFromCustomerId } from '@/utils/wishlist-user-uid-core';

async function loadDeviceWishlistUserUid(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(WISHLIST_DEVICE_USER_UID_KEY);
    if (stored && isValidWishlistUserUid(stored)) return stored.trim();
  } catch {
    /* generate below */
  }
  return null;
}

async function persistDeviceWishlistUserUid(uid: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(WISHLIST_DEVICE_USER_UID_KEY, uid);
  } catch {
    /* non-fatal */
  }
}

/** Stable device uid for guest wishlists — persisted across launches. */
export async function getOrCreateDeviceWishlistUserUid(): Promise<string> {
  const existing = await loadDeviceWishlistUserUid();
  if (existing) return existing;

  const created = createGuestId();
  await persistDeviceWishlistUserUid(created);
  return created;
}

/** Signed-in customers use Shopify-derived uid; guests use the device uid. */
export async function resolveWishlistUserUid(
  customerId?: string | null,
): Promise<string | null> {
  const fromCustomer = customerId?.trim()
    ? wishlistUserUidFromCustomerId(customerId)
    : null;
  if (fromCustomer) return fromCustomer;
  return getOrCreateDeviceWishlistUserUid();
}
