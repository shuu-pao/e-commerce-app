import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { authStorage } from './authStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const onWeb = Platform.OS === 'web' && typeof window !== 'undefined';

/** What an emailed link (invitation or password reset) asked for when it opened the app. */
export type AuthLink = { kind: 'invite' | 'recovery' } | { kind: 'error'; message: string } | null;

/**
 * Read before the client below consumes the address. Supabase's emails send people to
 * the site with "#access_token=…&type=invite" (or type=recovery), or "#error_description=…".
 */
function readAuthLink(): AuthLink {
  if (!onWeb || !url) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const error = params.get('error_description');
  if (error) return { kind: 'error', message: error.replace(/\+/g, ' ') };
  const type = params.get('type');
  return params.get('access_token') && (type === 'invite' || type === 'recovery') ? { kind: type } : null;
}

export const authLinkAtStart: AuthLink = readAuthLink();

/** Removes what's left of an emailed link from the address, so a reload doesn't reopen it. */
export function forgetAuthLink() {
  if (onWeb && window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
}

/**
 * Null until the Supabase URL and publishable (anon) key are set in .env (see README).
 * Without them the app runs on this device only, with no sign-in and no sync.
 * Only that public key belongs here; row-level security protects the data.
 */
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: authStorage,
          persistSession: true,
          autoRefreshToken: true,
          // On the web, pick up the session from invitation and reset links.
          detectSessionInUrl: onWeb,
          flowType: 'implicit',
        },
      })
    : null;
