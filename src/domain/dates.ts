// Calendar days as 'YYYY-MM-DD' keys in the device's local time (the shop is in one time zone).

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isDateKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKey(keyToDate(key)) === key;
}

export function addDays(key: string, days: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

export function addMonths(key: string, months: number): string {
  const d = keyToDate(key);
  return dateKey(new Date(d.getFullYear(), d.getMonth() + months, 1));
}

/** Monday of the week the day falls in. */
export function weekStart(key: string): string {
  const day = keyToDate(key).getDay(); // 0 = Sunday
  return addDays(key, -((day + 6) % 7));
}

export function monthStart(key: string): string {
  return key.slice(0, 8) + '01';
}

export function monthEnd(key: string): string {
  return addDays(addMonths(monthStart(key), 1), -1);
}

export function isoToDateKey(iso: string): string {
  return dateKey(new Date(iso));
}

const dayFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'short', day: 'numeric', month: 'short' });
const fullDayFmt = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' });

/** Sun 18 Oct */
export function formatDay(key: string): string {
  return dayFmt.format(keyToDate(key));
}

/** 18 Oct 2026 */
export function formatDate(key: string): string {
  return fullDayFmt.format(keyToDate(key));
}

/** 18 Oct 2026, 3:42 PM */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${fullDayFmt.format(d)}, ${timeFmt.format(d)}`;
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** October 2026 */
export function formatMonth(key: string): string {
  return monthFmt.format(keyToDate(key));
}
