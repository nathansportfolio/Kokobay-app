import { Stack } from 'expo-router';

/** Collections tab stack — PLP pushes stay in-tab (required for iOS NativeTabs). */
export default function CategoriesTabStackLayout() {
  return <Stack screenOptions={{ headerShown: false, freezeOnBlur: false }} />;
}
