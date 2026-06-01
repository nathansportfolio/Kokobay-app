/** Slim row from `GET /api/wishlist-products?handles=a,b,c` (kokobay web). */
export type WishlistProductPreview = {
  handle: string;
  title: string;
  imageUrl: string | null;
  price: number;
  compareAtPrice?: number | null;
  available: boolean;
};
