import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { router, useGlobalSearchParams, usePathname, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState, useLive } from '@/data/hooks';
import { pendingOrderCount } from '@/data/store';
import { signOut, syncEnabled, syncNow } from '@/data/sync';

import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { colors, fonts, radius } from './theme';
import { Txt } from './Txt';

interface Props extends DrawerContentComponentProps {
  permanent: boolean;
}

export function Sidebar({ navigation, permanent }: Props) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { category } = useGlobalSearchParams<{ category?: string }>();
  const categories = useLive('categories');
  const sorted = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories]);

  const go = (href: Href) => {
    router.navigate(href);
    if (!permanent) navigation.closeDrawer();
  };

  const onSell = pathname === '/sell';
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 12 }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Txt weight="bold" style={styles.brand}>caracebu</Txt>
        <Item label="Home" active={pathname === '/home'} onPress={() => go('/home')} />
        <Item label="Sell" active={false} onPress={() => go('/sell')} />
        <Item label="All products" sub active={onSell && !category} onPress={() => go('/sell')} />
        {sorted.map((c) => (
          <Item key={c.id} label={c.name} sub active={onSell && category === c.id} onPress={() => go({ pathname: '/sell', params: { category: c.id } })} />
        ))}
        <Item label="All orders" active={pathname.startsWith('/orders')} onPress={() => go('/orders')} />
        <Item label="Reports" active={pathname === '/reports'} onPress={() => go('/reports')} />
        <Txt variant="label" style={styles.section}>Manage</Txt>
        <Item label="Products" active={pathname.startsWith('/products')} onPress={() => go('/products')} />
        <Item label="Categories" active={pathname === '/categories'} onPress={() => go('/categories')} />
        <Item label="Events" active={pathname === '/events'} onPress={() => go('/events')} />
      </ScrollView>
      <UpdateBanner />
      <SyncBox />
    </View>
  );
}

function Item({ label, active, sub, onPress }: { label: string; active: boolean; sub?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ hovered }) => [styles.item, sub && styles.sub, (active || hovered) && { backgroundColor: active ? colors.accentSoft : colors.raised }]}
    >
      <Txt
        numberOfLines={1}
        style={[styles.itemText, sub && styles.subText, active && { color: colors.accent, fontFamily: fonts.semibold }]}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

function SyncBox() {
  const sync = useAppState((s) => s.sync);
  const outboxSize = useAppState((s) => Object.keys(s.outbox).length);
  const orders = useAppState((s) => pendingOrderCount(s));
  const email = useAppState((s) => s.settings.signedInEmail);
  const saveError = useAppState((s) => s.saveError);
  const [confirm, setConfirm] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  let tone: 'ok' | 'warn' | 'plain' = 'plain';
  let title = 'On this device only';
  let detail = 'Add Supabase keys to sync with your other devices.';
  if (saveError) {
    tone = 'warn';
    title = 'Not saved';
    detail = saveError;
  } else if (syncEnabled) {
    const waiting = orders ? `${orders} order${orders === 1 ? '' : 's'} waiting to sync` : outboxSize ? `${outboxSize} change${outboxSize === 1 ? '' : 's'} waiting to sync` : null;
    if (!sync.online) {
      tone = 'warn';
      title = 'Offline';
      detail = waiting ?? 'Sales save on this device.';
    } else if (sync.error) {
      tone = 'warn';
      title = 'Not synced';
      detail = sync.error;
    } else if (sync.syncing || waiting) {
      tone = 'warn';
      title = 'Syncing…';
      detail = waiting ?? 'Checking for changes';
    } else {
      tone = 'ok';
      title = 'Online';
      detail = 'Everything is synced';
    }
  }

  const bg = tone === 'ok' ? colors.okBg : tone === 'warn' ? colors.warnBg : colors.raised;
  const ink = tone === 'ok' ? colors.okInk : tone === 'warn' ? colors.warnInk : colors.body;
  const dot = tone === 'ok' ? colors.okDot : tone === 'warn' ? colors.warnDot : colors.lineStrong;
  return (
    <View style={styles.syncWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${detail}${syncEnabled ? '. Tap to sync now.' : ''}`}
        disabled={!syncEnabled}
        onPress={() => void syncNow()}
        style={[styles.sync, { backgroundColor: bg }]}
      >
        <View style={styles.syncTitle}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <Txt weight="bold" color={ink} style={styles.syncText}>{title}</Txt>
        </View>
        <Txt color={ink} style={styles.syncText}>{detail}</Txt>
      </Pressable>
      {syncEnabled && email ? (
        <View style={styles.account}>
          <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>{email}</Txt>
          <Button label="Sign out" variant="ghost" onPress={() => setConfirm(true)} />
        </View>
      ) : null}
      <ConfirmDialog
        visible={confirm}
        title="Sign out of this device?"
        message="Your data stays online. This device forgets it until you sign in again."
        confirmLabel="Sign out"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          setRefusal(await signOut());
        }}
      />
      <ConfirmDialog
        visible={!!refusal}
        title="Can't sign out yet"
        message={refusal ?? ''}
        confirmLabel="OK"
        onCancel={() => setRefusal(null)}
        onConfirm={() => setRefusal(null)}
      />
    </View>
  );
}

/** Shown when a new version of the web app has downloaded (see public/index.html). */
function UpdateBanner() {
  const [ready, setReady] = useState(
    () => Platform.OS === 'web' && typeof window !== 'undefined' && !!(window as typeof window & { __updateReady?: boolean }).__updateReady,
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const on = () => setReady(true);
    window.addEventListener('appupdate', on);
    return () => window.removeEventListener('appupdate', on);
  }, []);
  if (!ready) return null;
  return (
    <View style={[styles.sync, styles.update]}>
      <Txt weight="bold" color={colors.accent} style={styles.syncText}>A new version is ready</Txt>
      <Button label="Reload" variant="outline" onPress={() => window.location.reload()} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.line },
  scroll: { paddingRight: 12 },
  brand: { fontSize: 19, paddingHorizontal: 20, paddingBottom: 14 },
  item: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, borderTopRightRadius: radius.pill, borderBottomRightRadius: radius.pill },
  sub: { minHeight: 38, paddingLeft: 34 },
  itemText: { fontFamily: fonts.medium, fontSize: 15 },
  subText: { fontFamily: fonts.regular, fontSize: 14, color: colors.body },
  section: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
  syncWrap: { paddingHorizontal: 12, gap: 6, paddingTop: 8 },
  sync: { padding: 12, borderRadius: radius.md, gap: 2 },
  update: { backgroundColor: colors.accentSoft, gap: 8, marginHorizontal: 12 },
  syncTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncText: { fontSize: 13, lineHeight: 18 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4 },
});
