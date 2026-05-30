import { getHeaderTitle, Header } from '@react-navigation/elements';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { AppHeaderBannerStack } from '@/components/cms/app-header-banner-stack';
import { palette } from '@/constants/theme';

export function StackHeaderWithBanner({ options, route, back }: NativeStackHeaderProps) {
  const title = getHeaderTitle(options, route.name);
  return (
    <View style={{ backgroundColor: palette.surface }}>
      <Header {...options} title={title} back={back} />
      <AppHeaderBannerStack />
    </View>
  );
}
