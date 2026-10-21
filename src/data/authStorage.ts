// Where the Supabase login session is kept on iOS and Android. The web uses localStorage (authStorage.web.ts).
import Storage from 'expo-sqlite/kv-store';

export const authStorage = Storage;
