import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { sendPasswordReset, signIn } from '@/data/sync';

import { Button } from './Button';
import { Field } from './Field';
import { colors, radius } from './theme';
import { Txt } from './Txt';

/** One login for the shop owner, who joins by invitation (sign-ups are off). */
export function SignIn({ onBack }: { onBack?: () => void }) {
  const [mode, setMode] = useState<'signIn' | 'forgot'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  // Gentle client-side brakes; Supabase's own per-network limits are the real protection.
  const [failures, setFailures] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const waitUntil = Math.max(lockedUntil, sent ? resendAt : 0);
  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [waitUntil]);
  const lockSeconds = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const resendSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const submit = async () => {
    if (!email.trim() || (mode === 'signIn' && !password)) {
      setError(mode === 'signIn' ? 'Enter your email and password.' : 'Enter your email.');
      return;
    }
    if (mode === 'signIn' && lockSeconds) return;
    setBusy(true);
    if (mode === 'signIn') {
      const problem = await signIn(email, password);
      setError(problem);
      if (problem === 'Wrong email or password.') {
        const n = failures + 1;
        setFailures(n);
        // After 5 wrong tries, wait 30 s; each further 5 doubles it, up to 5 minutes.
        if (n % 5 === 0) {
          setLockedUntil(Date.now() + Math.min(30_000 * 2 ** (n / 5 - 1), 300_000));
          setNow(Date.now());
        }
      }
    } else {
      const problem = await sendPasswordReset(email);
      setError(problem);
      setSent(!problem);
      if (!problem) {
        setResendAt(Date.now() + 60_000); // Supabase allows one reset email per minute per user
        setNow(Date.now());
      }
    }
    setBusy(false);
  };

  const switchTo = (next: 'signIn' | 'forgot') => {
    setMode(next);
    setError(null);
    setSent(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <View style={styles.card}>
        <Txt variant="brand" style={styles.brand} accessibilityLabel="caracebu">{'cara\ncebu'}</Txt>
        {mode === 'signIn' ? (
          <>
            <Txt color={colors.body}>Sign in to sell and see your orders.</Txt>
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={submit}
              error={error}
            />
            {lockSeconds ? (
              <Txt color={colors.warnInk}>Too many wrong passwords. Try again in {lockSeconds} s, or use “Forgot password?”.</Txt>
            ) : null}
            <Button label={lockSeconds ? `Try again in ${lockSeconds} s` : 'Sign in'} size="lg" onPress={submit} busy={busy} disabled={!!lockSeconds} />
            <Button label="Forgot password?" variant="ghost" onPress={() => switchTo('forgot')} style={styles.link} />
            {onBack ? <Button label="Back to the catalog" variant="ghost" icon="chevron-back" onPress={onBack} style={styles.link} /> : null}
          </>
        ) : sent ? (
          <>
            <Txt variant="heading">Check your email</Txt>
            <Txt color={colors.body}>
              If {email.trim()} has an account, a link to choose a new password is on its way. Open it on this device. It can take a few minutes; check
              spam too.
            </Txt>
            <Txt variant="small">Only a few of these emails can be sent per hour, so wait for this one before asking again.</Txt>
            <Button
              label={resendSeconds ? `Send again in ${resendSeconds} s` : 'Send again'}
              variant="ghost"
              disabled={!!resendSeconds || busy}
              onPress={() => {
                setSent(false);
                void submit();
              }}
            />
            <Button label="Back to sign in" variant="outline" onPress={() => switchTo('signIn')} />
          </>
        ) : (
          <>
            <Txt color={colors.body}>Type your email and we’ll send a link to choose a new password.</Txt>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              onSubmitEditing={submit}
              error={error}
            />
            <Button label="Send link" size="lg" onPress={submit} busy={busy} />
            <Button label="Back to sign in" variant="ghost" onPress={() => switchTo('signIn')} style={styles.link} />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: 32, lineHeight: 32, textAlign: 'center', paddingTop: 4 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.surface },
  card: { width: '100%', maxWidth: 400, gap: 16, padding: 28, borderRadius: radius.lg + 2, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  link: { alignSelf: 'center' },
});
