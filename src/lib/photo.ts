import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const SIZE = 600;

/**
 * Lets the seller pick up to `limit` photos, crops each to a centred square and shrinks it to
 * 600 px. Returns JPEG data URLs (about 40–80 KB each); none if they cancelled.
 */
export async function pickSquarePhotos(limit: number): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1, allowsMultipleSelection: limit > 1, selectionLimit: limit, orderedSelection: true });
  // selectionLimit isn't applied on the web, so extra picks are dropped here.
  const assets = result.canceled ? [] : (result.assets ?? []).slice(0, limit);
  const photos: string[] = [];
  for (const asset of assets) {
    // One at a time, and decoded smaller first, so 12 MP camera photos don't exhaust memory.
    const loaded = await ImageManipulator.manipulate(asset.uri, { maxWidth: 1600, maxHeight: 1600 }).renderAsync();
    const { width, height } = loaded;
    const side = Math.min(width, height);
    const image = await ImageManipulator.manipulate(loaded)
      .crop({ originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side })
      .resize({ width: Math.min(SIZE, side), height: Math.min(SIZE, side) })
      .renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.72, base64: true });
    if (saved.base64) photos.push(`data:image/jpeg;base64,${saved.base64}`);
  }
  return photos;
}

/** A smaller copy of a saved square photo, as base64 JPEG (never upscaled). */
export async function shrinkPhoto(dataUrl: string, size: number): Promise<string | null> {
  const loaded = await ImageManipulator.manipulate(dataUrl).renderAsync();
  const side = Math.min(size, loaded.width);
  const image = await ImageManipulator.manipulate(loaded).resize({ width: side, height: side }).renderAsync();
  return (await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.72, base64: true })).base64 ?? null;
}
