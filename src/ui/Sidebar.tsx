import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { router, useGlobalSearchParams, usePathname, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState, useLive } from '@/data/hooks';
import { pendingOrderCount } from '@/data/store';
import { signOut, syncEnabled, syncNow } from '@/data/sync';

import { currentState } from './a11y';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon, type IconName } from './Icon';
import { PasswordForm } from './PasswordForm';
import { colors, fonts, radius } from './theme';
import { Txt } from './Txt';

interface Props extends DrawerContentComponentProps {
  permanent: boolean;
  /** The slim strip of icons used while selling on a wide screen (design review 8). */
  slim?: boolean;
}

/** Width of the sidebar: full, or the slim strip of icons on Sell and Checkout. */
export const MENU_WIDTH = 260;
export const SLIM_MENU_WIDTH = 72;
/** Screens where a wide screen shows the slim menu, so the products and the cart get the room. */
export function slimMenuOn(pathname: string): boolean {
  return pathname === '/sell' || pathname === '/checkout';
}

interface Page {
  label: string;
  icon: IconName;
  href: Href;
  active: (pathname: string) => boolean;
}
const SELL: Page = { label: 'Sell', icon: 'bag-handle-outline', href: '/sell', active: (p) => p === '/sell' || p === '/checkout' };
const MAIN: Page[] = [
  { label: 'Home', icon: 'home-outline', href: '/home', active: (p) => p === '/home' },
  SELL,
  { label: 'All orders', icon: 'receipt-outline', href: '/orders', active: (p) => p.startsWith('/orders') || p === '/document' },
  { label: 'Reports', icon: 'bar-chart-outline', href: '/reports', active: (p) => p === '/reports' },
];
const MANAGE: Page[] = [
  { label: 'Products', icon: 'pricetag-outline', href: '/products', active: (p) => p.startsWith('/products') },
  { label: 'Categories', icon: 'folder-outline', href: '/categories', active: (p) => p === '/categories' },
  { label: 'Events', icon: 'calendar-outline', href: '/events', active: (p) => p === '/events' },
  { label: 'Shop details', icon: 'storefront-outline', href: '/shop', active: (p) => p === '/shop' },
];

export function Sidebar({ navigation, permanent, slim }: Props) {
  const [open, setOpen] = useState(false);
  if (!slim) return <FullMenu go={(href) => { router.navigate(href); if (!permanent) navigation.closeDrawer(); }} />;
  return (
    <>
      <SlimMenu onOpen={() => setOpen(true)} />
      {/* The full menu slides over the screen from the menu button, and closes once a page is picked. */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.overlayMenu} accessibilityViewIsModal>
            <FullMenu go={(href) => { setOpen(false); router.navigate(href); }} onClose={() => setOpen(false)} />
          </View>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} accessibilityLabel="Close the menu" />
        </View>
      </Modal>
    </>
  );
}

function FullMenu({ go, onClose }: { go: (href: Href) => void; onClose?: () => void }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { category } = useGlobalSearchParams<{ category?: string }>();
  const categories = useLive('categories');
  const sorted = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories]);
  const onSell = pathname === '/sell';
  const item = (p: Page) => <Item key={p.label} label={p.label} icon={p.icon} active={p !== SELL && p.active(pathname)} onPress={() => go(p.href)} />;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 12 }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.brandRow}>
          <Txt variant="brand" style={styles.brand}>caracebu</Txt>
          {onClose ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Close the menu" onPress={onClose} style={styles.closeMenu}>
              <Icon name="close" size={22} color={colors.body} />
            </Pressable>
          ) : null}
        </View>
        {MAIN.map((p) =>
          p !== SELL ? item(p) : (
            <View key="sell">
              {item(p)}
              <Item label="All products" sub active={onSell && !category} onPress={() => go('/sell')} />
              {sorted.map((c) => (
                <Item key={c.id} label={c.name} sub active={onSell && category === c.id} onPress={() => go({ pathname: '/sell', params: { category: c.id } })} />
              ))}
            </View>
          ),
        )}
        <Txt variant="label" style={styles.section}>Manage</Txt>
        {MANAGE.map(item)}
      </ScrollView>
      <UpdateBanner />
      <SyncBox />
    </View>
  );
}

