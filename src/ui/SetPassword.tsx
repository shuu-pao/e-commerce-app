import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { AuthLink } from '@/data/supabase';
import { checkLinkSession } from '@/data/sync';

import { Button } from './Button';
import { PasswordForm } from './PasswordForm';
import { colors, radius } from './theme';
import { Txt } from './Txt';

/** Opens from an emailed invitation or password-reset link. */
export function SetPassword({ link, onDone }: { link: NonNullable<AuthLink>; onDone: () => void }) {
  const [state, setState] = useState<'checking' | 'ready' | 'expired' | 'otherAccount'>(link.kind === 'error' ? 'expired' : 'checking');

  useEffect(() => {
    if (link.kind === 'error') return;
    let live = true;
    void checkLinkSession().then((r) => live && setState(r === 'ok' ? 'ready' : r === 'none' ? 'expired' : 'otherAccount'));
    return () => {
      live = false;
    };
  }, [link]);

  const invite = link.kind === 'invite';
  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Txt variant="brand" style={styles.brand} accessibilityLabel="caracebu">{'cara\ncebu'}</Txt>
        {state === 'checking' ? (
          <ActivityIndicator color={colors.accent} />
        ) : state === 'otherAccount' ? (
          <>
            <Txt variant="heading">This link is for a different account</Txt>
            <Txt color={colors.body}>
              This device is set up for another login, so the link was ignored. Sign in again with your usual email and password; nothing on
              this device was lost.
            </Txt>
            <Button label="Go to sign in" onPress={onDone} />
          </>
        ) : state === 'expired' ? (
          <>
            <Txt variant="heading">This link doesn’t work any more</Txt>
            <Txt color={colors.body}>
              Links from these emails work once and expire after a while. Ask for a new invitation, or use “Forgot password?” on the sign-in
              screen.
            </Txt>
            <Button label="Go to sign in" onPress={onDone} />
          </>
        ) : (
          <>
            <Txt variant="heading">{invite ? 'Welcome! Choose your password' : 'Choose a new password'}</Txt>
            <Txt color={colors.body}>
              {invite ? 'You’ll use it with your email to sign in on the iPad and the computer.' : 'Use it from now on to sign in.'}
            </Txt>
            <PasswordForm submitLabel={invite ? 'Save and start' : 'Save new password'} onDone={onDone} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: 32, lineHeight: 32, textAlign: 'center', paddingTop: 4 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.surface },
  card: { width: '100%', maxWidth: 420, gap: 16, padding: 28, borderRadius: radius.lg + 2, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
});
