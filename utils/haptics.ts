import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function supported() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Soft tap — buttons, chips, toggles */
export function hapticLight() {
  if (!supported()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Menu open, primary actions */
export function hapticMedium() {
  if (!supported()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Carousel snap, picker steps */
export function hapticSelection() {
  if (!supported()) return;
  void Haptics.selectionAsync();
}

/** Pull refresh complete, add to bag */
export function hapticSuccess() {
  if (!supported()) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Stock limits, recoverable issues */
export function hapticWarning() {
  if (!supported()) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Sync failures, blocking errors */
export function hapticError() {
  if (!supported()) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