/** Icons only, with the menu button on top (design review 8). Each icon's name is its accessible label. */
function SlimMenu({ onOpen }: { onOpen: () => void }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const status = useSyncStatus();
  return (
    <View style={[styles.wrap, styles.slim, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open the menu" onPress={onOpen} style={({ hovered }) => [styles.rail, hovered && styles.railHover]}>
        <Icon name="menu" size={26} color={colors.ink} />
      </Pressable>
      <ScrollView contentContainerStyle={styles.railList}>
        {[...MAIN, ...MANAGE].map((p) => {
          const active = p.active(pathname);
          return (
            <Pressable
              key={p.label}
              accessibilityRole="link"
              accessibilityLabel={p.label}
              {...currentState(active, 'page')}
              onPress={() => router.navigate(p.href)}
              style={({ hovered }) => [styles.rail, active ? styles.railOn : hovered && styles.railHover]}
            >
              <Icon name={p.icon} size={23} color={active ? colors.accent : colors.body} />
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${status.title}. ${status.detail}${syncEnabled ? '. Tap to sync now.' : ''}`}
        disabled={!syncEnabled}
        onPress={() => void syncNow(true)}
        style={styles.railSync}
      >
        <View style={[styles.railDot, { backgroundColor: status.dot }]} />
      </Pressable>
    </View>
  );
}

function Item({ label, icon, active, sub, onPress }: { label: string; icon?: IconName; active: boolean; sub?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      {...currentState(active, 'page')}
      onPress={onPress}
      style={({ hovered }) => [styles.item, sub && styles.sub, (active || hovered) && { backgroundColor: active ? colors.accentSoft : colors.raised }]}
    >
      {icon ? <Icon name={icon} size={20} color={active ? colors.accent : colors.body} /> : null}
      <Txt
        numberOfLines={1}
        style={[styles.itemText, sub && styles.subText, active && { color: colors.accent, fontFamily: fonts.semibold }]}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

/** What the sync box says: synced, waiting, offline, or this device only. */
function useSyncStatus() {
  const sync = useAppState((s) => s.sync);
  const outboxSize = useAppState((s) => Object.keys(s.outbox).length);
  const orders = useAppState((s) => pendingOrderCount(s));
  const saveError = useAppState((s) => s.saveError);

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
  return { title, detail, bg, ink, dot };
}

function SyncBox() {
  const { title, detail, bg, ink, dot } = useSyncStatus();
  const email = useAppState((s) => s.settings.signedInEmail);
  const [confirm, setConfirm] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [changed, setChanged] = useState(false);
  return (
    <View style={styles.syncWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${detail}${syncEnabled ? '. Tap to sync now.' : ''}`}
        disabled={!syncEnabled}
        onPress={() => void syncNow(true)}
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
      {syncEnabled && email ? (
        <Button label="Change password" variant="ghost" onPress={() => setChanging(true)} style={styles.changePw} />
      ) : null}
      <Modal visible={changing} transparent animationType="fade" onRequestClose={() => setChanging(false)}>
        <View style={styles.scrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChanging(false)} accessibilityLabel="Close" />
          <View style={styles.dialog} accessibilityViewIsModal>
            <Txt variant="heading">Change password</Txt>
            <PasswordForm
              askCurrent
              submitLabel="Save new password"
              onDone={() => {
                setChanging(false);
                setChanged(true);
              }}
            />
            <Button label="Cancel" variant="ghost" onPress={() => setChanging(false)} />
          </View>
        </View>
      </Modal>
      <ConfirmDialog
        visible={changed}
        title="Password changed"
        message="Other devices were signed out. Sign in there with the new password."
        confirmLabel="OK"
        onCancel={() => setChanged(false)}
        onConfirm={() => setChanged(false)}
      />
      <ConfirmDialog
        visible={confirm}
        title="Sign out of this device?"
        message="Your data stays online. This device forgets it until you sign in again."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
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
      <Button
        label="Reload"
        variant="outline"
        onPress={() => {
          const w = window as typeof window & { __applyUpdate?: () => void };
          if (w.__applyUpdate) w.__applyUpdate();
          else window.location.reload();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.line },
  scroll: { paddingRight: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 4 },
  brand: { paddingHorizontal: 20, paddingBottom: 12 },
  closeMenu: { width: 44, height: 44, marginTop: -12, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  item: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, borderTopRightRadius: radius.pill, borderBottomRightRadius: radius.pill },
  sub: { minHeight: 38, paddingLeft: 52 },
  slim: { alignItems: 'center', paddingHorizontal: 0 },
  railList: { alignItems: 'center', gap: 6, paddingTop: 14 },
  rail: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  railHover: { backgroundColor: colors.raised },
  railOn: { backgroundColor: colors.accentSoft },
  railSync: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  railDot: { width: 12, height: 12, borderRadius: 6 },
  overlay: { flex: 1, flexDirection: 'row', backgroundColor: colors.scrim },
  overlayMenu: { width: MENU_WIDTH, maxWidth: '85%', backgroundColor: colors.surface },
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
  changePw: { alignSelf: 'flex-start', marginTop: -6 },
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420, gap: 12, padding: 24, borderRadius: radius.lg + 2, backgroundColor: colors.white },
});
