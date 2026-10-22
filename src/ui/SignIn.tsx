import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { sendPasswordReset, signIn } from '@/data/sync';

import { Button } from './Button';
import { Field } from './Field';
import { colors, radius } from './theme';
import { Txt } from './Txt';

/** One login for the shop owner, who joins by invitation (sign-ups are off). */
export function SignIn() {
  const [mode, setMode] = useState<'signIn' | 'forgot'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || (mode === 'signIn' && !password)) {
      setError(mode === 'signIn' ? 'Enter your email and password.' : 'Enter your email.');
      return;
    }
    setBusy(true);
    if (mode === 'signIn') {
      setError(await signIn(email, password));
    } else {
      const problem = await sendPasswordReset(email);
      setError(problem);
      setSent(!problem);
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
        <Txt variant="title">caracebu</Txt>
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
            <Button label="Sign in" size="lg" onPress={submit} busy={busy} />
            <Button label="Forgot password?" variant="ghost" onPress={() => switchTo('forgot')} style={styles.link} />
          </>
        ) : sent ? (
          <>
            <Txt variant="heading">Check your email</Txt>
            <Txt color={colors.body}>
              If {email.trim()} has an account, a link to choose a new password is on its way. Open it on this device. It can take a few minutes; check
              spam too.
            </Txt>
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
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.surface },
  card: { width: '100%', maxWidth: 400, gap: 16, padding: 28, borderRadius: radius.lg + 2, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  link: { alignSelf: 'center' },
});
