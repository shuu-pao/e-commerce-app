// Uploads the outbox and downloads changes from the other device, whenever there's internet.
// Works offline-first: selling never waits on this. See docs/BRIEF.md, "Offline plan".
import { AppState as RNAppState, Platform } from 'react-native';

import type { CollectionName, Collections } from '@/domain/types';

import * as store from './store';
import { supabase } from './supabase';

const MAX_BATCH_BYTES = 800_000; // photos make records big; keep each request well under API limits
const PAGE = 500;

let running = false;
let runAgain = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export const syncEnabled = supabase !== null;

function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
  return /fetch|network|load failed|timed? ?out/i.test(msg);
}

function message(e: unknown): string {
  return typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
}

/** The login itself is no longer valid (password changed elsewhere, session revoked or expired). */
function loginRejected(e: unknown): boolean {
  const status = typeof e === 'object' && e && 'status' in e ? Number(e.status) : 0;
  return status === 401 || /refresh token|auth session missing|jwt expired|invalid jwt|not authenticated/i.test(message(e));
}

function describe(e: unknown): string {
  const msg = message(e);
  if (/row-level security|permission denied|42501/i.test(msg)) return 'This login isn’t on the shop’s owner list. Ask Paolo to add it.';
  return `Sync failed: ${msg}`;
}

function* batches(records: store.RemoteRecord[]) {
  let batch: store.RemoteRecord[] = [];
  let size = 0;
  for (const r of records) {
    const bytes = JSON.stringify(r.record).length;
    if (batch.length && size + bytes > MAX_BATCH_BYTES) {
      yield batch;
      batch = [];
      size = 0;
    }
    batch.push(r);
    size += bytes;
  }
  if (batch.length) yield batch;
}

async function push() {
  if (!supabase) return;
  for (const batch of batches(store.outboxRecords())) {
    const rows = batch.map(({ collection, record }) => ({
      collection,
      id: record.id,
      data: record,
      updated_at: record.updatedAt,
      deleted: !!record.deleted,
    }));
    const { error } = await supabase.rpc('push_records', { rows });
    if (error) throw error;
    store.markUploaded(batch.map(({ collection, record }) => ({ collection, id: record.id, updatedAt: record.updatedAt })));
  }
}

async function pull() {
  if (!supabase) return;
  const cursor = store.getState().settings.lastPulledAt;
  // Re-read a few seconds back: a change committed just as we last read can carry an older time.
  const since = cursor ? new Date(Date.parse(cursor) - 5000).toISOString() : '1970-01-01T00:00:00.000Z';
  let newest = cursor;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('records')
      .select('collection, data, synced_at')
      .gt('synced_at', since)
      .order('synced_at')
      .order('id')
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    store.applyRemote(
      data.map((row) => ({
        collection: row.collection as CollectionName,
        record: row.data as Collections[CollectionName],
      })),
    );
    for (const row of data) {
      if (!newest || Date.parse(row.synced_at) > Date.parse(newest)) newest = row.synced_at as string;
    }
    if (data.length < PAGE) break;
  }
  // An empty first download still counts as done (the epoch means "nothing newer seen yet").
  const done = newest ?? '1970-01-01T00:00:00.000Z';
  if (done !== cursor) store.updateSettings({ lastPulledAt: done });
}

export async function syncNow(): Promise<void> {
  if (!supabase || !store.getState().settings.signedInEmail) return;
  if (running) {
    runAgain = true;
    return;
  }
  running = true;
  store.updateSync({ syncing: true });
  try {
    await push();
    await pull();
    store.updateSync({ online: true, error: null, lastSyncedAt: new Date().toISOString() });
  } catch (e) {
    if (isNetworkError(e)) store.updateSync({ online: false, error: null });
    else if (loginRejected(e)) {
      // Show the sign-in screen again. Nothing on the device is lost; unsent orders upload after signing in.
      store.updateSync({ online: true, error: null });
      store.updateSettings({ signedInEmail: null });
    } else store.updateSync({ online: true, error: describe(e) });
  } finally {
    running = false;
    store.updateSync({ syncing: false });
    if (runAgain) {
      runAgain = false;
      schedule(500);
    }
  }
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, ms);
}

