import { Stack } from 'expo-router';

/** Bag tab stack — checkout pushes stay on the cart tab (required for iOS NativeTabs back). */
export default function CartTabStackLayout() {
  return <Stack screenOptions={{ headerShown: false, freezeOnBlur: false }} />;
}
