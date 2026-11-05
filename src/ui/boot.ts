import { Platform } from 'react-native';

/**
 * Fades out the loading screen public/index.html paints before the app's code arrives.
 * The catalog calls it once its own grid is ready, so visitors never see a blank step between the two.
 */
export function hideBoot(): void {
  const boot = Platform.OS === 'web' ? document.getElementById('boot') : null;
  if (!boot || boot.classList.contains('done')) return;
  boot.classList.add('done');
  setTimeout(() => boot.remove(), 250);
}

/** A product a visitor tapped on that loading screen, before the app was ready (once). */
export function takeEarlyTap(): string | null {
  if (Platform.OS !== 'web') return null;
  const page = window as { __catalogTap?: string };
  const id = page.__catalogTap ?? null;
  page.__catalogTap = undefined;
  return id;
}
