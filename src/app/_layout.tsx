import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { useFonts } from 'expo-font';
import { Drawer } from 'expo-router/drawer';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAppState } from '@/data/hooks';
import { loadFromDevice } from '@/data/store';
import { authLinkAtStart, forgetAuthLink } from '@/data/supabase';
import { startSync, syncEnabled } from '@/data/sync';
import { SetPassword } from '@/ui/SetPassword';
import { Sidebar } from '@/ui/Sidebar';
import { SignIn } from '@/ui/SignIn';
import { colors, fonts, WIDE } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold });
  const ready = useAppState((s) => s.ready);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadFromDevice().catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  const show = (fontsLoaded || !!fontError) && (ready || !!loadError);
  useEffect(() => {
    if (!show) return;
    void SplashScreen.hideAsync();
    // The web page paints a skeleton before JavaScript loads (public/index.html); fade it out now.
    const boot = Platform.OS === 'web' ? document.getElementById('boot') : null;
    if (boot) {
      boot.classList.add('done');
      setTimeout(() => boot.remove(), 250);
    }
  }, [show]);

  if (!show) return null;
  if (loadError) {
    return (
      <View style={styles.center}>
        <Txt variant="heading">The app couldn’t open its data</Txt>
        <Txt color={colors.body}>{loadError}</Txt>
        <Txt color={colors.body}>Close the app and open it again. If it keeps happening, check that this device has free storage.</Txt>
      </View>
    );
  }
  return (
    <>
      <StatusBar style="dark" />
      <Gate />
    </>
  );
}

function Gate() {
  const email = useAppState((s) => s.settings.signedInEmail);
  // Opened from an invitation or password-reset email: choose a password first.
  const [link, setLink] = useState(authLinkAtStart);
  useEffect(() => (email ? startSync() : undefined), [email]);
  if (syncEnabled && link) {
    const done = () => {
      forgetAuthLink();
      setLink(null);
    };
    return <SetPassword link={link} onDone={done} />;
  }
  if (syncEnabled && !email) return <SignIn />;
  return <AppDrawer />;
}

function AppDrawer() {
  const { width } = useWindowDimensions();
  const permanent = width >= WIDE;
  return (
    <Drawer
      drawerContent={(props) => <Sidebar {...props} permanent={permanent} />}
      backBehavior="history"
      screenOptions={{
        drawerType: permanent ? 'permanent' : 'front',
        headerLeft: permanent ? () => null : undefined, // no menu button while the sidebar is always open
        drawerStyle: { width: 260, backgroundColor: colors.surface, borderRightWidth: 0 },
        overlayColor: colors.scrim,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
        headerTintColor: colors.ink,
        sceneStyle: { backgroundColor: colors.white },
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'caracebu' }} />
      <Drawer.Screen name="sell" options={{ title: 'Sell' }} />
      <Drawer.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Drawer.Screen name="home" options={{ title: 'Home' }} />
      <Drawer.Screen name="orders/index" options={{ title: 'All orders' }} />
      <Drawer.Screen name="orders/[id]" options={{ title: 'Order' }} />
      <Drawer.Screen name="reports" options={{ title: 'Reports' }} />
      <Drawer.Screen name="products/index" options={{ title: 'Products' }} />
      <Drawer.Screen name="products/[id]" options={{ title: 'Product' }} />
      <Drawer.Screen name="categories" options={{ title: 'Categories' }} />
      <Drawer.Screen name="events" options={{ title: 'Events' }} />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32, backgroundColor: colors.white },
});
