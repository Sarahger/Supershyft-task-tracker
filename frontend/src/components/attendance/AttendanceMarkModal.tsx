import { useEffect, useState } from 'react';
import { Building2, Check, Clock, Home, Umbrella, Users, X } from 'lucide-react';
import clsx from 'clsx';
import { format, isToday, parseISO } from 'date-fns';
import type { AttendanceStatus } from '../../types';
import { greetingForNow, MARK_OPTIONS, statusIconWrap } from './attendanceUtils';

interface Props {
  open: boolean;
  loading?: boolean;
  onSelect: (status: AttendanceStatus) => void;
  onClose?: () => void;
  success?: boolean;
  /** ISO date yyyy-MM-dd or Date; defaults to today */
  date?: string | Date | null;
  currentStatus?: AttendanceStatus | null;
  isEdit?: boolean;
  /** When marking on behalf of someone else (HR) */
  personName?: string | null;
}

const ICONS = {
  building: Building2,
  home: Home,
  umbrella: Umbrella,
  clock: Clock,
  users: Users,
} as const;

function resolveDate(date?: string | Date | null): Date {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  return parseISO(date);
}

export function AttendanceMarkModal({
  open,
  loading,
  onSelect,
  onClose,
  success,
  date,
  currentStatus,
  isEdit,
  personName,
}: Props) {
  const [glow, setGlow] = useState<AttendanceStatus | null>(null);
  const [greeting] = useState(() => greetingForNow());
  const day = resolveDate(date);
  const today = isToday(day);

  useEffect(() => {
    if (!open) setGlow(null);
  }, [open]);

  if (!open) return null;

  const forPerson = personName?.trim() || null;
  const title = isEdit
    ? today
      ? forPerson
        ? `Update ${forPerson}'s attendance`
        : "Update today's attendance"
      : forPerson
        ? `Update ${forPerson} · ${format(day, 'MMM d')}`
        : `Update ${format(day, 'MMM d')}`
    : today
      ? forPerson
        ? `Mark ${forPerson}'s attendance`
        : "Mark today's attendance"
      : forPerson
        ? `Mark ${forPerson} · ${format(day, 'MMM d, yyyy')}`
        : `Mark ${format(day, 'MMM d, yyyy')}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-mark-title"
    >
      <div className="fixed inset-0 bg-[var(--overlay-backdrop)]" onClick={onClose} />
      <div
        className={clsx(
          'relative w-[90%] max-w-md rounded-2xl border border-dark-border bg-dark-card modal-panel',
          'my-auto animate-[fadeIn_0.2s_ease-out]',
        )}
      >
        {onClose && !success && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="p-5 sm:p-6">
          {success ? (
            <div className="flex flex-col items-center py-8 gap-3" data-testid="attendance-success">
              <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center animate-[scaleIn_0.35s_ease-out]">
                <Check className="h-6 w-6 text-emerald-400" strokeWidth={2.5} />
              </div>
              <p className="text-base font-semibold text-text-primary">
                {isEdit ? 'Attendance Updated' : 'Attendance Recorded'}
              </p>
              <p className="text-sm text-text-muted">
                {forPerson ? forPerson : today ? 'See you today' : format(day, 'EEEE, MMM d')}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 mb-5 pr-6">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 shrink-0">
                  <Check className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  {today && !forPerson && (
                    <p className="text-xs text-text-muted mb-0.5">{greeting}</p>
                  )}
                  <h2 id="attendance-mark-title" className="text-base font-semibold text-text-primary">
                    {title}
                  </h2>
                  <p className="text-sm text-text-muted mt-0.5">
                    {isEdit ? 'Pick a new status — saves immediately.' : "One tap. That's it."}
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-[min(60vh,420px)] overflow-y-auto">
                {MARK_OPTIONS.map((opt) => {
                  const Icon = ICONS[opt.iconKey];
                  const selected = currentStatus === opt.status || glow === opt.status;
                  return (
                    <button
                      key={opt.status}
                      type="button"
                      disabled={loading}
                      data-testid={`mark-${opt.status}`}
                      onClick={() => {
                        setGlow(opt.status);
                        onSelect(opt.status);
                      }}
                      className={clsx(
                        'w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 min-h-[52px]',
                        'text-left transition-all duration-hover active:scale-[0.98]',
                        'border-dark-border bg-surface-subtle hover:bg-dark-hover',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary',
                        selected && 'border-accent-primary/40 bg-surface-highlight',
                        loading && 'opacity-60 pointer-events-none',
                      )}
                    >
                      <span className={clsx('p-2 rounded-lg shrink-0', statusIconWrap(opt.status))}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-text-primary">{opt.label}</span>
                        <span className="block text-2xs text-text-muted mt-0.5">{opt.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
