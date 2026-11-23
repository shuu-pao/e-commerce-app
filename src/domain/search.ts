// Product search, the same on Sell, Products and the public catalog: every word typed must appear
// in the product's name, description or one of its colours, in any order, ignoring case.

interface Searchable {
  name: string;
  description: string;
  variants: { name: string }[];
}

/** The words of a search box; none means "show everything". */
export function searchWords(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * All orders' search box, "Order number or buyer" (design review 11): a number finds that order
 * ("6", "0006" and "#0006" all find #0006); words must all be in the buyer's name.
 */
export function matchesOrder(order: { number: number; buyer: { name: string } | null }, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#/, '');
  if (!q) return true;
  if (/^\d+$/.test(q)) return order.number === Number(q);
  const name = (order.buyer?.name ?? '').toLowerCase();
  return searchWords(q).every((w) => name.includes(w));
}

export function matchesSearch(product: Searchable, words: string[]): boolean {
  if (!words.length) return true;
  const text = `${product.name} ${product.description} ${product.variants.map((v) => v.name).join(' ')}`.toLowerCase();
  return words.every((w) => text.includes(w));
}
