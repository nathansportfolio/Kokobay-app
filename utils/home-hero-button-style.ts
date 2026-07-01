export type HomeHeroButtonStyle = 'pill' | 'underline';

/** CMS / API `buttonStyle` — defaults to filled pill when unset. */
export function normalizeHomeHeroButtonStyle(value: string | undefined): HomeHeroButtonStyle {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return 'pill';
  if (
    normalized === 'underline' ||
    normalized === 'link' ||
    normalized === 'text' ||
    normalized === 'underlined'
  ) {
    return 'underline';
  }
  return 'pill';
}

/** Dev-only — set `EXPO_PUBLIC_HOME_HERO_BUTTON_STYLE_PREVIEW=underline` in `.env` to preview CTA styles. */
export function resolveHomeHeroButtonStyle(
  cmsStyle: HomeHeroButtonStyle,
): HomeHeroButtonStyle {
  if (!__DEV__) return cmsStyle;
  const preview = process.env.EXPO_PUBLIC_HOME_HERO_BUTTON_STYLE_PREVIEW?.trim();
  if (!preview) return cmsStyle;
  return normalizeHomeHeroButtonStyle(preview);
}
