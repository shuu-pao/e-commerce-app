import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * A number that changes each time the screen comes into view. Drawer screens stay
 * mounted, so forms keyed by this start fresh on every visit instead of showing old input.
 */
export function useFocusKey(): number {
  const [key, setKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setKey((k) => k + 1);
    }, []),
  );
  return key;
}
