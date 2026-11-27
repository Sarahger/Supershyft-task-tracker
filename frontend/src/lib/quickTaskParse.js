import { addDays, format, isValid, nextDay, parse, startOfDay, } from 'date-fns';
import { extractMentionedUserIds, mentionDisplayName, } from './mentions';
export const WEEKDAY_MAP = {
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
const TIME_TOKEN_RE = /(?:^|\s)#\s*(\d+(?:\.\d+)?)\s*(m|min|mins|minutes|h|hr|hrs|hour|hours)\b/gi;
export const PRIORITY_CYCLE = ['low', 'medium', 'high', 'critical'];
export const PRIORITY_SHORT = {
    low: 'low',
    medium: 'med',
    high: 'high',
    critical: 'crit',
};
export function nextPriority(current) {
    const idx = PRIORITY_CYCLE.indexOf(current);
    return PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
}
export function parseRelativeDateToken(token, now = new Date()) {
    const raw = token.trim().toLowerCase();
    if (!raw)
        return null;
    const today = startOfDay(now);
    if (raw === 'today' || raw === 'tod')
        return today;
    if (raw === 'tomorrow' || raw === 'tmr' || raw === 'tmrw')
        return addDays(today, 1);
    if (raw === 'yesterday')
        return addDays(today, -1);
    if (raw === 'nextweek' || raw === 'next-week')
        return addDays(today, 7);
    const weekday = WEEKDAY_MAP[raw];
    if (weekday !== undefined) {
        return nextDay(today, weekday);
    }
    for (const pattern of ['MMM-d', 'MMM-dd', 'MMM-d-yyyy', 'M-d', 'M-d-yyyy', 'yyyy-MM-dd']) {
        const parsed = parse(raw, pattern, now);
        if (isValid(parsed))
            return startOfDay(parsed);
    }
    return null;
}
/** Parse `#1h` / `#15m` style duration into hours. */
export function parseTimeRequiredToken(value, unit) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0)
        return null;
    const u = unit.toLowerCase();
    const hours = u.startsWith('h') ? amount : amount / 60;
    return Math.round(hours * 100) / 100;
}
export function formatQuickTimeLabel(hours) {
    if (hours < 1) {
        const mins = Math.round(hours * 60);
        return mins <= 0 ? '0m' : `${mins}m`;
    }
    const rounded = Math.round(hours * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}h` : `${rounded}h`;
}
/** Active `/…` query at the end of the input (for suggestions). */
export function getActiveDateQuery(text) {
    const match = text.match(/(?:^|\s)\/([a-zA-Z0-9._-]*)$/);
    return match ? match[1] : null;
}
/** Active `#…` query at the end of the input (for suggestions). */
export function getActiveTimeQuery(text) {
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
];
export const TIME_SUGGESTIONS = [
    { token: '15m', label: '15 minutes' },
    { token: '30m', label: '30 minutes' },
    { token: '45m', label: '45 minutes' },
    { token: '1h', label: '1 hour' },
    { token: '1.5h', label: '1.5 hours' },
    { token: '2h', label: '2 hours' },
    { token: '3h', label: '3 hours' },
    { token: '4h', label: '4 hours' },
];
export function matchDateSuggestions(query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return [...DATE_SUGGESTIONS];
    return DATE_SUGGESTIONS.filter((s) => s.token.startsWith(q) || s.label.toLowerCase().startsWith(q));
}
export function matchTimeSuggestions(query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return [...TIME_SUGGESTIONS];
    return TIME_SUGGESTIONS.filter((s) => s.token.startsWith(q) || s.label.toLowerCase().includes(q));
}
export function parseQuickTask(text, users, now = new Date()) {
    const assigneeIds = extractMentionedUserIds(text, users);
    const assignees = users.filter((u) => assigneeIds.includes(u.id));
    let dueDate = null;
    let dueLabel = null;
    let rawDateToken = null;
    let estimatedHours = null;
    let timeLabel = null;
    let cleaned = text;
    const dateMatches = [...text.matchAll(DATE_TOKEN_RE)];
    for (const match of dateMatches) {
        const token = match[1];
        const parsed = parseRelativeDateToken(token, now);
        if (!parsed)
            continue;
        dueDate = parsed;
        rawDateToken = token;
        dueLabel = format(parsed, 'EEE, MMM d');
        cleaned = cleaned.replace(match[0], match[0].startsWith(' ') ? ' ' : '');
    }
    const timeMatches = [...cleaned.matchAll(TIME_TOKEN_RE)];
    for (const match of timeMatches) {
        const hours = parseTimeRequiredToken(match[1], match[2]);
        if (hours == null)
            continue;
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
export function formatDueForApi(date) {
    return new Date(`${format(date, 'yyyy-MM-dd')}T12:00:00`).toISOString();
}
