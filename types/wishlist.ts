/** One saved wishlist product — newest entries first in persisted order. */
export type WishlistEntry = {
  handle: string;
  /** ISO-8601 UTC — set when the item is saved (or re-saved). */
  addedAt: string;
};
