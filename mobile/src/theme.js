/**
 * Central design tokens — match MainApp shell (dark, brand green).
 * Use for auth, onboarding, profile, and any screen that should feel native to the app.
 */

export const colors = {
  bg: '#0a0a0f',
  panel: '#111118',
  card: '#18181f',
  line: 'rgba(255,255,255,0.08)',
  text: '#f0f0f5',
  muted: 'rgba(240,240,245,0.62)',
  faint: 'rgba(240,240,245,0.34)',
  brand: '#00c896',
  /** Darker teal for rings, secondary emphasis */
  brandDark: '#0D9488',
  brandSoft: 'rgba(0,200,150,0.12)',
  sky: '#4ea8f5',
  amber: '#f5a623',
  /** Text on solid brand surfaces (e.g. commute card) */
  onBrand: '#021b14',
  white: '#FFFFFF',
  danger: '#f87171',
  dangerSoft: 'rgba(255,80,80,0.1)',
  dangerBorder: 'rgba(255,80,80,0.45)',
  dangerText: '#ff8a80',
  /** Light surfaces (onboarding fallback) */
  canvasLight: '#F1F5F9',
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
  xxl: 22,
  sheet: 26,
  pill: 999,
};

/** Typography scale — use with Text; weights stay in components */
export const type = {
  micro: 10,
  caption: 11,
  small: 12,
  body: 13,
  bodyMd: 14,
  bodyLg: 15,
  titleSm: 17,
  title: 20,
  headline: 22,
  display: 28,
  heroNum: 52,
};

/** Minimum touch target (Apple HIG / Material) */
export const layout = {
  hitMin: 44,
  tabBarPadBottom: 8,
};
