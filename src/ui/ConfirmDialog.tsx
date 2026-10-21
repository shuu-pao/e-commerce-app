import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { colors, radius } from './theme';
import { Txt } from './Txt';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before something that can't be undone. (Alert.alert does nothing on the web.) */
export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel} accessibilityLabel="Close" accessibilityRole="button">
        <Pressable style={styles.card} onPress={() => {}} accessibilityRole="alert" accessibilityViewIsModal>
          <Txt variant="heading">{title}</Txt>
          {message ? <Txt color={colors.body}>{message}</Txt> : null}
          <View style={styles.actions}>
            <Button label="Cancel" variant="ghost" onPress={onCancel} />
            <Button label={confirmLabel} onPress={onConfirm} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, gap: 12, padding: 24, borderRadius: radius.lg + 2, backgroundColor: colors.white },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
});
