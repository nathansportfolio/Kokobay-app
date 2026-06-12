import { Platform } from 'react-native';

import AndroidTabLayout from '@/components/navigation/android-tab-layout';
import IOSTabLayout from '@/components/navigation/ios-tab-layout';

export default function TabLayout() {
  if (Platform.OS === 'ios') {
    return <IOSTabLayout />;
  }

  return <AndroidTabLayout />;
}
