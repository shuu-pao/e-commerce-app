import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dateKey, formatDate } from '@/domain/dates';
import { formatPeso } from '@/domain/money';
import { filterOrders, summarize } from '@/domain/reports';
import type { ShopEvent } from '@/domain/types';
import { ONLINE_EVENT_ID } from '@/domain/types';
import { useAppState, useLive } from '@/data/hooks';
import { newId, remove, save, setCurrentEvent } from '@/data/store';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { DateField } from '@/ui/DateField';
import { Field } from '@/ui/Field';
import { Card, Screen } from '@/ui/Screen';
import { colors, radius } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

function dates(e: ShopEvent): string {
  if (e.id === ONLINE_EVENT_ID) return 'Orders between events';
  if (!e.startDate) return '';
  return e.endDate && e.endDate !== e.startDate ? `${formatDate(e.startDate)} – ${formatDate(e.endDate)}` : formatDate(e.startDate);
}

/** Events are added on the iPad on the day; every order goes to the current one until it's changed. */
export default function Events() {
  const events = useLive('events');
  const orders = useAppState((s) => s.db.orders);
  const currentId = useAppState((s) => s.settings.currentEventId);
  const today = dateKey(new Date());
  const [name, setName] = useState('');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<ShopEvent | null>(null);

  const current = events.find((e) => e.id === currentId);
  const sorted = useMemo(
    () =>
      [...events].sort((a, b) =>
        a.id === ONLINE_EVENT_ID ? -1 : b.id === ONLINE_EVENT_ID ? 1 : (b.startDate ?? '').localeCompare(a.startDate ?? '') || a.name.localeCompare(b.name),
      ),
    [events],
  );

  const add = (makeCurrent: boolean) => {
    const n = name.trim();
    if (!n) return setError('Type the event name.');
    if (end < start) return setError('The last day is before the first day.');
    const id = newId();
    save('events', { id, name: n, startDate: start, endDate: end });
    if (makeCurrent) setCurrentEvent(id);
    setName('');
    setError(null);
  };

  return (
    <Screen maxWidth={900}>
      <View style={styles.current}>
        <Txt variant="label" color={colors.accentDark}>Selling at now</Txt>
        <Txt variant="heading">{current ? current.name : 'No event chosen'}</Txt>
        <Txt color={colors.body}>
          {current ? 'New orders go to this event until you change it. Pick Online at checkout for an Instagram order.' : 'Pick an event below, or add today’s.'}
        </Txt>
        {current ? <Button label="Stop selling at this event" variant="ghost" onPress={() => setCurrentEvent(null)} style={styles.inline} /> : null}
      </View>

      <Card>
        <Txt variant="heading">Add an event</Txt>
        <View style={styles.form}>
          <Field label="Event name" value={name} onChangeText={(t) => { setName(t); setError(null); }} placeholder="e.g. Christmas Bazaar" error={error} style={{ flexGrow: 2, flexBasis: 240 }} />
          <View style={styles.date}><DateField label="First day" value={start} onChange={(d) => { setStart(d); if (end < d) setEnd(d); }} /></View>
          <View style={styles.date}><DateField label="Last day" value={end} onChange={setEnd} /></View>
        </View>
        <View style={styles.buttons}>
          <Button label="Add and sell here now" onPress={() => add(true)} />
          <Button label="Add for later" variant="outline" onPress={() => add(false)} />
        </View>
      </Card>

      <Card style={styles.list}>
        {sorted.map((e) => {
          const s = summarize(filterOrders(Object.values(orders), { eventId: e.id }));
          const isCurrent = e.id === currentId;
          const fixed = e.id === ONLINE_EVENT_ID;
          if (renaming?.id === e.id) {
            return (
              <View key={e.id} style={styles.row}>
                <Field label={`Rename ${e.name}`} hideLabel value={renaming.name} onChangeText={(t) => setRenaming({ id: e.id, name: t })} autoFocus style={{ flex: 1 }} />
                <Button label="Save" onPress={() => { if (renaming.name.trim()) save('events', { ...e, name: renaming.name.trim() }); setRenaming(null); }} />
                <Button label="Cancel" variant="ghost" onPress={() => setRenaming(null)} />
              </View>
            );
          }
          return (
            <View key={e.id} style={styles.row}>
              <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
                <Txt weight="semibold">{e.name}</Txt>
                <Txt variant="small">{[dates(e), `${s.orders} orders`, formatPeso(s.sales)].filter(Boolean).join(' · ')}</Txt>
              </View>
              {isCurrent ? (
                <Txt style={styles.pill}>Current</Txt>
              ) : (
                <Button label="Sell here" variant="ghost" accessibilityLabel={`Set ${e.name} as current`} onPress={() => setCurrentEvent(e.id)} />
              )}
              {!fixed ? <Button label="Rename" variant="ghost" accessibilityLabel={`Rename ${e.name}`} onPress={() => setRenaming({ id: e.id, name: e.name })} /> : null}
              {!fixed && !s.orders ? <Button label="Delete" variant="ghost" accessibilityLabel={`Delete ${e.name}`} onPress={() => setRemoving(e)} /> : null}
            </View>
          );
        })}
      </Card>

      <ConfirmDialog
        visible={!!removing}
        title={`Delete ${removing?.name}?`}
        message="It has no orders, so nothing else changes."
        confirmLabel="Delete"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            remove('events', removing.id);
            if (removing.id === currentId) setCurrentEvent(null);
          }
          setRemoving(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  current: { gap: 4, padding: 18, borderRadius: radius.lg, backgroundColor: colors.accentSoft },
  inline: { alignSelf: 'flex-start', marginLeft: -8 },
  form: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  date: { width: 180 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  list: { gap: 0, paddingVertical: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: 64, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.accentSoft, color: colors.accent, fontSize: 13, overflow: 'hidden' },
});
