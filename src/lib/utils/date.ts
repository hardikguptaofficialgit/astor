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
