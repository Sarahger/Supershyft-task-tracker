import { startOfDay } from 'date-fns';
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_SHORT } from '../../types';
const ALLOWED = new Set(['WFO', 'WFH', 'LEAVE', 'HALF_DAY', 'CAMP']);
/** Only allow known enum values — blocks XSS via crafted status strings. */
export function normalizeStatus(value) {
    if (!value || !ALLOWED.has(value))
        return null;
    return value;
}
export function statusLabel(status) {
    const s = normalizeStatus(status ?? undefined);
    return s ? ATTENDANCE_STATUS_LABELS[s] : 'Not marked';
}
export function statusShort(status) {
    const s = normalizeStatus(status ?? undefined);
    return s ? ATTENDANCE_STATUS_SHORT[s] : '—';
}
export function statusDotClass(status) {
    const s = normalizeStatus(status ?? undefined);
    if (s === 'WFO')
        return 'bg-emerald-500';
    if (s === 'WFH')
        return 'bg-sky-500';
    if (s === 'LEAVE')
        return 'bg-amber-500';
    if (s === 'HALF_DAY')
        return 'bg-violet-500';
    if (s === 'CAMP')
        return 'bg-orange-500';
    return 'bg-dark-muted ring-1 ring-inset ring-dark-border';
}
export function statusBadgeClass(status) {
    const s = normalizeStatus(status ?? undefined);
    if (s === 'WFO')
        return 'badge-approved border border-emerald-500/25';
    if (s === 'WFH')
        return 'badge-todo border border-sky-500/25';
    if (s === 'LEAVE')
        return 'badge-progress border border-amber-500/25';
    if (s === 'HALF_DAY')
        return 'badge-review border border-violet-500/25';
    if (s === 'CAMP')
        return 'badge-changes border border-orange-500/25';
    return 'bg-surface-muted text-text-muted border border-dark-border';
}
export function statusAccentBorder(status) {
    const s = normalizeStatus(status ?? undefined);
    if (s === 'WFO')
        return 'border-emerald-500/20 bg-emerald-500/5';
    if (s === 'WFH')
        return 'border-sky-500/20 bg-sky-500/5';
    if (s === 'LEAVE')
        return 'border-amber-500/20 bg-amber-500/5';
    if (s === 'HALF_DAY')
        return 'border-violet-500/20 bg-violet-500/5';
    if (s === 'CAMP')
        return 'border-orange-500/20 bg-orange-500/5';
    return 'border-dark-border';
}
export function statusIconWrap(status) {
    const s = normalizeStatus(status ?? undefined);
    if (s === 'WFO')
        return 'bg-emerald-500/10 text-emerald-400';
    if (s === 'WFH')
        return 'bg-sky-500/10 text-sky-400';
    if (s === 'LEAVE')
        return 'bg-amber-500/10 text-amber-400';
    if (s === 'HALF_DAY')
        return 'bg-violet-500/10 text-violet-400';
    if (s === 'CAMP')
        return 'bg-orange-500/10 text-orange-400';
    return 'bg-surface-muted text-text-muted';
}
export function greetingForNow(now = new Date()) {
    const h = now.getHours();
    if (h < 12)
        return 'Good morning';
    if (h < 17)
        return 'Good afternoon';
    return 'Good evening';
}
export function formatRecordedTime(iso) {
    if (!iso)
        return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
/** Self-service: mark/edit allowed only for today and yesterday (local calendar days). */
export function isAttendanceEditableDay(day, now = new Date()) {
    const start = startOfDay(now).getTime();
    const target = startOfDay(day).getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    return target <= start && target >= start - dayMs;
}
/** Managers/HR: mark/edit any past or current day (never future). */
export function isAttendanceHrEditableDay(day, now = new Date()) {
    return startOfDay(day).getTime() <= startOfDay(now).getTime();
}
export const MARK_OPTIONS = [
    { status: 'WFO', label: 'Work From Office', hint: 'In the office today', iconKey: 'building' },
    { status: 'WFH', label: 'Work From Home', hint: 'Working remotely', iconKey: 'home' },
    { status: 'LEAVE', label: 'On Leave', hint: 'Out today', iconKey: 'umbrella' },
    { status: 'HALF_DAY', label: 'Half Day', hint: 'Working part of the day', iconKey: 'clock' },
    { status: 'CAMP', label: 'Camp/Meeting', hint: 'At camp or an offsite meeting', iconKey: 'users' },
];
