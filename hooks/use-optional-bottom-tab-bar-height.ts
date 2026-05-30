import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useContext } from 'react';

/** `0` when the screen is not inside a bottom tab navigator (e.g. root stack PDP / PLP). */
export function useOptionalBottomTabBarHeight(): number {
  const h = useContext(BottomTabBarHeightContext);
  return typeof h === 'number' ? h : 0;
}
