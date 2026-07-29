import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import type { AttendanceStatus } from '../../types';
import { greetingForNow, MARK_OPTIONS } from './attendanceUtils';

interface Props {
  open: boolean;
  loading?: boolean;
  onSelect: (status: AttendanceStatus) => void;
  onClose?: () => void;
  success?: boolean;
}

export function AttendanceMarkModal({ open, loading, onSelect, success }: Props) {
  const [glow, setGlow] = useState<AttendanceStatus | null>(null);
  const [greeting] = useState(() => greetingForNow());

  useEffect(() => {
    if (!open) setGlow(null);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-mark-title"
    >
      <div className="fixed inset-0 bg-[var(--overlay-backdrop)]" />
      <div
        className={clsx(
          'relative w-[90%] max-w-md rounded-2xl border border-dark-border bg-dark-card p-6 shadow-xl',
          'animate-[fadeIn_0.2s_ease-out]',
        )}
      >
        {success ? (
          <div className="flex flex-col items-center py-8 gap-3" data-testid="attendance-success">
            <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center animate-[scaleIn_0.35s_ease-out]">
              <Check className="h-8 w-8 text-emerald-400" strokeWidth={2.5} />
            </div>
            <p className="text-lg font-semibold text-text-primary">Attendance Recorded</p>
            <p className="text-sm text-text-muted">See you today</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-text-muted mb-1">{greeting}</p>
            <h2 id="attendance-mark-title" className="text-xl font-semibold text-text-primary mb-1">
              Mark today&apos;s attendance
            </h2>
            <p className="text-sm text-text-muted mb-5">One tap. That&apos;s it.</p>
            <div className="space-y-2.5">
              {MARK_OPTIONS.map((opt) => (
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
                    'w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 min-h-[52px]',
                    'text-left transition-all duration-150 active:scale-[0.98]',
                    'border-dark-border bg-surface-subtle hover:bg-dark-hover',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary',
                    glow === opt.status && 'ring-2 ring-accent-primary/60 shadow-[0_0_20px_rgba(96,165,250,0.25)]',
                    loading && 'opacity-60 pointer-events-none',
                  )}
                >
                  <span className="text-2xl" aria-hidden>
                    {opt.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-text-primary">{opt.label}</span>
                    <span className="block text-2xs text-text-muted">{opt.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
