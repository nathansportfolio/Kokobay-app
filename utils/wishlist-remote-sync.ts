import { isKokobayWebProductsConfigured } from '@/services/kokobay-web/client';
import {
  addRemoteWishlistItem,
  fetchRemoteWishlist,
  removeRemoteWishlistItem,
} from '@/services/kokobay-web/wishlist-api';
import type { WishlistEntry } from '@/types/wishlist';
import {
  mergeWishlistEntries,
  wishlistEntriesFromRemoteItems,
  wishlistHandlesMissingOnRemote,
} from '@/utils/wishlist-entries-merge';
import { resolveWishlistUserUid } from '@/utils/wishlist-user-uid';

export async function resolveWishlistUserUidForCustomer(
  customerId?: string | null,
): Promise<string | null> {
  if (!isKokobayWebProductsConfigured()) return null;
  return resolveWishlistUserUid(customerId);
}

/** Pull server wishlist, merge with local, push any local-only handles upstream. */
export async function syncWishlistWithRemote(
  localEntries: readonly WishlistEntry[],
  customerId?: string | null,
  init?: { signal?: AbortSignal },
): Promise<WishlistEntry[] | null> {
  if (!isKokobayWebProductsConfigured()) return null;

  const userUid = await resolveWishlistUserUid(customerId);
  if (!userUid) return null;

  const remote = await fetchRemoteWishlist(userUid, init);
  if (!remote) return null;

  const remoteEntries = wishlistEntriesFromRemoteItems(remote.items);
  const merged = mergeWishlistEntries(localEntries, remoteEntries);

  const missingOnRemote = wishlistHandlesMissingOnRemote(merged, remoteEntries);
  if (missingOnRemote.length > 0) {
    await Promise.all(
      missingOnRemote.map((handle) => addRemoteWishlistItem(userUid, handle)),
    );
  }

  return merged;
}

export async function pushWishlistToggleToRemote(
  customerId: string | null | undefined,
  handle: string,
  added: boolean,
): Promise<void> {
  if (!isKokobayWebProductsConfigured()) return;

  const userUid = await resolveWishlistUserUid(customerId);
  if (!userUid) return;

  const normalized = handle.trim().toLowerCase();
  if (!normalized) return;

  if (added) {
    await addRemoteWishlistItem(userUid, normalized);
  } else {
    await removeRemoteWishlistItem(userUid, normalized);
  }
}
