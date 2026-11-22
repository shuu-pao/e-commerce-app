import { router, useLocalSearchParams } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

import { formatOrderNumber } from '@/domain/checkout';
import { buildDocument, shopGaps, type DocKind, type DocModel } from '@/domain/documents';
import { useAppState, useShop } from '@/data/hooks';
import { renderDocument, saveFile, type RenderedDocument } from '@/lib/documents';
import { Button } from '@/ui/Button';
import { Card, Empty, Screen } from '@/ui/Screen';
import { colors, radius } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

/** An order's Invoice or Payment receipt: a preview, then Save as picture or Save as PDF. */
export default function DocumentScreen() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id: string; kind?: string }>();
  const kind: DocKind = kindParam === 'receipt' ? 'receipt' : 'invoice';
  const order = useAppState((s) => s.db.orders[id]);
  const shop = useShop();
  const doc = useMemo(() => (order ? buildDocument(kind, order, shop) : null), [kind, order, shop]);
  // Kept with the document it was drawn from, so a change (say, new shop details) never saves an old copy.
  const [result, setResult] = useState<{ doc: DocModel; rendered: RenderedDocument | null; failed: boolean } | null>(null);
  const current = result && result.doc === doc ? result : null;
  const rendered = current?.rendered ?? null;
  const failed = current?.failed ?? false;
  const [note, setNote] = useState<string | null>(null);

  // Drawn ahead of the tap, so the share sheet opens straight from it (Safari only allows sharing
  // right after a tap).
  useEffect(() => {
    if (!doc) return;
    let live = true;
    let made: RenderedDocument | null = null;
    renderDocument(doc)
      .then((r) => {
        made = r;
        if (live) setResult({ doc, rendered: r, failed: false });
        else if (r) URL.revokeObjectURL(r.previewUri);
      })
      .catch((e: unknown) => {
        console.error('Drawing the document failed', e);
        if (live) setResult({ doc, rendered: null, failed: true });
      });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made.previewUri);
    };
  }, [doc]);

  if (!order || order.deleted || !doc) {
    return (
      <Empty title="Order not found" message={order?.deleted ? 'This order was deleted.' : 'It may not have synced to this device yet.'}>
        <Button label="All orders" onPress={() => router.replace('/orders')} />
      </Empty>
    );
  }
  if (kind === 'receipt' && order.notPaid) {
    return (
      <Empty title="Not paid yet" message="The Payment receipt is ready once the order is marked paid.">
        <Button label="Back to the order" onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: order.id } })} />
      </Empty>
    );
  }

  const save = async (what: 'png' | 'pdf') => {
    if (!rendered) return;
    setNote(null);
    const result = await saveFile(what === 'png' ? rendered.png : rendered.pdf, `${doc.fileName}.${what}`);
    if (result === 'downloaded') setNote(what === 'png' ? 'The picture is in your downloads.' : 'The PDF is in your downloads.');
  };
  const gaps = shopGaps(shop);

  return (
    <Screen maxWidth={760}>
      <Drawer.Screen options={{ title: `${doc.title} ${formatOrderNumber(order.number)}` }} />
      <Button label={`Back to order ${formatOrderNumber(order.number)}`} variant="ghost" icon="chevron-back" onPress={() => router.navigate({ pathname: '/orders/[id]', params: { id: order.id } })} style={styles.back} />

      {gaps.length ? (
        <Card style={styles.warn}>
          <Txt weight="semibold" color={colors.warnInk}>Still to add in Shop details: {gaps.join(' and ')}.</Txt>
          <Button label="Open Shop details" variant="outline" onPress={() => router.navigate('/shop')} style={styles.inline} />
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button label="Save as picture" icon="download-outline" size="lg" disabled={!rendered} onPress={() => void save('png')} style={styles.grow} />
        <Button label="Save as PDF" icon="download-outline" size="lg" variant="outline" disabled={!rendered} onPress={() => void save('pdf')} style={styles.grow} />
      </View>
      {note ? <Txt color={colors.okInk} weight="semibold" accessibilityLiveRegion="polite">{note}</Txt> : null}

      {Platform.OS !== 'web' ? (
        <Txt color={colors.body}>Invoices and receipts work in the web app. Open the shop in Safari or Chrome.</Txt>
      ) : failed ? (
        <Txt color={colors.accent} weight="semibold">The document couldn’t be drawn on this device. Try Reload in the menu, then open it again.</Txt>
      ) : rendered ? (
        <View style={styles.paper}>
          <Image
            source={{ uri: rendered.previewUri }}
            style={{ width: '100%', aspectRatio: rendered.width / rendered.height }}
            resizeMode="contain"
            accessibilityLabel={`${doc.title} ${doc.meta[0]?.value ?? ''} for ${doc.partyName}`}
          />
        </View>
      ) : (
        <View style={[styles.paper, styles.loading]}><Txt color={colors.muted}>Preparing…</Txt></View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginLeft: -8 },
  warn: { backgroundColor: colors.warnBg, borderColor: colors.warnBg },
  inline: { alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  grow: { flexGrow: 1, flexBasis: 200 },
  paper: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.white },
  loading: { aspectRatio: 794 / 1123, alignItems: 'center', justifyContent: 'center' },
});
