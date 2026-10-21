import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { signIn } from '@/data/sync';

import { Button } from './Button';
import { Field } from './Field';
import { colors, radius } from './theme';
import { Txt } from './Txt';

/** One login for the shop owner. Accounts are created in the Supabase dashboard (sign-ups are off). */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <View style={styles.card}>
        <Txt variant="title">caracebu</Txt>
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.surface },
  card: { width: '100%', maxWidth: 400, gap: 16, padding: 28, borderRadius: radius.lg + 2, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
});
