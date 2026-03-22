/**
 * Production-style auth UI: dark surfaces aligned with MainApp + `theme.js`.
 * Type-led hierarchy, restrained chrome, brand green accents.
 * Spacing scale: 4 / 8 / 16 / 24 / 32
 */
import { Platform, StyleSheet } from 'react-native';

import { colors as theme } from './theme';

/** Consistent spacing — use instead of magic numbers */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

const c = {
  bgPage: theme.bg,
  /** Inputs sit slightly above the page (matches panel/card stack) */
  bg: theme.panel,
  text: theme.text,
  textSecondary: theme.muted,
  textMuted: theme.faint,
  placeholder: theme.faint,
  border: theme.line,
  brand: theme.brand,
  brandDark: theme.brandDark,
  borderFocus: theme.brand,
  borderError: theme.dangerBorder,
  error: theme.dangerText,
  primary: theme.brand,
  onPrimary: theme.white,
  linkAccent: theme.brand,
};

export const authProd = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.bgPage,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
  },
  /** Large, left-aligned headline */
  title: {
    color: c.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 38,
    marginBottom: space.sm,
  },
  subtitle: {
    color: c.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: space.xl,
    fontWeight: '400',
  },
  /** Small, high-contrast field labels */
  label: {
    color: c.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: space.sm,
  },
  fieldGap: {
    marginBottom: space.md,
  },
  fieldGapTight: {
    marginBottom: space.sm,
  },
  input: {
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    paddingHorizontal: space.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: c.text,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: c.borderFocus,
  },
  inputError: {
    borderColor: c.borderError,
  },
  /** Password row: border wraps field + eye (single 1px frame) */
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    minHeight: 48,
  },
  passwordRowFocused: {
    borderColor: c.borderFocus,
  },
  passwordRowError: {
    borderColor: c.borderError,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: space.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: c.text,
  },
  eyeHit: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Reserved height so error copy doesn’t jump the primary button */
  errorSlot: {
    minHeight: 48,
    marginTop: space.sm,
    marginBottom: space.sm,
    justifyContent: 'center',
  },
  errorText: {
    color: c.error,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  /** Full-width primary — authoritative, not pill */
  primaryBtn: {
    backgroundColor: c.primary,
    borderRadius: 8,
    paddingVertical: space.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnLabel: {
    color: c.onPrimary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  /** Secondary actions — easy tap targets, visually quiet */
  linkFooter: {
    marginTop: space.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  linkPress: {
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  linkSecondary: {
    fontSize: 15,
    color: c.textMuted,
    fontWeight: '500',
  },
  linkAccent: {
    fontSize: 15,
    color: c.linkAccent,
    fontWeight: '600',
  },
  linkCenterRow: {
    marginTop: space.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 8,
    padding: space.lg,
    marginTop: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  successEmail: {
    fontSize: 17,
    fontWeight: '600',
    color: c.text,
    marginBottom: space.lg,
  },
  successEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textMuted,
    letterSpacing: 0.4,
    marginBottom: space.sm,
    textTransform: 'uppercase',
  },
});

export const authColors = c;
