import { format, parseISO } from 'date-fns';
import {
  WORKDAY_HOURS,
  formatHoursLabel,
  parseTimeEstimate,
} from './dailyTaskListParse';

const NUMBERED_LINE_RE =
  /^\s*(?:\d+[.)\]:]\s*|\d+\s*[-–—]\s+|[-*•]\s+)(.+)$/;

const DURATION_RE =
  /\s*[-–—:(]?\s*\(?\s*(\d+(?:\.\d+)?)\s*(days?|d|hrs?|hours?|h|mins?|minutes?|m)\s*\)?\s*$/i;
const REMAINING_RE =
  /\s*[-–—:(]?\s*(?:remaining\s+available\s+time|rest\s+of\s+(?:the\s+)?(?:day|week)|remaining\s+time)\s*\)?\s*$/i;
const DUE_TAIL_RE =
  /\s*(?:due|by|deadline)?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s*$/i;

export interface ParsedWeeklyPlanItem {
  title: string;
  estimatedHours: number | null;
  timeLabel: string | null;
  dueDate: string | null;
  isRemainingTime: boolean;
  rawLine: string;
  missingDueDate: boolean;
  missingEffort: boolean;
}

export interface ParsedWeeklyPlan {
  items: ParsedWeeklyPlanItem[];
  workdayHours: number;
}

function parseDueToken(token: string): string | null {
  const iso = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = token.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (!slash) return null;
  const day = Number(slash[1]);
  const month = Number(slash[2]);
  let year = slash[3] ? Number(slash[3]) : new Date().getFullYear();
  if (year < 100) year += 2000;
  if (month > 12 && day <= 12) {
    return format(new Date(year, day - 1, month), 'yyyy-MM-dd');
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return format(new Date(year, month - 1, day), 'yyyy-MM-dd');
}

function stripDue(text: string): { title: string; dueDate: string | null } {
  const match = text.match(DUE_TAIL_RE);
  if (!match || match.index == null) return { title: text.trim(), dueDate: null };
  const dueDate = parseDueToken(match[1]);
  const title = text.slice(0, match.index).replace(/[\s\-–—:(]+$/, '').trim();
  return { title, dueDate };
}

function parseWeeklyEstimate(text: string): {
  hours: number | null;
  label: string | null;
  title: string;
  isRemainingTime: boolean;
} {
  const remaining = text.match(REMAINING_RE);
  if (remaining && remaining.index != null) {
    return {
      hours: null,
      label: 'remaining time',
      title: text.slice(0, remaining.index).replace(/[\s\-–—:(]+$/, '').trim(),
      isRemainingTime: true,
    };
  }
  const duration = text.match(DURATION_RE);
  if (duration && duration.index != null) {
    const count = Number(duration[1]);
    const unit = duration[2].toLowerCase();
    const hours = unit.startsWith('d')
      ? Math.round(count * WORKDAY_HOURS * 100) / 100
      : unit.startsWith('h')
        ? count
        : Math.round((count / 60) * 100) / 100;
    const label = unit.startsWith('d')
      ? `${count} day${count === 1 ? '' : 's'}`
      : unit.startsWith('h')
        ? `${count}h`
        : `${count}m`;
    return {
      hours,
      label,
      title: text.slice(0, duration.index).replace(/[\s\-–—:(]+$/, '').trim(),
      isRemainingTime: false,
    };
  }
  const parsed = parseTimeEstimate(text);
  return {
    hours: parsed.hours,
    label: parsed.label,
    title: parsed.titleWithoutTime,
    isRemainingTime: Boolean(parsed.isRestOfDay),
  };
}

export function parseWeeklyPlanList(text: string): ParsedWeeklyPlan {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rawItems: ParsedWeeklyPlanItem[] = [];
  for (const rawLine of lines) {
    const numbered = rawLine.match(NUMBERED_LINE_RE);
    const body = numbered ? numbered[1].trim() : rawLine;
    if (!numbered && rawItems.length > 0 && body.length < 4) continue;

    const dueParsed = stripDue(body);
    const estimate = parseWeeklyEstimate(dueParsed.title || body);
    const title = estimate.title || dueParsed.title || body;
    if (!title) continue;
    if (!numbered && lines.length > 1 && estimate.hours == null && !estimate.isRemainingTime && !dueParsed.dueDate) {
      continue;
    }

    rawItems.push({
      title,
      estimatedHours: estimate.hours,
      timeLabel: estimate.label,
      dueDate: dueParsed.dueDate,
      isRemainingTime: estimate.isRemainingTime,
      rawLine,
      missingDueDate: !dueParsed.dueDate,
      missingEffort: estimate.hours == null && !estimate.isRemainingTime,
    });
  }

  let used = 0;
  const items = rawItems.map((item) => {
    if (!item.isRemainingTime) {
      if (item.estimatedHours != null) used += item.estimatedHours;
      return item;
    }
    const remaining = Math.max(0, Math.round((WORKDAY_HOURS - used) * 100) / 100);
    used += remaining;
    return {
      ...item,
      estimatedHours: remaining || null,
      timeLabel: remaining ? `remaining → ${formatHoursLabel(remaining)}` : 'remaining time',
      missingEffort: remaining <= 0,
    };
  });

  return { items, workdayHours: WORKDAY_HOURS };
}

export interface ParsedWeeklyDoneItem {
  title: string;
  description: string;
  rawLine: string;
}

export function parseWeeklyDoneList(text: string): ParsedWeeklyDoneItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const items: ParsedWeeklyDoneItem[] = [];
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const numbered = trimmed.match(NUMBERED_LINE_RE);
    if (numbered) {
      items.push({ title: numbered[1].trim(), description: '', rawLine: trimmed });
      continue;
    }
    if (items.length && /^[-*•]/.test(trimmed)) {
      const extra = trimmed.replace(/^[-*•]\s*/, '').trim();
      const last = items[items.length - 1];
      last.description = last.description ? `${last.description}\n${extra}` : extra;
      last.title = last.description ? `${last.title}` : last.title;
      continue;
    }
    if (items.length && !/^\d+[.)]/.test(trimmed) && trimmed.length > 3) {
      const last = items[items.length - 1];
      last.description = last.description ? `${last.description}\n${trimmed}` : trimmed;
      continue;
    }
    if (trimmed.length > 2) {
      items.push({ title: trimmed, description: '', rawLine: trimmed });
    }
  }
  return items.filter((item) => item.title);
}

export function formatDueNoonForApi(day: string | Date): string {
  const value = typeof day === 'string' ? (day.includes('T') ? parseISO(day) : new Date(`${day}T12:00:00`)) : day;
  const ymd = format(value, 'yyyy-MM-dd');
  return new Date(`${ymd}T12:00:00`).toISOString();
}

export function mondayOf(day: Date = new Date()): Date {
  const copy = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const weekday = copy.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  copy.setDate(copy.getDate() + offset);
  return copy;
}

export function toDateInput(value?: string | null): string {
  if (!value) return '';
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return format(parseISO(value), 'yyyy-MM-dd');
  } catch {
    return value.slice(0, 10);
  }
}

export { formatHoursLabel, WORKDAY_HOURS };
