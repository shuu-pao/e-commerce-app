import { createClient } from '@supabase/supabase-js';

import { authStorage } from './authStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Null until the Supabase URL and anon key are set in .env (see README).
 * Without them the app runs on this device only, with no sign-in and no sync.
 * Only the anon key belongs here; row-level security protects the data.
 */
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null;
