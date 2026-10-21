// Design tokens, taken from the approved mock.

export const colors = {
  ink: '#1F1A1C',
  body: '#4A4245',
  muted: '#6B6266',
  line: '#ECE7E5',
  lineStrong: '#CFC6C3',
  surface: '#FAF8F7',
  raised: '#F3EFEE',
  white: '#FFFFFF',
  accent: '#A3264F',
  accentDark: '#7E1C3D',
  accentSoft: '#F7EBEF',
  warnBg: '#FFF4E5',
  warnInk: '#7A4100',
  warnDot: '#D97706',
  okBg: '#EAF5EE',
  okInk: '#1E5E37',
  okDot: '#2F8F55',
  scrim: 'rgba(31, 26, 28, 0.45)',
} as const;

export const fonts = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
} as const;

export type Weight = keyof typeof fonts;

export const radius = { sm: 8, md: 10, lg: 14, pill: 999 } as const;

/** Minimum size of anything tappable (Apple's 44 pt guideline). */
export const touch = 44;

/** Placeholder tints for products without a photo, picked by name so they stay stable. */
const tints = ['#F3E1E7', '#EFE6DD', '#E2E8EE', '#E6EDE3', '#EDE5F2', '#F4EAD8'];

export function tintFor(text: string): string {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return tints[h % tints.length];
}

/** Wide screens (iPad landscape, desktop) keep the menu open as a sidebar. */
export const WIDE = 1024;
