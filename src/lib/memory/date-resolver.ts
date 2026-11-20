import * as chrono from 'chrono-node';
import { getNowIST, formatISTDate, shiftDate } from '../utils/date';

export interface ResolvedDateRange {
  from: string; // 'YYYY-MM-DD'
  to: string;   // 'YYYY-MM-DD'
  label: string; // e.g. "Mon 3 Nov 2026"
  confidence: number;
  matchedText: string;
  remainingText: string;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 4,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Gets day of week (0=Sun, 1=Mon, ..., 6=Sat) for a YYYY-MM-DD in Asia/Kolkata
 */
function getDayOfWeekIST(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00+05:30`);
  return d.getDay();
}

/**
 * Turns phrases into IST date ranges relative to reference date (defaults to now IST).
 * Always Asia/Kolkata timezone.
 */
export function resolveDateRange(
  input: string,
  referenceDate?: Date | number | string
): ResolvedDateRange | null {
  if (!input || typeof input !== 'string') return null;

  const ref = referenceDate ? (typeof referenceDate === 'object' ? referenceDate : new Date(referenceDate)) : new Date();
  const now = getNowIST(ref);
  const today = now.localDate; // 'YYYY-MM-DD'
  const currentYear = now.year;
  const currentDow = getDayOfWeekIST(today);

  function makeResult(from: string, to: string, matchedText: string, confidence = 1.0): ResolvedDateRange {
    let label = '';
    if (from === to) {
      label = formatISTDate(from);
    } else {
      label = `${formatISTDate(from)} – ${formatISTDate(to)}`;
    }

    // Strip matched text from remaining text
    const re = new RegExp(matchedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    let remaining = input.replace(re, ' ');
    // Clean up prepositions like "on", "from", "at" if left dangling
    remaining = remaining.replace(/\b(on|about|from|for|in|during)\b/gi, ' ');
    remaining = remaining.replace(/\s+/g, ' ').trim();

    return {
      from,
      to,
      label,
      confidence,
      matchedText,
      remainingText: remaining,
    };
  }

  // 1. "earlier this week"
  const earlierThisWeekMatch = input.match(/\b(?:earlier\s+this\s+week)\b/i);
  if (earlierThisWeekMatch) {
    // Monday of this week
    const daysSinceMonday = currentDow === 0 ? 6 : currentDow - 1;
    const monday = shiftDate(today, -daysSinceMonday);
    // Up to yesterday (or today if Monday)
    const toDate = daysSinceMonday > 0 ? shiftDate(today, -1) : today;
    return makeResult(monday, toDate, earlierThisWeekMatch[0], 0.95);
  }

  // 2. "this week"
  const thisWeekMatch = input.match(/\b(?:this\s+week)\b/i);
  if (thisWeekMatch) {
    const daysSinceMonday = currentDow === 0 ? 6 : currentDow - 1;
    const monday = shiftDate(today, -daysSinceMonday);
    return makeResult(monday, today, thisWeekMatch[0], 0.9);
  }

  // 3. "last week"
  const lastWeekMatch = input.match(/\b(?:last\s+week)\b/i);
  if (lastWeekMatch) {
    // Monday of this week minus 7 days -> Monday of last week
    const daysSinceMonday = currentDow === 0 ? 6 : currentDow - 1;
    const thisMonday = shiftDate(today, -daysSinceMonday);
    const lastMonday = shiftDate(thisMonday, -7);
    const lastSunday = shiftDate(lastMonday, 6);
    return makeResult(lastMonday, lastSunday, lastWeekMatch[0], 0.95);
  }

  // 4. "yesterday"
  const yesterdayMatch = input.match(/\byesterday\b/i);
  if (yesterdayMatch) {
    const yDay = shiftDate(today, -1);
    return makeResult(yDay, yDay, yesterdayMatch[0], 1.0);
  }

  // 5. "today"
  const todayMatch = input.match(/\btoday\b/i);
  if (todayMatch) {
    return makeResult(today, today, todayMatch[0], 1.0);
  }

  // 6. "(\d+)\s+days?\s+ago"
  const daysAgoMatch = input.match(/\b(\d+)\s+days?\s+ago\b/i);
  if (daysAgoMatch) {
    const count = parseInt(daysAgoMatch[1], 10);
    const target = shiftDate(today, -count);
    return makeResult(target, target, daysAgoMatch[0], 1.0);
  }

  // 7. "last (Monday|Tuesday|...)"
  const lastWeekdayMatch = input.match(/\blast\s+(monday|tuesday|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/i);
  if (lastWeekdayMatch) {
    const dayName = lastWeekdayMatch[1].toLowerCase();
    const targetDow = WEEKDAYS[dayName];
    if (targetDow !== undefined) {
      let daysAgo = (currentDow - targetDow + 7) % 7;
      if (daysAgo === 0) daysAgo = 7;
      const targetDate = shiftDate(today, -daysAgo);
      return makeResult(targetDate, targetDate, lastWeekdayMatch[0], 0.95);
    }
  }

  // 8. "on (Monday|Tuesday|...)" or "(Monday|Tuesday|...)" alone referring to most recent past Monday
  const onWeekdayMatch = input.match(/\b(?:on\s+)?(monday|tuesday|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/i);
  if (onWeekdayMatch) {
    const dayName = onWeekdayMatch[1].toLowerCase();
    const targetDow = WEEKDAYS[dayName];
    if (targetDow !== undefined) {
      let daysAgo = (currentDow - targetDow + 7) % 7;
      if (daysAgo === 0) daysAgo = 7;
      const targetDate = shiftDate(today, -daysAgo);
      return makeResult(targetDate, targetDate, onWeekdayMatch[0], 0.9);
    }
  }

  // 9. Numeric DD/MM format (e.g. "3/11", "03/11", "3-11", "03/11/2026")
  const ddMmMatch = input.match(/\b0?([1-9]|[12]\d|3[01])[\/\-\.](0?[1-9]|1[0-2])(?:\/(\d{4}))?\b/);
  if (ddMmMatch) {
    const day = parseInt(ddMmMatch[1], 10);
    const month = parseInt(ddMmMatch[2], 10);
    let year = ddMmMatch[3] ? parseInt(ddMmMatch[3], 10) : currentYear;

    let targetDate = `${year}-${pad2(month)}-${pad2(day)}`;
    // If no year specified and date is in the future, backdate by 1 year
    if (!ddMmMatch[3] && targetDate > today) {
      year -= 1;
      targetDate = `${year}-${pad2(month)}-${pad2(day)}`;
    }
    return makeResult(targetDate, targetDate, ddMmMatch[0], 0.95);
  }

  // 10. Named month patterns:
  // e.g. "on 3 Nov", "3 November", "Nov 3rd", "3rd Nov", "November 3", "3rd of November"
  const namedMonthRegex = /\b(?:on\s+)?(?:(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)|(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?)(?:\s+(\d{4}))?\b/i;
  const namedMatch = input.match(namedMonthRegex);
  if (namedMatch) {
    let day = 1;
    let monthName = '';
    if (namedMatch[1]) {
      day = parseInt(namedMatch[1], 10);
      monthName = namedMatch[2].toLowerCase();
    } else {
      monthName = namedMatch[3].toLowerCase();
      day = parseInt(namedMatch[4], 10);
    }

    const month = MONTHS[monthName];
    let year = namedMatch[5] ? parseInt(namedMatch[5], 10) : currentYear;
    let targetDate = `${year}-${pad2(month)}-${pad2(day)}`;

    if (!namedMatch[5] && targetDate > today) {
      year -= 1;
      targetDate = `${year}-${pad2(month)}-${pad2(day)}`;
    }
    return makeResult(targetDate, targetDate, namedMatch[0], 0.95);
  }

  // 11. Chrono fallback (en.GB convention: day-first)
  try {
    const parsed = chrono.en.GB.parse(input, {
      instant: ref,
      timezone: 'Asia/Kolkata',
    });

    if (parsed.length > 0) {
      const match = parsed[0];
      const startDate = match.start.date();
      const from = getNowIST(startDate).localDate;
      const to = match.end ? getNowIST(match.end.date()).localDate : from;

      return makeResult(from, to, match.text, 0.85);
    }
  } catch {}

  return null;
}
