// Sample products for trying the app on one device (from the approved mock).
// Offered only when sync is off, so test data never lands in the real shop.
import type { Product } from '@/domain/types';

import { adjustStock, newId, save, setCurrentEvent } from './store';
import { syncEnabled } from './sync';

export function sampleDataAllowed(): boolean {
  return !syncEnabled;
}

export function loadSampleData() {
  const cats = ['Pouches', 'Hairclips', 'Bags', 'Accessories'].map((name) => ({ id: newId(), name }));
  save('categories', ...cats);
  const cat = (name: string) => cats.find((c) => c.name === name)!.id;

  const items: [string, number, string[], [string, number][]][] = [
    ['Daisy claw clip', 120, ['Hairclips'], [['Yellow', 6], ['White', 4], ['Pink', 0]]],
    ['Pearl hair pin set', 150, ['Hairclips'], [['', 10]]],
    ['Quilted coin pouch', 180, ['Pouches', 'Accessories'], [['Beige', 5], ['Sage', 3], ['Black', 2]]],
    ['Canvas zipper pouch', 220, ['Pouches'], [['', 8]]],
    ['Crochet shoulder bag', 650, ['Bags'], [['Cream', 2], ['Brown', 1]]],
    ['Mini tote bag', 380, ['Bags'], [['', 0]]],
    ['Beaded phone strap', 160, ['Accessories'], [['Pastel', 7], ['Mono', 4]]],
    ['Charm keychain', 90, ['Accessories'], [['', 15]]],
  ];
  for (const [name, pesos, categories, colours] of items) {
    const product: Omit<Product, 'updatedAt'> = {
      id: newId(),
      name,
      description: '',
      price: pesos * 100,
      categoryIds: categories.map(cat),
      photo: null,
      variants: colours.map(([colour]) => ({ id: newId(), name: colour, photo: null })),
    };
    save('products', product);
    product.variants.forEach((v, i) => adjustStock(product.id, v.id, colours[i][1]));
  }

  const event = { id: newId(), name: 'Weekend Craft Fair', startDate: null, endDate: null };
  save('events', event);
  setCurrentEvent(event.id);
}
