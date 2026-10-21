import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, radius, tintFor } from './theme';
import { Txt } from './Txt';

interface Props {
  uri: string | null;
  name: string;
  size?: number;
  /** Fill the parent's width instead of a fixed size. */
  fill?: boolean;
  /** A small label in the corner, e.g. "3 colours". */
  badge?: string | null;
}

/** A square product photo, or a tinted square with the product's initials. */
export function Photo({ uri, name, size = 56, fill, badge }: Props) {
  const box = fill ? styles.fill : { width: size, height: size };
  return (
    <View style={[styles.box, box, !uri && { backgroundColor: tintFor(name) }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      ) : (
        <Txt weight="bold" color={colors.muted} style={{ fontSize: fill ? 28 : Math.max(12, size / 3.2) }}>
          {initials(name)}
        </Txt>
      )}
      {badge ? (
        <View style={styles.badge}>
          <Txt variant="small" weight="bold" numberOfLines={1} style={styles.badgeText}>{badge}</Txt>
        </View>
      ) : null}
    </View>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '·';
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised },
  fill: { width: '100%', aspectRatio: 1 },
  badge: { position: 'absolute', left: 6, bottom: 6, maxWidth: '86%', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.white },
  badgeText: { fontSize: 11, lineHeight: 15, color: colors.body },
});
