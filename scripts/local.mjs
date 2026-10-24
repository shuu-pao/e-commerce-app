// npm run web:local — the app on this computer only: no Supabase keys, so no sign-in, no sync,
// and no way to reach the shop's live data. Products and orders stay in this browser.
// (Empty values win over .env; doing this by hand in PowerShell deletes the variables instead,
// and the app would connect to the live project.)
import { spawn } from 'node:child_process';

const env = { ...process.env, EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_ANON_KEY: '' };
spawn('npx expo start --web --port 8083', { stdio: 'inherit', env, shell: true }).on('exit', (code) => process.exit(code ?? 0));
