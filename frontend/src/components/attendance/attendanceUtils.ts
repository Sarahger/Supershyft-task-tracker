import type { AttendanceStatus } from '../../types';
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_SHORT } from '../../types';

const ALLOWED: ReadonlySet<string> = new Set(['WFO', 'WFH', 'LEAVE']);

/** Only allow known enum values — blocks XSS via crafted status strings. */
export function normalizeStatus(value: string | null | undefined): AttendanceStatus | null {
  if (!value || !ALLOWED.has(value)) return null;
  return value as AttendanceStatus;
}

export function statusLabel(status: AttendanceStatus | null | undefined): string {
  const s = normalizeStatus(status ?? undefined);
  return s ? ATTENDANCE_STATUS_LABELS[s] : 'Not marked';
}

export function statusShort(status: AttendanceStatus | null | undefined): string {
  const s = normalizeStatus(status ?? undefined);
  return s ? ATTENDANCE_STATUS_SHORT[s] : '—';
}

export function statusDotClass(status: AttendanceStatus | null | undefined): string {
  const s = normalizeStatus(status ?? undefined);
  if (s === 'WFO') return 'bg-emerald-500';
  if (s === 'WFH') return 'bg-sky-500';
  if (s === 'LEAVE') return 'bg-amber-500';
  return 'bg-dark-muted ring-1 ring-inset ring-dark-border';
}

export function statusBadgeClass(status: AttendanceStatus | null | undefined): string {
  const s = normalizeStatus(status ?? undefined);
  if (s === 'WFO') return 'badge-approved border border-emerald-500/25';
  if (s === 'WFH') return 'badge-todo border border-sky-500/25';
  if (s === 'LEAVE') return 'badge-progress border border-amber-500/25';
  return 'bg-surface-muted text-text-muted border border-dark-border';
}

export function statusAccentBorder(status: AttendanceStatus | null | undefined): string {
  const s = normalizeStatus(status ?? undefined);
  if (s === 'WFO') return 'border-emerald-500/20 bg-emerald-500/5';
  if (s === 'WFH') return 'border-sky-500/20 bg-sky-500/5';
  if (s === 'LEAVE') return 'border-amber-500/20 bg-amber-500/5';
  return 'border-dark-border';
}

export function statusIconWrap(status: AttendanceStatus | null | undefined): string {
  const s = normalizeStatus(status ?? undefined);
  if (s === 'WFO') return 'bg-emerald-500/10 text-emerald-400';
  if (s === 'WFH') return 'bg-sky-500/10 text-sky-400';
  if (s === 'LEAVE') return 'bg-amber-500/10 text-amber-400';
  return 'bg-surface-muted text-text-muted';
}

export function greetingForNow(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatRecordedTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const MARK_OPTIONS: {
  status: AttendanceStatus;
  label: string;
  hint: string;
  iconKey: 'building' | 'home' | 'umbrella';
}[] = [
  { status: 'WFO', label: 'Work From Office', hint: 'In the office today', iconKey: 'building' },
  { status: 'WFH', label: 'Work From Home', hint: 'Working remotely', iconKey: 'home' },
  { status: 'LEAVE', label: 'On Leave', hint: 'Out today', iconKey: 'umbrella' },
];
