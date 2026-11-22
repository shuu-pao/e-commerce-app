import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { shopGaps } from '@/domain/documents';
import type { PayAccount } from '@/domain/types';
import { useShop } from '@/data/hooks';
import { newId, saveShop } from '@/data/store';
import { pickWholePhoto } from '@/lib/photo';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Card, Screen } from '@/ui/Screen';
import { colors, radius } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

const MAX_ACCOUNTS = 6;

/**
 * The shop's details on every invoice and receipt (client, round 6): who it's from, and the
 * accounts and QR code buyers pay into. Saved in the shop's data, never in the code (the repo is public).
 */
export default function ShopDetailsScreen() {
  const shop = useShop();
  const [savedStamp, setSavedStamp] = useState<string | null>(null);
  // Opened fresh from the saved record each time it changes (say, from the other device).
  return <ShopForm key={shop.updatedAt} justSaved={savedStamp === shop.updatedAt} onSaved={setSavedStamp} />;
}

function ShopForm({ justSaved, onSaved }: { justSaved: boolean; onSaved: (stamp: string) => void }) {
  const shop = useShop();
  const [shopName, setShopName] = useState(shop.shopName);
  const [ownerName, setOwnerName] = useState(shop.ownerName);
  const [phone, setPhone] = useState(shop.phone);
  const [address, setAddress] = useState(shop.address);
  const [accounts, setAccounts] = useState<PayAccount[]>(shop.accounts);
  const [qrPhoto, setQrPhoto] = useState(shop.qrPhoto);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState<string | null>(justSaved ? 'Saved.' : null);

  const setAccount = (i: number, patch: Partial<PayAccount>) => setAccounts(accounts.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const details = { shopName: shopName.trim() || 'caracebu', ownerName: ownerName.trim(), phone: phone.trim(), address: address.trim(), accounts: accounts.map((a) => ({ ...a, bank: a.bank.trim(), accountName: a.accountName.trim(), number: a.number.trim() })), qrPhoto };
  const gaps = shopGaps({ ...shop, ...details });

  const pickQr = async () => {
    setPicking(true);
    setNote(null);
    try {
      const photo = await pickWholePhoto();
      if (photo) setQrPhoto(photo);
    } catch {
      setNote("That picture couldn't be opened. Try a screenshot of the QR code.");
    } finally {
      setPicking(false);
    }
  };

  return (
    <Screen maxWidth={640}>
      <View style={styles.head}>
        <Txt variant="title">Shop details</Txt>
        <Txt color={colors.body}>These go on every Invoice and Payment receipt. Buyers see them; nobody else does.</Txt>
      </View>

      <Card>
        <Txt variant="heading">From</Txt>
        <Field label="Shop name" value={shopName} onChangeText={setShopName} />
        <Field label="Your name" value={ownerName} onChangeText={setOwnerName} autoCapitalize="words" />
        <Field label="Phone number" value={phone} onChangeText={setPhone} inputMode="tel" keyboardType="phone-pad" />
        <Field label="Address" value={address} onChangeText={setAddress} multiline placeholder="Street, barangay, city" />
      </Card>

      <Card>
        <Txt variant="heading">Payment details</Txt>
        <Txt variant="small">The invoice lists every account with a number. Leave one empty to keep it off.</Txt>
        {accounts.map((a, i) => (
          <View key={a.id} style={styles.account}>
            <View style={styles.accountHead}>
              <Field label={`Bank or app ${i + 1}`} value={a.bank} onChangeText={(v) => setAccount(i, { bank: v })} placeholder="GCash, BPI, …" style={{ flex: 1 }} />
              <Button label="Remove" variant="ghost" accessibilityLabel={`Remove ${a.bank || `account ${i + 1}`}`} onPress={() => setAccounts(accounts.filter((_, j) => j !== i))} />
            </View>
            <Field label="Account name" value={a.accountName} onChangeText={(v) => setAccount(i, { accountName: v })} autoCapitalize="words" />
            <Field label="Account number" value={a.number} onChangeText={(v) => setAccount(i, { number: v })} inputMode="numeric" />
          </View>
        ))}
        {accounts.length < MAX_ACCOUNTS ? (
          <Button label="Add an account" variant="ghost" icon="add" onPress={() => setAccounts([...accounts, { id: newId(), bank: '', accountName: '', number: '' }])} style={styles.inline} />
        ) : null}
      </Card>

      <Card>
        <Txt variant="heading">QR code</Txt>
        <Txt variant="small">A screenshot of your GCash or bank QR code. It shows on the invoice under the accounts.</Txt>
        {qrPhoto ? <Image source={{ uri: qrPhoto }} style={styles.qr} contentFit="contain" accessibilityLabel="Your QR code" /> : null}
        <View style={styles.row}>
          <Button label={picking ? 'Opening…' : qrPhoto ? 'Change the picture' : 'Add the QR code picture'} variant="outline" onPress={pickQr} busy={picking} />
          {qrPhoto ? <Button label="Remove" variant="ghost" onPress={() => setQrPhoto(null)} /> : null}
        </View>
      </Card>

      {gaps.length ? <Txt color={colors.warnInk}>Still to add: {gaps.join(' and ')}.</Txt> : null}
      {note ? <Txt color={colors.accent} weight="semibold" accessibilityLiveRegion="polite">{note}</Txt> : null}
      <Button
        label="Save"
        size="lg"
        disabled={picking}
        onPress={() => {
          onSaved(saveShop(details).updatedAt);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 4 },
  account: { gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  accountHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  inline: { alignSelf: 'flex-start', marginLeft: -8 },
  qr: { width: 200, height: 200, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
