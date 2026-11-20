/**
 * IST Date & Time utilities.
 * Astor uses Asia/Kolkata (IST = UTC + 5:30) as its standard timezone.
 */

export interface NowIST {
  iso: string;
  localDate: string; // 'YYYY-MM-DD'
  year: number;
  formatted: string; // e.g. 'Fri 20 Nov 2026, 20:30 IST'
  epochMs: number;
}

export function getNowIST(d: Date = new Date()): NowIST {
  const epochMs = d.getTime();
  const iso = d.toISOString();

  // YYYY-MM-DD in Asia/Kolkata
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

  // Year in Asia/Kolkata
  const yearStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
  }).format(d);
  const year = parseInt(yearStr, 10) || d.getFullYear();

  // Formatted date + time: e.g. "Fri 20 Nov 2026, 20:30 IST"
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

  const formatted = `${parts} IST`;

  return {
    iso,
    localDate,
    year,
    formatted,
    epochMs,
  };
}

/**
 * Formats a Date or timestamp into e.g. "Mon 3 Nov, 6:42 PM IST" or "Mon 3 Nov 2026, 6:42 PM IST"
 */
export function formatISTDateTime(input: Date | number | string, includeYear = true): string {
  const d = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  if (isNaN(d.getTime())) return String(input);

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  if (includeYear) {
    options.year = 'numeric';
  }

  const formatted = new Intl.DateTimeFormat('en-GB', options).format(d);
  // Clean comma e.g. "Mon, 3 Nov 2026, 6:42 pm" -> "Mon 3 Nov 2026, 6:42 PM IST"
  const clean = formatted
    .replace(/^([A-Za-z]+),/, '$1')
    .replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());

  return `${clean} IST`;
}

/**
 * Formats a YYYY-MM-DD or Date into e.g. "Mon 3 Nov 2026"
 */
export function formatISTDate(input: Date | number | string): string {
  let d: Date;
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    // Force mid-day in IST to avoid date shifts
    d = new Date(`${input}T12:00:00+05:30`);
  } else {
    d = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  }
  if (isNaN(d.getTime())) return String(input);

  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);

  return formatted.replace(/^([A-Za-z]+),/, '$1');
}

/**
 * Adds or subtracts days to a YYYY-MM-DD string in Asia/Kolkata.
 */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
