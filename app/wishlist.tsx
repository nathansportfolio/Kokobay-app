import { Redirect } from 'expo-router';

/** Push entry — wishlist tab. */
export default function WishlistDeepLinkScreen() {
  return <Redirect href="/(tabs)/wishlist" />;
}
