import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Category } from '@/domain/types';
import { useLive } from '@/data/hooks';
import { newId, remove, save } from '@/data/store';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Field } from '@/ui/Field';
import { Card, Screen } from '@/ui/Screen';
import { colors, tintFor } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

export default function Categories() {
  const categories = useLive('categories');
  const products = useLive('products');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);

  const sorted = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories]);
  const taken = (n: string, except?: string) => categories.some((c) => c.id !== except && c.name.trim().toLowerCase() === n.trim().toLowerCase());
  const count = (id: string) => products.filter((p) => p.categoryIds.includes(id)).length;

  const add = () => {
    const n = name.trim();
    if (!n) return setError('Type a name.');
    if (taken(n)) return setError('That category already exists.');
    save('categories', { id: newId(), name: n });
    setName('');
    setError(null);
  };

  const rename = () => {
    if (!renaming) return;
    const n = renaming.name.trim();
    const existing = categories.find((c) => c.id === renaming.id);
    if (!n || taken(n, renaming.id) || !existing) return;
    save('categories', { ...existing, name: n });
    setRenaming(null);
  };

  return (
    <Screen maxWidth={720}>
      <View style={styles.add}>
        <Field label="New category" value={name} onChangeText={(t) => { setName(t); setError(null); }} placeholder="e.g. Scrunchies" onSubmitEditing={add} error={error} style={{ flex: 1, minWidth: 220 }} />
        <Button label="Add category" onPress={add} style={styles.addButton} />
      </View>

      <Card style={styles.list}>
        {sorted.length === 0 ? <Txt color={colors.muted}>No categories yet. They appear in the menu under Sell.</Txt> : null}
        {sorted.map((c) =>
          renaming?.id === c.id ? (
            <View key={c.id} style={styles.row}>
              <Field label={`Rename ${c.name}`} hideLabel value={renaming.name} onChangeText={(t) => setRenaming({ id: c.id, name: t })} onSubmitEditing={rename} autoFocus style={{ flex: 1 }} error={taken(renaming.name, c.id) ? 'That name is taken.' : null} />
              <Button label="Save" onPress={rename} />
              <Button label="Cancel" variant="ghost" onPress={() => setRenaming(null)} />
            </View>
          ) : (
            <View key={c.id} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: tintFor(c.name) }]} />
              <Txt weight="semibold" style={{ flex: 1 }}>{c.name}</Txt>
              <Txt variant="small">{count(c.id)} products</Txt>
              <Button label="Rename" variant="ghost" accessibilityLabel={`Rename ${c.name}`} onPress={() => setRenaming({ id: c.id, name: c.name })} />
              <Button label="Remove" variant="ghost" accessibilityLabel={`Remove ${c.name}`} onPress={() => setRemoving(c)} />
            </View>
          ),
        )}
      </Card>
      <Txt variant="small">Removing a category keeps its products; they stay in their other categories and in All products.</Txt>

      <ConfirmDialog
        visible={!!removing}
        title={removing ? `Remove ${removing.name}?` : 'Remove category?'}
        message="Its products stay in All products and in their other categories."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) remove('categories', removing.id);
          setRemoving(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  add: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 },
  addButton: { marginTop: 26 },
  list: { gap: 0, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, borderBottomWidth: 1, borderBottomColor: colors.line },
  swatch: { width: 28, height: 28, borderRadius: 8 },
});
