import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const SIZE = 600;

/**
 * Lets the seller pick a photo, crops it to a centred square and shrinks it to 600 px.
 * Returns a JPEG data URL (about 40–80 KB), or null if they cancelled.
 * ponytail: photos live inside the product record (works offline, no storage bucket);
 * move them to Supabase Storage if the 500 MB free database ever gets close to full.
 */
export async function pickSquarePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;

  // Decode big camera photos at a smaller size first, so a 12 MP image doesn't exhaust memory.
  const loaded = await ImageManipulator.manipulate(asset.uri, { maxWidth: 1600, maxHeight: 1600 }).renderAsync();
  const { width, height } = loaded;
  const side = Math.min(width, height);
  const image = await ImageManipulator.manipulate(loaded)
    .crop({ originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side })
    .resize({ width: Math.min(SIZE, side), height: Math.min(SIZE, side) })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.72, base64: true });
  return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null;
}
