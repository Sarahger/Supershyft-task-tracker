import { endOfDay, format, startOfDay } from 'date-fns';
import {
  matchMentionUsers,
  mentionDisplayName,
  type MentionUser,
} from './mentions';

/** Company working day for “rest of the day” math: 10:30 → 18:00 = 7.5h */
export const WORKDAY_START_MINUTES = 10 * 60 + 30;
export const WORKDAY_END_MINUTES = 18 * 60;
export const WORKDAY_HOURS =
  Math.round(((WORKDAY_END_MINUTES - WORKDAY_START_MINUTES) / 60) * 100) / 100;

const DURATION_UNIT = 'mins?|minutes?|m|hrs?|hours?|h';

/** "( 45 minutes )", "(1.5 hours)", "(30 minutes)" at end of line */
const TIME_PARENS_RE = new RegExp(
  `\\(\\s*(\\d+(?:\\.\\d+)?)\\s*(?:[-–—]\\s*(\\d+(?:\\.\\d+)?)\\s*)?(${DURATION_UNIT})\\s*\\)\\s*$`,
  'i',
);

/** "- 30 mins", "1 hr", "2hrs" at end of line */
const TIME_TAIL_RE = new RegExp(
  `\\s*[-–—:]?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:[-–—]\\s*(\\d+(?:\\.\\d+)?)\\s*)?(${DURATION_UNIT})\\s*$`,
  'i',
);

/** "rest of the day" / "rest of day" */
const REST_OF_DAY_RE = /\s*[-–—:(]?\s*rest\s+of\s+(?:the\s+)?day\s*\)?\s*$/i;

/**
 * Numbered / bulleted task lines:
 * 1.  1)  1]  1:  1 -  -  *  •
 */
const NUMBERED_LINE_RE =
  /^\s*(?:\d+[.)\]:]\s*|\d+\s*[-–—]\s+|[-*•]\s+)(.+)$/;

export interface ParsedDailyTaskItem {
  title: string;
  estimatedHours: number | null;
  timeLabel: string | null;
  isRestOfDay?: boolean;
  mentionedUserIds: number[];
  mentionedUsers: MentionUser[];
  rawLine: string;
}

export interface ParsedDailyTaskList {
  ownerName: string | null;
  owner: MentionUser | null;
  items: ParsedDailyTaskItem[];
  workdayHours: number;
}

function toHours(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return value;
  return value / 60;
}

function hoursFromMatch(lowStr: string, highStr: string | undefined, unit: string): number {
  const low = Number(lowStr);
  const high = highStr != null ? Number(highStr) : null;
  const hoursRaw = high != null ? (toHours(low, unit) + toHours(high, unit)) / 2 : toHours(low, unit);
  return Math.round(hoursRaw * 100) / 100;
}

