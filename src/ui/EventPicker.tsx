import { router } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { formatDate } from '@/domain/dates';
import type { Id, ShopEvent } from '@/domain/types';
import { ONLINE_EVENT_ID } from '@/domain/types';
import { useAppState, useLive } from '@/data/hooks';
import { setCurrentEvent } from '@/data/store';

import { Icon } from './Icon';
import { colors, radius, touch } from './theme';
import { Txt } from './Txt';

/** "Nov 22 – 23" under an event's name; "Orders between events" for Online. */
export function eventDates(e: ShopEvent): string {
  if (e.id === ONLINE_EVENT_ID) return 'Orders between events';
  if (!e.startDate) return '';
  return e.endDate && e.endDate !== e.startDate ? `${formatDate(e.startDate)} – ${formatDate(e.endDate)}` : formatDate(e.startDate);
}

/** How many events the list shows besides the current one and Online; the rest are on the Events page. */
const RECENT = 5;

/**
 * "Selling at … Change" on Sell. Change opens a small list right there instead of the Events page, so
 * picking today's event never leaves Sell (design review 6).
 */
export function EventLine() {
  const currentId = useAppState((s) => s.settings.currentEventId);
  const event = useAppState((s) => (s.settings.currentEventId ? s.db.events[s.settings.currentEventId] : undefined));
  const live = event && !event.deleted;
  const anchor = useRef<ComponentRef<typeof Pressable>>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const open = () => anchor.current?.measureInWindow((x, y, w, h) => setAt({ x, y: y + h }));
  return (
    <View style={styles.line}>
      <Txt color={colors.body} numberOfLines={1} style={{ flexShrink: 1 }}>
        {live ? 'Selling at ' : 'No event chosen for today'}
        {live ? <Txt weight="bold">{event.name}</Txt> : null}
      </Txt>
      <Pressable ref={anchor} accessibilityRole="button" accessibilityLabel={live ? 'Change event' : 'Choose event'} onPress={open} style={styles.change}>
        <Txt weight="semibold" color={colors.accent}>{live ? 'Change' : 'Choose'}</Txt>
        <Icon name="chevron-down" size={14} color={colors.accent} />
      </Pressable>
      <EventList at={at} currentId={live ? currentId : null} onClose={() => setAt(null)} />
    </View>
  );
}

function EventList({ at, currentId, onClose }: { at: { x: number; y: number } | null; currentId: Id | null; onClose: () => void }) {
  const events = useLive('events');
  const { width } = useWindowDimensions();
  const shown = useMemo(() => {
    const byId = new Map(events.map((e) => [e.id, e]));
    const recent = events
      .filter((e) => e.id !== currentId && e.id !== ONLINE_EVENT_ID)
      .sort((a, b) => (b.startDate ?? b.updatedAt).localeCompare(a.startDate ?? a.updatedAt))
      .slice(0, RECENT);
    return [currentId ? byId.get(currentId) : undefined, ...recent, currentId === ONLINE_EVENT_ID ? undefined : byId.get(ONLINE_EVENT_ID)].filter(
      (e): e is ShopEvent => !!e,
    );
  }, [events, currentId]);

  const pick = (id: Id | null) => {
    setCurrentEvent(id);
    onClose();
  };
  const manage = () => {
    onClose();
    router.navigate('/events');
  };
  const boxWidth = Math.min(360, width - 32);
  const left = at ? Math.max(16, Math.min(at.x - 24, width - boxWidth - 16)) : 0;

  return (
    <Modal visible={!!at} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      {at ? (
        <View style={[styles.box, { top: at.y + 6, left, width: boxWidth }]} accessibilityViewIsModal>
          <Txt variant="label" style={styles.head}>Selling at</Txt>
          <ScrollView style={styles.scroll} accessibilityRole="radiogroup" accessibilityLabel="Selling at">
            {shown.map((e) => (
              <Option key={e.id} label={e.name} detail={eventDates(e)} on={e.id === currentId} onPress={() => pick(e.id)} />
            ))}
            <Option label="No event" on={!currentId} onPress={() => pick(null)} />
          </ScrollView>
          <View style={styles.foot}>
            <Pressable accessibilityRole="link" onPress={manage} style={styles.footLink}>
              <Icon name="add" size={18} color={colors.accent} />
              <Txt weight="semibold" color={colors.accent}>New event</Txt>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={manage} style={styles.footLink}>
              <Txt weight="semibold" color={colors.body}>Manage events</Txt>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

function Option({ label, detail, on, onPress }: { label: string; detail?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={on}
      onPress={onPress}
      style={({ hovered }) => [styles.option, on ? styles.optionOn : hovered && styles.optionHover]}
    >
      <View style={styles.tick}>{on ? <Icon name="checkmark" size={18} color={colors.accent} /> : null}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt weight={on ? 'semibold' : 'medium'} color={on ? colors.accent : colors.ink} numberOfLines={1}>{label}</Txt>
        {detail ? <Txt variant="small" numberOfLines={1}>{detail}</Txt> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: touch - 8, paddingHorizontal: 4 },
  box: {
    position: 'absolute',
    maxHeight: 460,
    padding: 8,
    gap: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    boxShadow: '0 12px 32px rgba(31, 26, 28, 0.18)',
  },
  head: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 2 },
  scroll: { flexGrow: 0 },
  option: { minHeight: touch + 8, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.md },
  optionOn: { backgroundColor: colors.accentSoft },
  optionHover: { backgroundColor: colors.raised },
  tick: { width: 24, alignItems: 'center' },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.line },
  footLink: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: touch, paddingHorizontal: 8 },
});
