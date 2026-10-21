import { Platform } from 'react-native';

/** Saves text as a file in the browser. Returns false where that isn't possible (the native apps). */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
