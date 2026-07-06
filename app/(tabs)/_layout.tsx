import { Platform } from 'react-native';

import AndroidTabLayout from '@/components/navigation/android-tab-layout';
import IOSTabLayout from '@/components/navigation/ios-tab-layout';

export default function TabLayout() {
  // iPad: JS tab bar stays pinned at the bottom. NativeTabs + iOS 26 minimize can hide it.
  if (Platform.OS === 'ios' && Platform.isPad) {
    return <AndroidTabLayout embedHeader={false} />;
  }

  if (Platform.OS === 'ios') {
    return <IOSTabLayout />;
  }

  return <AndroidTabLayout />;
}
