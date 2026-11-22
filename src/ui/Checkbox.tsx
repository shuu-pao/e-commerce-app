import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { colors, fonts, radius, touch } from './theme';
import { Txt } from './Txt';

/** A box to tick, with its label beside it; the whole row is the tap target. */
export function Checkbox({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={value}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={({ hovered }) => [styles.row, value && styles.rowOn, hovered && !value && styles.hover]}
    >
      <View style={[styles.box, value && styles.boxOn]}>{value ? <Icon name="checkmark" size={16} color={colors.white} /> : null}</View>
      <View style={styles.text}>
        <Txt style={styles.label}>{label}</Txt>
        {hint ? <Txt variant="small">{hint}</Txt> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.white },
  rowOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  hover: { borderColor: colors.accent },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  text: { flex: 1, gap: 2 },
  label: { fontFamily: fonts.semibold },
});
