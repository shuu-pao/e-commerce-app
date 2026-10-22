import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View, type DimensionValue } from 'react-native';

import { useAppState } from '@/data/hooks';
import { syncEnabled } from '@/data/sync';

import { colors, radius } from './theme';
import { Txt } from './Txt';

/**
 * True on a device that's signed in but hasn't finished its first download yet
 * (for example the iPad right after the first sign-in). Screens show skeletons meanwhile.
 */
export function useFirstDownload(): boolean {
  const email = useAppState((s) => s.settings.signedInEmail);
  const pulled = useAppState((s) => s.settings.lastPulledAt);
  return syncEnabled && !!email && !pulled;
}

/** One grey placeholder block that gently pulses (still when the device asks for less motion). */
function Bone({ width = '100%', height, square }: { width?: DimensionValue; height?: DimensionValue; square?: boolean }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [opacity]);
  return <Animated.View style={[styles.bone, { width, height, opacity }, square && { aspectRatio: 1 }]} />;
}

/** Product cards while products download. Says why when there's no internet. */
export function GridSkeleton({ columns }: { columns: number }) {
  return (
    <View style={styles.wrap} accessibilityLabel="Downloading your products" accessibilityRole="progressbar">
      <Note />
      <View style={styles.grid}>
        {Array.from({ length: columns * 2 }, (_, i) => (
          <View key={i} style={[styles.card, { flexBasis: `${100 / columns}%`, maxWidth: `${100 / columns}%` }]}>
            <Bone square />
            <Bone width="80%" height={14} />
            <Bone width="45%" height={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** List rows while orders or products download. */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View style={styles.wrap} accessibilityLabel="Downloading" accessibilityRole="progressbar">
      <Note />
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <Bone width={56} height={56} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone width="55%" height={14} />
            <Bone width="30%" height={12} />
          </View>
          <Bone width={64} height={14} />
        </View>
      ))}
    </View>
  );
}

function Note() {
  const online = useAppState((s) => s.sync.online);
  const error = useAppState((s) => s.sync.error);
  const text = !online
    ? 'No internet. Your products download the first time this device is online.'
    : error
      ? error
      : 'Downloading your products…';
  return <Txt variant="small" color={!online || error ? colors.warnInk : colors.muted}>{text}</Txt>;
}

const styles = StyleSheet.create({
  wrap: { padding: 12, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { padding: 8, gap: 8 },
  bone: { backgroundColor: colors.line, borderRadius: radius.md, flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
});
