import React from 'react';
import { Platform, Pressable } from 'react-native';

const VARIANT_FEEDBACK = {
  default: (pressed, disabled) =>
    !disabled && pressed ? { transform: [{ scale: 0.98 }], opacity: 0.78 } : null,
  solid: (pressed, disabled) =>
    !disabled && pressed ? { transform: [{ scale: 0.985 }], opacity: 0.9 } : null,
  primary: (pressed, disabled) =>
    !disabled && pressed ? { transform: [{ scale: 0.985 }], opacity: 0.88 } : null,
  chip: (pressed, disabled) =>
    !disabled && pressed ? { transform: [{ scale: 0.97 }], opacity: 0.82 } : null,
  ghost: (pressed, disabled) =>
    !disabled && pressed ? { transform: [{ scale: 0.96 }], opacity: 0.75 } : null,
  tab: (pressed, disabled) =>
    !disabled && pressed ? { transform: [{ scale: 0.94 }], opacity: 0.82 } : null,
  link: (pressed, disabled) => (!disabled && pressed ? { opacity: 0.62 } : null),
  none: () => null,
};

function rippleForVariant(variant) {
  if (Platform.OS !== 'android') return undefined;
  if (variant === 'none' || variant === 'link') return undefined;
  if (variant === 'solid' || variant === 'primary') return { color: 'rgba(0,0,0,0.14)' };
  return { color: 'rgba(255,255,255,0.1)' };
}

/**
 * Pressable with consistent scale/opacity feedback (+ optional Android ripple).
 * @param {'default'|'solid'|'primary'|'chip'|'ghost'|'tab'|'link'|'none'} [variant='default']
 */
const AppPressable = React.forwardRef(function AppPressable(
  { variant = 'default', style, android_ripple, disabled, ...rest },
  ref,
) {
  const ripple = android_ripple !== undefined ? android_ripple : rippleForVariant(variant);
  const feedback = VARIANT_FEEDBACK[variant] || VARIANT_FEEDBACK.default;

  return (
    <Pressable
      ref={ref}
      disabled={disabled}
      android_ripple={ripple}
      style={(state) => {
        const base = typeof style === 'function' ? style(state) : style;
        const list = Array.isArray(base) ? base.filter(Boolean) : [base].filter(Boolean);
        return [...list, feedback(state.pressed, disabled)];
      }}
      {...rest}
    />
  );
});

export default AppPressable;
