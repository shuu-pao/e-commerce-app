import { useState } from 'react';
import { View } from 'react-native';

import { setNewPassword } from '@/data/sync';

import { Button } from './Button';
import { Field } from './Field';

const MIN = 8;

/** New password, typed twice. Used after an invitation or reset link, and for Change password. */
export function PasswordForm({ submitLabel, onDone }: { submitLabel: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password.length < MIN) return setError(`Use at least ${MIN} characters.`);
    if (password !== again) return setError('The two passwords don’t match.');
    setBusy(true);
    const problem = await setNewPassword(password);
    setBusy(false);
    if (problem) setError(problem);
    else onDone();
  };

  return (
    <View style={{ gap: 14 }}>
      <Field
        label="New password"
        value={password}
        onChangeText={(t) => { setPassword(t); setError(null); }}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint={`At least ${MIN} characters.`}
      />
      <Field
        label="Type it again"
        value={again}
        onChangeText={(t) => { setAgain(t); setError(null); }}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
        error={error}
      />
      <Button label={submitLabel} size="lg" onPress={submit} busy={busy} />
    </View>
  );
}
