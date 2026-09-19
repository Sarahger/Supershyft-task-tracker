import { endOfDay, format, startOfDay } from 'date-fns';
import {
  matchMentionUsers,
  mentionDisplayName,
  type MentionUser,
} from './mentions';

/** Duration fragments like "15-20 mins", "1 hr", "2hrs", "30m" */
const TIME_TAIL_RE =
  /\s*[-–—]?\s*(\d+(?:\.\d+)?)\s*(?:[-–—]\s*(\d+(?:\.\d+)?)\s*)?(mins?|minutes?|m|hrs?|hours?|h)\s*$/i;

const NUMBERED_LINE_RE = /^\s*(?:\d+[.)]\s+|[-*•]\s+)(.+)$/;

export interface ParsedDailyTaskItem {
  title: string;
  estimatedHours: number | null;
  timeLabel: string | null;
  mentionedUserIds: number[];
  mentionedUsers: MentionUser[];
  rawLine: string;
}

export interface ParsedDailyTaskList {
  ownerName: string | null;
  owner: MentionUser | null;
  items: ParsedDailyTaskItem[];
}

function toHours(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return value;
  return value / 60;
}

export function parseTimeEstimate(text: string): {
  hours: number | null;
  label: string | null;
  titleWithoutTime: string;
} {
  const match = text.match(TIME_TAIL_RE);
  if (!match) {
    return { hours: null, label: null, titleWithoutTime: text.trim() };
  }

  const low = Number(match[1]);
  const high = match[2] != null ? Number(match[2]) : null;
  const unit = match[3];
  const hoursRaw = high != null ? (toHours(low, unit) + toHours(high, unit)) / 2 : toHours(low, unit);
  const hours = Math.round(hoursRaw * 100) / 100;
  const label = match[0].replace(/^[\s\-–—]+/, '').trim();
  const titleWithoutTime = text.slice(0, match.index).replace(/[\s\-–—]+$/, '').trim();

  return { hours, label, titleWithoutTime };
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

  const claimed = new Set<string>(); // avoid overlapping matches on same span roughly

  for (const user of candidates) {
    const names = [
      mentionDisplayName(user),
      user.first_name,
      user.last_name,
    ].filter((n) => n && n.trim().length >= 3);

    for (const name of names) {
      const needle = name.toLowerCase();
      // whole-word-ish match
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

function resolveOwnerName(nameLine: string, users: MentionUser[]): MentionUser | null {
  const trimmed = nameLine.trim();
  if (!trimmed || trimmed.length > 60) return null;
  // Single-token or "First Last" without digits / numbering
  if (/^\d+[.)]/.test(trimmed) || /^[-*•]/.test(trimmed)) return null;
  if (TIME_TAIL_RE.test(trimmed)) return null;

  const matches = matchMentionUsers(users, trimmed);
  const exact = matches.find(
    (u) =>
      mentionDisplayName(u).toLowerCase() === trimmed.toLowerCase()
      || u.first_name.toLowerCase() === trimmed.toLowerCase(),
  );
  return exact ?? (matches.length === 1 ? matches[0] : null);
}

/**
 * Parse a pasted daily plan like:
 *
 * Sarah
 * 1. Meet with harshili … - 15-20 mins
 * 2. Blood collection … - 15m
 */
export function parseDailyTaskList(text: string, users: MentionUser[]): ParsedDailyTaskList {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { ownerName: null, owner: null, items: [] };
  }

  let ownerName: string | null = null;
  let owner: MentionUser | null = null;
  let startIdx = 0;

  const firstAsOwner = resolveOwnerName(lines[0], users);
  const firstIsTask = NUMBERED_LINE_RE.test(lines[0]) || TIME_TAIL_RE.test(lines[0]);
  if (firstAsOwner && !firstIsTask) {
    owner = firstAsOwner;
    ownerName = lines[0].trim();
    startIdx = 1;
  } else if (!firstIsTask && lines.length > 1 && NUMBERED_LINE_RE.test(lines[1])) {
    // Name line that didn't match a user — still treat as label
    ownerName = lines[0].trim();
    startIdx = 1;
  }

  const items: ParsedDailyTaskItem[] = [];
  const ownerExclude = new Set(owner ? [owner.id] : []);

  for (let i = startIdx; i < lines.length; i++) {
    const rawLine = lines[i];
    const numbered = rawLine.match(NUMBERED_LINE_RE);
    const body = numbered ? numbered[1].trim() : rawLine;

    // Skip stray non-task lines after tasks started
    if (!numbered && items.length > 0 && !TIME_TAIL_RE.test(body) && body.length < 4) {
      continue;
    }
    // If not numbered and looks like a header mid-list, skip
    if (!numbered && items.length === 0 && resolveOwnerName(body, users)) {
      continue;
    }

    const { hours, label, titleWithoutTime } = parseTimeEstimate(body);
    const title = titleWithoutTime || body;
    if (!title) continue;

    // Only accept numbered/bullet lines, or lines that clearly have a time estimate
    if (!numbered && hours == null && items.length === 0 && i === startIdx && lines.length > 1) {
      // ambiguous first body line without number — still allow if only content
    }
    if (!numbered && hours == null) {
      // Allow plain lines as tasks when they are the only content style
      if (lines.length - startIdx > 1) continue;
    }

    const mentioned = findMentionedUsersInText(title, users, ownerExclude);
    items.push({
      title,
      estimatedHours: hours,
      timeLabel: label,
      mentionedUserIds: mentioned.map((u) => u.id),
      mentionedUsers: mentioned,
      rawLine,
    });
  }

  return { ownerName, owner, items };
}

/** Due date at end of the given calendar day (local), ISO for API. */
export function formatDueEodForApi(day: Date = new Date()): string {
  const eod = endOfDay(startOfDay(day));
  // Keep calendar day stable across TZ by using local Y-M-D + 23:59
  return new Date(`${format(eod, 'yyyy-MM-dd')}T23:59:00`).toISOString();
}

export function formatHoursLabel(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours}h`;
}