/** Starts background syncing; returns a function that stops it. */
export function startSync(): () => void {
  if (!supabase) return () => {};
  const cleanups: (() => void)[] = [];

  let outboxSize = Object.keys(store.getState().outbox).length;
  cleanups.push(
    store.subscribe(() => {
      const size = Object.keys(store.getState().outbox).length;
      if (size > outboxSize) schedule(1500);
      outboxSize = size;
    }),
  );

  const interval = setInterval(() => void syncNow(), 60_000);
  cleanups.push(() => clearInterval(interval));

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const online = () => {
      store.updateSync({ online: true });
      void syncNow();
    };
    const offline = () => store.updateSync({ online: false });
    const visible = () => document.visibilityState === 'visible' && void syncNow();
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visible);
    store.updateSync({ online: navigator.onLine });
    cleanups.push(() => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', visible);
    });
  } else {
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && void syncNow());
    cleanups.push(() => sub.remove());
  }

  void syncNow();
  return () => {
    for (const c of cleanups) c();
    if (timer) clearTimeout(timer);
  };
}

// ---- Signing in and out --------------------------------------------------------

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return isNetworkError(error) ? 'No internet. Signing in needs a connection the first time.' : 'Wrong email or password.';
  // Never synced before (device-only data, or a fresh device): upload everything once.
  if (!store.getState().settings.lastPulledAt) store.queueEverything();
  store.updateSettings({ signedInEmail: email.trim() });
  void syncNow();
  return null;
}

/** Emails a link that opens the app on "Set your password". */
export async function sendPasswordReset(email: string): Promise<string | null> {
  if (!supabase) return null;
  const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (!error) return null;
  if (isNetworkError(error)) return 'No internet. Try again when you are online.';
  if (/rate|seconds|too many/i.test(error.message)) return 'Too many emails were sent just now. Wait a few minutes, then try again.';
  return error.message;
}

/**
 * Checks the session an emailed link just created. A link for a different account than the one
 * signed in on this device is refused (someone could send the seller a link to their own account),
 * and the device asks for a normal sign-in again, keeping its data.
 */
export async function checkLinkSession(): Promise<'ok' | 'none' | 'otherAccount'> {
  if (!supabase) return 'none';
  const { data } = await supabase.auth.getSession();
  const email = data.session?.user.email;
  if (!email) return 'none';
  const current = store.getState().settings.signedInEmail;
  if (current && current.toLowerCase() !== email.toLowerCase()) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    store.updateSettings({ signedInEmail: null });
    return 'otherAccount';
  }
  return 'ok';
}

/**
 * Sets a new password for whoever is signed in: after an invitation or reset link, or from
 * "Change password". Finishes signing this device in if it wasn't already.
 */
export async function setNewPassword(password: string, currentPassword?: string): Promise<string | null> {
  if (!supabase) return null;
  if (currentPassword !== undefined) {
    // Changing a known password: prove it's the owner first, not just someone holding the iPad.
    const email = store.getState().settings.signedInEmail ?? '';
    const check = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (check.error) return isNetworkError(check.error) ? 'No internet. Changing the password needs a connection.' : 'The current password is wrong.';
  }
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (isNetworkError(error)) return 'No internet. Changing the password needs a connection.';
    if (/different/i.test(error.message)) return 'That is the current password. Choose a new one.';
    if (/session|jwt|auth/i.test(error.message)) return 'This link has expired. Ask for a new one.';
    return error.message;
  }
  // Sign out every other device that knew the old password.
  await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);
  const email = data.user?.email ?? null;
  if (email && !store.getState().settings.signedInEmail) {
    // Signing this device in (checkLinkSession already refused other accounts).
    if (!store.getState().settings.lastPulledAt) store.queueEverything();
    store.updateSettings({ signedInEmail: email });
  }
  void syncNow();
  return null;
}

/** Refuses while orders still wait to upload, so nothing sold is lost. */
export async function signOut(): Promise<string | null> {
  if (!supabase) return null;
  const waiting = Object.keys(store.getState().outbox).length;
  if (waiting) return `${waiting} change${waiting === 1 ? '' : 's'} still need to upload. Connect to the internet and wait for them to sync first.`;
  // Revoke the session on the server; if that can't happen (offline), still remove it from this device.
  const { error } = await supabase.auth.signOut().catch((e: unknown) => ({ error: e }));
  if (error) {
    const local = await supabase.auth.signOut({ scope: 'local' }).catch((e: unknown) => ({ error: e }));
    if (local.error) return 'Signing out failed. Close the app, open it again and try once more.';
  }
  await store.clearDevice();
  return null;
}
