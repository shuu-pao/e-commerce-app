import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from './theme';
import { Txt } from './Txt';

/** A scrolling page with a readable maximum width. */
export function Screen({ children, maxWidth = 960 }: { children: ReactNode; maxWidth?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.inner, { maxWidth }]}>{children}</View>
    </ScrollView>
  );
}

/** A bordered block that groups related content. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Empty({ title, message, children }: { title: string; message?: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Txt variant="heading">{title}</Txt>
      {message ? <Txt color={colors.muted} style={styles.emptyText}>{message}</Txt> : null}
      {children}
    </View>
  );
}

/** A label/value pair on one line, value on the right. */
export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Txt variant={strong ? 'heading' : 'body'} color={strong ? colors.ink : colors.body}>{label}</Txt>
      <Txt variant={strong ? 'big' : 'body'} color={strong ? colors.ink : colors.body} style={styles.num}>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 24, paddingTop: 20 },
  inner: { width: '100%', alignSelf: 'center', gap: 18 },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 18, gap: 12, backgroundColor: colors.white },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  emptyText: { textAlign: 'center', maxWidth: 420 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  num: { fontVariant: ['tabular-nums'] },
});
