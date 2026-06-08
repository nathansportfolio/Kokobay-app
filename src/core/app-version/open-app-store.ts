import { Linking, Platform } from 'react-native';

import { APP_STORE_LINKS } from './constants';

export async function openAppStoreListing(): Promise<void> {
  const links = Platform.OS === 'ios' ? APP_STORE_LINKS.ios : APP_STORE_LINKS.android;

  try {
    const canOpenNative = await Linking.canOpenURL(links.native);
    if (canOpenNative) {
      await Linking.openURL(links.native);
      return;
    }
  } catch {
    /* fall through to web URL */
  }

  await Linking.openURL(links.web).catch(() => {});
}
