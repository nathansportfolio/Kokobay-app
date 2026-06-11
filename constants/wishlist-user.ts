/** SecureStore key — stable anonymous wishlist owner before sign-in. */
export const WISHLIST_DEVICE_USER_UID_KEY = 'kokobay_wishlist_user_uid_v1';

/** Matches kokobay `USER_UID_PATTERN` — opaque ids only. */
export const WISHLIST_USER_UID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

export const WISHLIST_USER_UID_MAX_LENGTH = 128;
