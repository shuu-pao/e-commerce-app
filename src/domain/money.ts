import type { Cents } from './types.ts';

const whole = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });
const withCents = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₱1,234 for whole pesos, ₱1,234.50 otherwise. */
export function formatPeso(cents: Cents): string {
  const sign = cents < 0 ? '−' : '';
  const abs = Math.abs(cents);
  const text = abs % 100 === 0 ? whole.format(abs / 100) : withCents.format(abs / 100);
  return `${sign}₱${text}`;
}

/** Reads what someone typed ("120", "1,250.5", "₱99") as centavos; null when it isn't a valid amount. */
export function parsePeso(input: string): Cents | null {
  const text = input.replace(/[₱,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

/** Centavos as an editable string: 12000 → "120", 12050 → "120.50". */
export function centsToInput(cents: Cents): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