export function parseTimeEstimate(text: string): {
  hours: number | null;
  label: string | null;
  titleWithoutTime: string;
  isRestOfDay: boolean;
} {
  const restMatch = text.match(REST_OF_DAY_RE);
  if (restMatch) {
    const titleWithoutTime = text.slice(0, restMatch.index).replace(/[\s\-–—:(]+$/, '').trim();
    return {
      hours: null,
      label: 'rest of the day',
      titleWithoutTime,
      isRestOfDay: true,
    };
  }

  // Prefer parenthesized durations so "(Questionnaire…)" without a time unit is left alone
  const parenMatch = text.match(TIME_PARENS_RE);
  if (parenMatch && parenMatch.index != null) {
    const hours = hoursFromMatch(parenMatch[1], parenMatch[2], parenMatch[3]);
    const label = parenMatch[0].replace(/^\s+|\s+$/g, '').replace(/^\(|\)$/g, '').trim();
    const titleWithoutTime = text.slice(0, parenMatch.index).replace(/[\s\-–—:]+$/, '').trim();
    return { hours, label, titleWithoutTime, isRestOfDay: false };
  }

  const tailMatch = text.match(TIME_TAIL_RE);
  if (tailMatch && tailMatch.index != null) {
    // Avoid treating a trailing number inside a non-time parenthesis as duration
    // e.g. leave "(page 2)" alone — unit must be present (already required by RE)
    const hours = hoursFromMatch(tailMatch[1], tailMatch[2], tailMatch[3]);
    const label = tailMatch[0].replace(/^[\s\-–—:]+/, '').trim();
    const titleWithoutTime = text.slice(0, tailMatch.index).replace(/[\s\-–—:]+$/, '').trim();
    return { hours, label, titleWithoutTime, isRestOfDay: false };
  }

  return { hours: null, label: null, titleWithoutTime: text.trim(), isRestOfDay: false };
}

/** Match known users mentioned in free text (no @ required). Longer names first. */
export function findMentionedUsersInText(
  text: string,
  users: MentionUser[],
  excludeIds: Set<number> = new Set(),
): MentionUser[] {
  const found: MentionUser[] = [];
  const lower = text.toLowerCase();

  const candidates = [...users]
    .filter((u) => !excludeIds.has(u.id))
    .sort((a, b) => mentionDisplayName(b).length - mentionDisplayName(a).length);

  const claimed = new Set<string>();

  for (const user of candidates) {
    const names = [
      mentionDisplayName(user),
      user.first_name,
      user.last_name,
    ].filter((n) => n && n.trim().length >= 3);

    for (const name of names) {
      const needle = name.toLowerCase();
      const re = new RegExp(`(?:^|[^a-z0-9_])${escapeRegExp(needle)}(?=$|[^a-z0-9_])`, 'i');
      if (!re.test(lower)) continue;
      if (claimed.has(needle)) continue;
      found.push(user);
      claimed.add(needle);
      claimed.add(user.first_name.toLowerCase());
      break;
    }
  }

  return found;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function looksLikeTaskLine(line: string): boolean {
  return (
    NUMBERED_LINE_RE.test(line)
    || TIME_PARENS_RE.test(line)
    || TIME_TAIL_RE.test(line)
    || REST_OF_DAY_RE.test(line)
  );
}

function resolveOwnerName(nameLine: string, users: MentionUser[]): MentionUser | null {
  // "Yukti", "Harsh:", "Sarah -"
  const trimmed = nameLine.trim().replace(/[:\-–—]+$/, '').trim();
  if (!trimmed || trimmed.length > 60) return null;
  if (looksLikeTaskLine(nameLine)) return null;

  const matches = matchMentionUsers(users, trimmed);
  const exact = matches.find(
    (u) =>
      mentionDisplayName(u).toLowerCase() === trimmed.toLowerCase()
      || u.first_name.toLowerCase() === trimmed.toLowerCase(),
  );
  return exact ?? (matches.length === 1 ? matches[0] : null);
}

/**
 * Allocate “rest of the day” = working day (10:30–18:00) minus sum of prior estimates.
 */
export function resolveRestOfDayHours(
  items: ParsedDailyTaskItem[],
  workdayHours: number = WORKDAY_HOURS,
): ParsedDailyTaskItem[] {
  let used = 0;
  return items.map((item) => {
    if (!item.isRestOfDay) {
      if (item.estimatedHours != null) used += item.estimatedHours;
      return item;
    }
    const remaining = Math.max(0, Math.round((workdayHours - used) * 100) / 100);
    used += remaining;
    return {
      ...item,
      estimatedHours: remaining,
      timeLabel: `rest of day → ${formatHoursLabel(remaining)}`,
    };
  });
}

/**
 * Parse a pasted daily plan in common team styles:
 *
 * Yukti
 * 1. Fix API error ( 45 minutes )
 * 2. Complete Lifestyle parameters (1.5 hours)
 *
 * Harsh
 * 1) Updating copy in all forms
 * 2) Developing further flutter pages
 */
export function parseDailyTaskList(text: string, users: MentionUser[]): ParsedDailyTaskList {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { ownerName: null, owner: null, items: [], workdayHours: WORKDAY_HOURS };
  }

  let ownerName: string | null = null;
  let owner: MentionUser | null = null;
  let startIdx = 0;

  const firstAsOwner = resolveOwnerName(lines[0], users);
  const firstIsTask = looksLikeTaskLine(lines[0]);
  if (firstAsOwner && !firstIsTask) {
    owner = firstAsOwner;
    ownerName = lines[0].trim().replace(/[:\-–—]+$/, '').trim();
    startIdx = 1;
  } else if (!firstIsTask && lines.length > 1 && NUMBERED_LINE_RE.test(lines[1])) {
    // Name line that didn't match a user — still treat as label
    ownerName = lines[0].trim().replace(/[:\-–—]+$/, '').trim();
    startIdx = 1;
  }

  const rawItems: ParsedDailyTaskItem[] = [];
  const ownerExclude = new Set(owner ? [owner.id] : []);

  for (let i = startIdx; i < lines.length; i++) {
    const rawLine = lines[i];
    const numbered = rawLine.match(NUMBERED_LINE_RE);
    const body = numbered ? numbered[1].trim() : rawLine;

    // Skip tiny leftover lines after tasks have started
    if (!numbered && rawItems.length > 0 && !looksLikeTaskLine(body) && body.length < 4) {
      continue;
    }
    // Skip another name header mid-list
    if (!numbered && rawItems.length === 0 && resolveOwnerName(body, users)) {
      continue;
    }

    const { hours, label, titleWithoutTime, isRestOfDay } = parseTimeEstimate(body);
    const title = titleWithoutTime || body;
    if (!title) continue;

    // Prefer numbered/bulleted lines. Allow unnumbered only when it's a single-item paste
    // or the line clearly has a time / rest-of-day marker.
    if (!numbered) {
      const multiItemPaste = lines.length - startIdx > 1;
      if (multiItemPaste && hours == null && !isRestOfDay) continue;
    }

    const mentioned = findMentionedUsersInText(title, users, ownerExclude);
    rawItems.push({
      title,
      estimatedHours: hours,
      timeLabel: label,
      isRestOfDay,
      mentionedUserIds: mentioned.map((u) => u.id),
      mentionedUsers: mentioned,
      rawLine,
    });
  }

  return {
    ownerName,
    owner,
    items: resolveRestOfDayHours(rawItems, WORKDAY_HOURS),
    workdayHours: WORKDAY_HOURS,
  };
}

/** Due date at end of the given calendar day (local), ISO for API. */
export function formatDueEodForApi(day: Date = new Date()): string {
  const eod = endOfDay(startOfDay(day));
  return new Date(`${format(eod, 'yyyy-MM-dd')}T23:59:00`).toISOString();
}

export function formatHoursLabel(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours}h`;
}
