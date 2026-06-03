import { Platform } from 'react-native';

/** Android emulator maps the host machine to 10.0.2.2 (localhost/127.0.0.1 do not work). */
export function patchAndroidEmulatorLocalhost(url: string | undefined): string | undefined {
  if (!url || !__DEV__ || Platform.OS !== 'android') return url;
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) return url;
  return url.replace(/localhost/g, '10.0.2.2').replace(/127\.0\.0\.1/g, '10.0.2.2');
}

export function isAndroidDevClient(): boolean {
  return __DEV__ && Platform.OS === 'android';
}
