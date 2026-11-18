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

export function matchesSearch(product: Searchable, words: string[]): boolean {
  if (!words.length) return true;
  const text = `${product.name} ${product.description} ${product.variants.map((v) => v.name).join(' ')}`.toLowerCase();
  return words.every((w) => text.includes(w));
}
