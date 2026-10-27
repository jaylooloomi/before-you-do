export const appearanceThemes = ['system', 'light', 'dark'];

export function normalizeAppearanceTheme(theme) {
  return appearanceThemes.includes(theme) ? theme : 'system';
}

export function resolveAppearanceTheme(theme, systemPrefersDark) {
  if (theme === 'light' || theme === 'dark') return theme;
  return systemPrefersDark ? 'dark' : 'light';
}
