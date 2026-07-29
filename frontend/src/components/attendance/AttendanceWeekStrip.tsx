import { useState } from 'react';
import {
  addDays,
  format,
  startOfWeek,
} from 'date-fns';
import clsx from 'clsx';
import type { AttendanceRecord } from '../../types';
import { AttendanceStatusDot } from './AttendanceStatusDot';
import { formatRecordedTime, statusLabel } from './attendanceUtils';

interface Props {
  week: (AttendanceRecord | null)[];
  weekStart?: Date;
  loading?: boolean;
}

export function AttendanceWeekStrip({ week, weekStart, loading }: Props) {
  const start = weekStart ?? startOfWeek(new Date(), { weekStartsOn: 1 });
  const [active, setActive] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="rounded-2xl border border-dark-border bg-dark-card p-4">
        <div className="h-4 w-36 bg-dark-muted rounded mb-4 animate-pulse" />
        <div className="flex gap-2 overflow-x-auto">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-16 w-14 shrink-0 rounded-xl bg-dark-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-dark-border bg-dark-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-text-primary mb-3">Attendance This Week</h2>
          <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
        {Array.from({ length: 7 }).map((_, i) => {
          const day = addDays(start, i);
          const record = week[i] ?? null;
          const isActive = active === i;
          return (
            <button
              key={format(day, 'yyyy-MM-dd')}
              type="button"
              onClick={() => setActive(isActive ? null : i)}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={clsx(
                'relative snap-start shrink-0 w-14 sm:w-16 rounded-xl border border-dark-border',
                'flex flex-col items-center gap-1.5 py-2.5 min-h-[64px]',
                'transition-all duration-200 hover:bg-dark-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary',
                'opacity-0 animate-[fadeIn_0.4s_ease-out_forwards]',
              )}
              style={{ animationDelay: `${i * 60}ms` }}
              aria-label={`${format(day, 'EEEE')} ${statusLabel(record?.status)}`}
            >
              <span className="text-2xs uppercase text-text-muted">{format(day, 'EEE')}</span>
              <AttendanceStatusDot status={record?.status ?? null} recordedAt={record?.recorded_at} size="lg" />
              {isActive && (
                <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-10 rounded-lg border border-dark-border bg-dark-card px-2 py-1 text-2xs text-text-secondary shadow-lg whitespace-nowrap">
                  {format(day, 'MMM d')} · {statusLabel(record?.status)}
                  {record?.recorded_at ? ` · ${formatRecordedTime(record.recorded_at)}` : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
