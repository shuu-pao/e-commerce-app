import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, touch } from './theme';
import { Txt } from './Txt';

export interface FilterOption<K> {
  key: K;
  label: string;
}

/**
 * A row of chips that picks one filter, such as a category (the catalog and Products).
 * public/index.html draws the catalog's chips before the app loads: keep the look in step.
 */
export function FilterChips<K extends string | null>({ options, value, onChange, label }: { options: FilterOption<K>[]; value: K; onChange: (key: K) => void; label: string }) {
  return (
    <View style={styles.chips} accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key ?? ''} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)} style={[styles.chip, on && styles.chipOn]}>
            <Txt weight="semibold" color={on ? colors.accent : colors.ink}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: touch, justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.lineStrong },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
});
