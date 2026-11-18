import { Platform } from 'react-native';

// Tells screen readers a control's state. react-native-web (0.21) ignores accessibilityState, so on the
// web the state has to be an ARIA prop. Radios and checkboxes take `aria-checked` directly (React Native
// supports it on every platform); these cover the two web attributes React Native's types don't list.
// On iOS and Android they fall back to `aria-selected`, which React Native turns into its selected state.

/** A toggle button that's on: a filter chip, a catalog colour ("pressed" to a screen reader). */
export function pressedState(on: boolean): object {
  return Platform.OS === 'web' ? { 'aria-pressed': on } : { 'aria-selected': on };
}

/** The current item of a set: the page open in the sidebar, the photo shown in a gallery. */
export function currentState(on: boolean, kind: 'page' | 'true' = 'true'): object {
  if (Platform.OS !== 'web') return { 'aria-selected': on };
  return on ? { 'aria-current': kind } : {};
}
