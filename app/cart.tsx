import { Redirect } from 'expo-router';

/** Push entry — bag tab. */
export default function CartDeepLinkScreen() {
  return <Redirect href="/(tabs)/cart" />;
}
