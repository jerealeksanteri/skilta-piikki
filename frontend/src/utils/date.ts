/** Date formatting in Finnish style, shared by every page. */

const LOCALE = 'fi-FI';

type DateInput = string | Date;

function toDate(value: DateInput): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** 9.11.2026 klo 14.05 */
export function formatDateTime(value: DateInput): string {
  return toDate(value).toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 9.11. klo 14.05 */
export function formatShortDateTime(value: DateInput): string {
  return toDate(value).toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 9. marrask. 2026 */
export function formatDate(value: DateInput): string {
  return toDate(value).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** 9. marrask. klo 14.05 */
export function formatDayTime(value: DateInput): string {
  return toDate(value).toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** The local-time value a datetime-local input expects, e.g. 2026-11-09T14:05. */
export function toInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a datetime-local input value as local time; null when empty or invalid. */
export function fromInputValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
