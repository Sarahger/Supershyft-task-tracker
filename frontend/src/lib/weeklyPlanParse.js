import { addDays, format, parseISO, startOfDay } from "date-fns";
import {
  WORKDAY_HOURS,
  formatHoursLabel,
  parseTimeEstimate
} from "./dailyTaskListParse";
import { parseRelativeDateToken, WEEKDAY_MAP } from "./quickTaskParse";
const NUMBERED_LINE_RE = /^\s*(?:\d+[.)\]:]\s*|\d+\s*[-–—]\s+|[-*•]\s+)(.+)$/;
const LIST_MARKER_ONLY_RE = /^\s*(?:\d+[.)\]:]\s*|\d+\s*[-–—]\s+|[-*•]\s+)?$/;
const DURATION_RE = /\s*[-–—:(]?\s*\(?\s*(\d+(?:\.\d+)?)\s*(days?|d|hrs?|hours?|h|mins?|minutes?|m)\s*\)?\s*$/i;
const REMAINING_RE = /\s*[-–—:(]?\s*(?:remaining\s+available\s+time|rest\s+of\s+(?:the\s+)?(?:day|week)|remaining\s+time)\s*\)?\s*$/i;
const DUE_TAIL_RE = /\s*(?:due|by|deadline)?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s*$/i;
const SLASH_DUE_RE = /(?:^|[\s\-–—:(])\/([a-zA-Z0-9._-]+)/gi;
const HASH_TIME_RE = /#\s*(\d+(?:\.\d+)?)\s*(days?|d|hrs?|hours?|h|mins?|minutes?|m)\b/gi;
const COMPLETED_MARK_RE = /\*\s*completed\b/gi;
function parseDueToken(token) {
  const iso = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = token.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (!slash) return null;
  const day = Number(slash[1]);
  const month = Number(slash[2]);
  let year = slash[3] ? Number(slash[3]) : (/* @__PURE__ */ new Date()).getFullYear();
  if (year < 100) year += 2e3;
  if (month > 12 && day <= 12) {
    return format(new Date(year, day - 1, month), "yyyy-MM-dd");
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return format(new Date(year, month - 1, day), "yyyy-MM-dd");
}
function stripDue(text) {
  const match = text.match(DUE_TAIL_RE);
  if (!match || match.index == null) return { title: text.trim(), dueDate: null };
  const dueDate = parseDueToken(match[1]);
  const title = text.slice(0, match.index).replace(/[\s\-–—:(]+$/, "").trim();
  return { title, dueDate };
}
function parseWeeklyEstimate(text) {
  const remaining = text.match(REMAINING_RE);
  if (remaining && remaining.index != null) {
    return {
      hours: null,
      label: "remaining time",
      title: text.slice(0, remaining.index).replace(/[\s\-–—:(]+$/, "").trim(),
      isRemainingTime: true
    };
  }
  const duration = text.match(DURATION_RE);
  if (duration && duration.index != null) {
    const count = Number(duration[1]);
    const unit = duration[2].toLowerCase();
    const hours = unit.startsWith("d") ? Math.round(count * WORKDAY_HOURS * 100) / 100 : unit.startsWith("h") ? count : Math.round(count / 60 * 100) / 100;
    const label = unit.startsWith("d") ? `${count} day${count === 1 ? "" : "s"}` : unit.startsWith("h") ? `${count}h` : `${count}m`;
    return {
      hours,
      label,
      title: text.slice(0, duration.index).replace(/[\s\-–—:(]+$/, "").trim(),
      isRemainingTime: false
    };
  }
  const parsed = parseTimeEstimate(text);
  return {
    hours: parsed.hours,
    label: parsed.label,
    title: parsed.titleWithoutTime,
    isRemainingTime: Boolean(parsed.isRestOfDay)
  };
}
function planningMondayOf(periodStart, now = /* @__PURE__ */ new Date()) {
  const base = periodStart ? typeof periodStart === "string" ? /^\d{4}-\d{2}-\d{2}$/.test(periodStart) ? /* @__PURE__ */ new Date(`${periodStart}T12:00:00`) : parseISO(periodStart) : periodStart : now;
  const reportMonday = mondayOf(base);
  const currentMonday = mondayOf(now);
  if (reportMonday >= currentMonday) return reportMonday;
  return addDays(reportMonday, 7);
}
function weekdayInWeek(token, weekMonday) {
  const weekday = WEEKDAY_MAP[token.trim().toLowerCase()];
  if (weekday === void 0) return null;
  const offset = weekday === 0 ? 6 : weekday - 1;
  return startOfDay(addDays(mondayOf(weekMonday), offset));
}
function resolveWeeklyDueToken(token, planningMonday, now) {
  return weekdayInWeek(token, planningMonday) ?? parseRelativeDateToken(token, now);
}
function hoursFromCountUnit(count, unit) {
  const u = unit.toLowerCase();
  if (u.startsWith("d")) {
    return {
      hours: Math.round(count * WORKDAY_HOURS * 100) / 100,
      label: `${count} day${count === 1 ? "" : "s"}`
    };
  }
  if (u.startsWith("h")) return { hours: count, label: `${count}h` };
  return { hours: Math.round(count / 60 * 100) / 100, label: `${count}m` };
}
function tidyTitle(text) {
  return text.replace(/[\s\-–—:(]+$/g, "").replace(/\s+/g, " ").trim();
}
function stripCompletedMark(text) {
  COMPLETED_MARK_RE.lastIndex = 0;
  const alreadyCompleted = COMPLETED_MARK_RE.test(text);
  COMPLETED_MARK_RE.lastIndex = 0;
  if (!alreadyCompleted) return { title: text, alreadyCompleted: false };
  return { title: tidyTitle(text.replace(COMPLETED_MARK_RE, " ")), alreadyCompleted: true };
}
function stripSlashDue(text, planningMonday, now) {
  let dueDate = null;
  let cleaned = text;
  for (const match of text.matchAll(SLASH_DUE_RE)) {
    const resolved = resolveWeeklyDueToken(match[1], planningMonday, now);
    if (!resolved) continue;
    dueDate = format(resolved, "yyyy-MM-dd");
    cleaned = cleaned.replace(match[0], match[0].startsWith("/") ? "" : match[0][0] === "/" ? "" : " ");
  }
  return { title: tidyTitle(cleaned), dueDate };
}
function stripHashTime(text) {
  let hours = null;
  let label = null;
  let cleaned = text;
  for (const match of text.matchAll(HASH_TIME_RE)) {
    const parsed = hoursFromCountUnit(Number(match[1]), match[2]);
    hours = parsed.hours;
    label = parsed.label;
    cleaned = cleaned.replace(match[0], " ");
  }
  return { title: tidyTitle(cleaned), hours, label };
}
function parseWeeklyPlanList(text, options) {
  const now = options?.now ?? /* @__PURE__ */ new Date();
  const planningMonday = options?.weekScope === "current" ? reportingMondayOf(options?.periodStart, now) : planningMondayOf(options?.periodStart, now);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !LIST_MARKER_ONLY_RE.test(l));
  const rawItems = [];
  for (const rawLine of lines) {
    const numbered = rawLine.match(NUMBERED_LINE_RE);
    const body = numbered ? numbered[1].trim() : rawLine;
    if (!body) continue;
    if (!numbered && rawItems.length > 0 && body.length < 4) continue;
    const completedMark = stripCompletedMark(body);
    const workBody = completedMark.title || body;
    const slashDue = stripSlashDue(workBody, planningMonday, now);
    const hashTime = stripHashTime(slashDue.title || workBody);
    const dueParsed = stripDue(hashTime.title || slashDue.title || workBody);
    const estimate = parseWeeklyEstimate(dueParsed.title || hashTime.title || workBody);
    const title = estimate.title || dueParsed.title || hashTime.title || slashDue.title || workBody;
    const dueDate = slashDue.dueDate || dueParsed.dueDate;
    const estimatedHours = hashTime.hours ?? estimate.hours;
    const timeLabel = hashTime.label ?? estimate.label;
    if (!title) continue;
    if (!numbered && lines.length > 1 && estimatedHours == null && !estimate.isRemainingTime && !dueDate && !completedMark.alreadyCompleted) {
      continue;
    }
    const alreadyCompleted = completedMark.alreadyCompleted;
    const completionDate = alreadyCompleted ? format(now, "yyyy-MM-dd") : null;
    rawItems.push({
      title,
      estimatedHours,
      timeLabel,
      dueDate,
      isRemainingTime: estimate.isRemainingTime,
      rawLine,
      missingDueDate: alreadyCompleted ? false : !dueDate,
      missingEffort: estimatedHours == null && !estimate.isRemainingTime,
      alreadyCompleted,
      completionDate
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
      timeLabel: remaining ? `remaining \u2192 ${formatHoursLabel(remaining)}` : "remaining time",
      missingEffort: remaining <= 0
    };
  });
  return { items, workdayHours: WORKDAY_HOURS };
}
function reportingMondayOf(periodStart, now = /* @__PURE__ */ new Date()) {
  const base = periodStart ? typeof periodStart === "string" ? /^\d{4}-\d{2}-\d{2}$/.test(periodStart) ? /* @__PURE__ */ new Date(`${periodStart}T12:00:00`) : parseISO(periodStart) : periodStart : now;
  return mondayOf(base);
}
function parseWeeklyDoneList(text, options) {
  const now = options?.now ?? /* @__PURE__ */ new Date();
  const reportingMonday = reportingMondayOf(options?.periodStart, now);
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const items = [];
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || LIST_MARKER_ONLY_RE.test(trimmed)) continue;
    const numbered = trimmed.match(NUMBERED_LINE_RE);
    const body = numbered ? numbered[1].trim() : trimmed;
    if (!body) continue;
    const slashDue = stripSlashDue(body, reportingMonday, now);
    const hashTime = stripHashTime(slashDue.title || body);
    const dueParsed = stripDue(hashTime.title || slashDue.title || body);
    const estimate = parseWeeklyEstimate(dueParsed.title || hashTime.title || body);
    const title = estimate.title || dueParsed.title || hashTime.title || slashDue.title || body;
    if (!title) continue;
    const estimatedHours = hashTime.hours ?? estimate.hours;
    const completionDate = slashDue.dueDate || dueParsed.dueDate;
    items.push({
      title,
      description: "",
      rawLine: trimmed,
      estimatedHours,
      timeLabel: hashTime.label ?? estimate.label,
      completionDate,
      missingEffort: estimatedHours == null,
      missingDate: !completionDate
    });
  }
  return items.filter((item) => item.title);
}
function formatDueNoonForApi(day) {
  const value = typeof day === "string" ? day.includes("T") ? parseISO(day) : /* @__PURE__ */ new Date(`${day}T12:00:00`) : day;
  const ymd = format(value, "yyyy-MM-dd");
  return (/* @__PURE__ */ new Date(`${ymd}T12:00:00`)).toISOString();
}
function mondayOf(day = /* @__PURE__ */ new Date()) {
  const copy = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const weekday = copy.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  copy.setDate(copy.getDate() + offset);
  return copy;
}
function isWeekendOff(day) {
  const weekday = day.getDay();
  if (weekday === 0) return true;
  if (weekday === 6) {
    const saturdayOrdinal = Math.floor((day.getDate() - 1) / 7) + 1;
    return saturdayOrdinal === 2 || saturdayOrdinal === 4;
  }
  return false;
}
function workingWeekEnd(monday) {
  const start = mondayOf(monday);
  let last = start;
  for (let offset = 0; offset < 7; offset += 1) {
    const day = addDays(start, offset);
    if (!isWeekendOff(day)) last = day;
  }
  return last;
}
function weeksInMonth(year, monthIndex) {
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  let cursor = mondayOf(monthStart);
  const weeks = [];
  while (cursor <= monthEnd) {
    const end = workingWeekEnd(cursor);
    if (end >= monthStart) {
      const mondayIso = format(cursor, "yyyy-MM-dd");
      const endIso = format(end, "yyyy-MM-dd");
      const sameMonth = cursor.getMonth() === end.getMonth();
      const label = sameMonth ? `${format(cursor, "d")}\u2013${format(end, "d")}` : `${format(cursor, "d MMM")} \u2013 ${format(end, "d MMM")}`;
      weeks.push({ monday: mondayIso, end: endIso, label });
    }
    cursor = addDays(cursor, 7);
  }
  return weeks;
}
function monthKeyFromDate(day = /* @__PURE__ */ new Date()) {
  return format(day, "yyyy-MM");
}
function monthSelectOptions(now = /* @__PURE__ */ new Date()) {
  const options = [];
  const start = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  for (let i = 0; i < 16; i += 1) {
    const month = new Date(start.getFullYear(), start.getMonth() + i, 1);
    options.push({
      value: format(month, "yyyy-MM"),
      label: format(month, "MMMM yyyy")
    });
  }
  return options;
}
function toDateInput(value) {
  if (!value) return "";
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return format(parseISO(value), "yyyy-MM-dd");
  } catch {
    return value.slice(0, 10);
  }
}
export {
  WORKDAY_HOURS,
  formatDueNoonForApi,
  formatHoursLabel,
  isWeekendOff,
  mondayOf,
  monthKeyFromDate,
  monthSelectOptions,
  parseWeeklyDoneList,
  parseWeeklyPlanList,
  planningMondayOf,
  reportingMondayOf,
  toDateInput,
  weeksInMonth,
  workingWeekEnd
};
