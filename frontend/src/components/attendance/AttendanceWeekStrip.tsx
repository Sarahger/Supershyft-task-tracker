import { useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
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
      <div className="card h-full p-4">
        <div className="h-3 w-28 bg-dark-muted rounded mb-3 animate-pulse" />
        <div className="flex gap-2 h-full">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 rounded-lg bg-dark-muted animate-pulse min-h-[3.5rem]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="card h-full min-h-0 p-4 flex flex-col">
      <h2 className="workspace-section-title !mb-2 !px-0 shrink-0">This week</h2>
      <div className="flex-1 min-h-0 flex gap-1.5 sm:gap-2">
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
                'relative flex-1 min-w-0 rounded-lg border border-dark-border',
                'flex flex-col items-center justify-center gap-1.5 py-2',
                'transition-colors duration-hover hover:bg-dark-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary',
                isActive && 'bg-surface-highlight border-accent-primary/30',
              )}
              aria-label={`${format(day, 'EEEE')} ${statusLabel(record?.status)}`}
            >
              <span className="text-2xs uppercase tracking-wide text-text-muted">{format(day, 'EEE')}</span>
              <AttendanceStatusDot status={record?.status ?? null} recordedAt={record?.recorded_at} size="md" />
              {isActive && (
                <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-10 rounded-lg dropdown-panel px-2.5 py-1.5 text-2xs text-text-secondary whitespace-nowrap pointer-events-none">
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
