import { Image } from 'expo-image';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

const SPLASH_LOGO = require('../assets/images/logo-no-bg.png');

const SPLASH_BG = '#FFFFFF';
const LOGO_ASPECT = 1245 / 200;
const LOGO_MAX_WIDTH_RATIO = 0.72;

/**
 * Launch splash while fonts / providers hydrate.
 * White canvas + centered transparent logo (matches native splash after rebuild).
 */
export function AppLaunchSplash() {
  const { width } = useWindowDimensions();
  const logoWidth = Math.min(Math.round(width * LOGO_MAX_WIDTH_RATIO), 340);

  return (
    <View style={styles.root}>
      <Image
        source={SPLASH_LOGO}
        style={{ width: logoWidth, aspectRatio: LOGO_ASPECT }}
        contentFit="contain"
        priority="high"
        cachePolicy="memory-disk"
        accessibilityRole="image"
        accessibilityLabel="Koko Bay"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPLASH_BG,
  },
});
