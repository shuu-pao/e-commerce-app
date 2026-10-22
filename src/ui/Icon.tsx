import createIconSet from '@expo/vector-icons/createIconSet';

import glyphs from '@/assets/fonts/icons.json';

/**
 * The few Ionicons the app uses, from a 3 KB subset of the font (the full one is 390 KB,
 * downloaded on first install). To add an icon, add its Ionicons name to scripts/icons.py
 * and run `python scripts/icons.py`.
 */
export const Icon = createIconSet(glyphs, 'caracebu-icons', require('../../assets/fonts/icons.ttf'));

export type IconName = keyof typeof glyphs;
