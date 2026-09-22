import {
  addDays,
  format,
  isValid,
  nextDay,
  parse,
  startOfDay,
  type Day,
} from 'date-fns';
import {
  extractMentionedUserIds,
  mentionDisplayName,
  type MentionUser,
} from './mentions';

const WEEKDAY_MAP: Record<string, Day> = {
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

const DATE_TOKEN_RE = /(?:^|\s)\/([a-zA-Z0-9._-]+)/g;
/** `#1h`, `#15m`, `# 30min`, `#1.5hr` */
const TIME_TOKEN_RE =
  /(?:^|\s)#\s*(\d+(?:\.\d+)?)\s*(m|min|mins|minutes|h|hr|hrs|hour|hours)\b/gi;

export type QuickPriority = 'low' | 'medium' | 'high' | 'critical';

export const PRIORITY_CYCLE: QuickPriority[] = ['low', 'medium', 'high', 'critical'];

export const PRIORITY_SHORT: Record<QuickPriority, string> = {
  low: 'low',
  medium: 'med',
  high: 'high',
  critical: 'crit',
};

export function nextPriority(current: QuickPriority): QuickPriority {
  const idx = PRIORITY_CYCLE.indexOf(current);
  return PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
}

export function parseRelativeDateToken(token: string, now = new Date()): Date | null {
  const raw = token.trim().toLowerCase();
  if (!raw) return null;

  const today = startOfDay(now);

  if (raw === 'today' || raw === 'tod') return today;
  if (raw === 'tomorrow' || raw === 'tmr' || raw === 'tmrw') return addDays(today, 1);
  if (raw === 'yesterday') return addDays(today, -1);
  if (raw === 'nextweek' || raw === 'next-week') return addDays(today, 7);

  const weekday = WEEKDAY_MAP[raw];
  if (weekday !== undefined) {
    return nextDay(today, weekday);
  }

  for (const pattern of ['MMM-d', 'MMM-dd', 'MMM-d-yyyy', 'M-d', 'M-d-yyyy', 'yyyy-MM-dd']) {
    const parsed = parse(raw, pattern, now);
    if (isValid(parsed)) return startOfDay(parsed);
  }

  return null;
}

/** Parse `#1h` / `#15m` style duration into hours. */
export function parseTimeRequiredToken(value: string, unit: string): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const u = unit.toLowerCase();
  const hours = u.startsWith('h') ? amount : amount / 60;
  return Math.round(hours * 100) / 100;
}

export function formatQuickTimeLabel(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return mins <= 0 ? '0m' : `${mins}m`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded}h`;
}

/** Active `/…` query at the end of the input (for suggestions). */
export function getActiveDateQuery(text: string): string | null {
  const match = text.match(/(?:^|\s)\/([a-zA-Z0-9._-]*)$/);
  return match ? match[1] : null;
}

/** Active `#…` query at the end of the input (for suggestions). */
export function getActiveTimeQuery(text: string): string | null {
  const match = text.match(/(?:^|\s)#\s*([0-9]*\.?[0-9]*[a-zA-Z]*)$/);
  return match ? match[1] : null;
}

export const DATE_SUGGESTIONS = [
  { token: 'today', label: 'Today' },
  { token: 'tomorrow', label: 'Tomorrow' },
  { token: 'monday', label: 'Monday' },
  { token: 'tuesday', label: 'Tuesday' },
  { token: 'wednesday', label: 'Wednesday' },
  { token: 'thursday', label: 'Thursday' },
  { token: 'friday', label: 'Friday' },
  { token: 'saturday', label: 'Saturday' },
  { token: 'sunday', label: 'Sunday' },
  { token: 'nextweek', label: 'Next week' },
] as const;

export const TIME_SUGGESTIONS = [
  { token: '15m', label: '15 minutes' },
  { token: '30m', label: '30 minutes' },
  { token: '45m', label: '45 minutes' },
  { token: '1h', label: '1 hour' },
  { token: '1.5h', label: '1.5 hours' },
  { token: '2h', label: '2 hours' },
  { token: '3h', label: '3 hours' },
  { token: '4h', label: '4 hours' },
] as const;

export function matchDateSuggestions(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [...DATE_SUGGESTIONS];
  return DATE_SUGGESTIONS.filter(
    (s) => s.token.startsWith(q) || s.label.toLowerCase().startsWith(q),
  );
}

export function matchTimeSuggestions(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [...TIME_SUGGESTIONS];
  return TIME_SUGGESTIONS.filter(
    (s) => s.token.startsWith(q) || s.label.toLowerCase().includes(q),
  );
}

export interface ParsedQuickTask {
  title: string;
  assigneeIds: number[];
  assignees: MentionUser[];
  dueDate: Date | null;
  dueLabel: string | null;
  rawDateToken: string | null;
  estimatedHours: number | null;
  timeLabel: string | null;
}

export function parseQuickTask(text: string, users: MentionUser[], now = new Date()): ParsedQuickTask {
  const assigneeIds = extractMentionedUserIds(text, users);
  const assignees = users.filter((u) => assigneeIds.includes(u.id));

  let dueDate: Date | null = null;
  let dueLabel: string | null = null;
  let rawDateToken: string | null = null;
  let estimatedHours: number | null = null;
  let timeLabel: string | null = null;
  let cleaned = text;

  const dateMatches = [...text.matchAll(DATE_TOKEN_RE)];
  for (const match of dateMatches) {
    const token = match[1];
    const parsed = parseRelativeDateToken(token, now);
    if (!parsed) continue;
    dueDate = parsed;
    rawDateToken = token;
    dueLabel = format(parsed, 'EEE, MMM d');
    cleaned = cleaned.replace(match[0], match[0].startsWith(' ') ? ' ' : '');
  }

  const timeMatches = [...cleaned.matchAll(TIME_TOKEN_RE)];
  for (const match of timeMatches) {
    const hours = parseTimeRequiredToken(match[1], match[2]);
    if (hours == null) continue;
    estimatedHours = hours;
    timeLabel = formatQuickTimeLabel(hours);
    cleaned = cleaned.replace(match[0], match[0].startsWith(' ') ? ' ' : '');
  }

  for (const user of assignees) {
    const token = `@${mentionDisplayName(user)}`;
    cleaned = cleaned.split(token).join(' ');
  }

  const title = cleaned.replace(/\s+/g, ' ').trim();

  return {
    title,
    assigneeIds,
    assignees,
    dueDate,
    dueLabel,
    rawDateToken,
    estimatedHours,
    timeLabel,
  };
}

export function formatDueForApi(date: Date): string {
  return new Date(`${format(date, 'yyyy-MM-dd')}T12:00:00`).toISOString();
}
