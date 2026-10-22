import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './Icon';
import { colors, fonts, radius, touch } from './theme';
import { Txt } from './Txt';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', size = 'md', icon, disabled, busy, accessibilityLabel, style }: Props) {
  const fg = variant === 'primary' ? colors.white : variant === 'danger' ? colors.accent : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.base,
        size === 'lg' && styles.lg,
        variant === 'primary' && { backgroundColor: pressed || hovered ? colors.accentDark : colors.accent },
        variant === 'outline' && [styles.outline, (pressed || hovered) && { backgroundColor: colors.accentSoft }],
        (variant === 'ghost' || variant === 'danger') && [styles.ghost, (pressed || hovered) && { backgroundColor: colors.accentSoft }],
        (disabled || busy) && styles.disabled,
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Txt style={[styles.label, size === 'lg' && styles.labelLg, { color: fg }]}>{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lg: { minHeight: 52, paddingHorizontal: 24 },
  outline: { borderWidth: 1.5, borderColor: colors.accent, backgroundColor: colors.white },
  ghost: { backgroundColor: 'transparent', paddingHorizontal: 10 },
  disabled: { opacity: 0.45 },
  label: { fontFamily: fonts.bold, fontSize: 15 },
  labelLg: { fontSize: 16 },
});
