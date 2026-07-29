import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { AttendanceRecord } from '../../types';
import { normalizeStatus, statusDotClass, statusLabel, formatRecordedTime } from './attendanceUtils';

interface Props {
  month: Date;
  records: AttendanceRecord[];
  selected?: Date | null;
  onMonthChange: (month: Date) => void;
  onSelect: (day: Date, record: AttendanceRecord | null) => void;
  loading?: boolean;
}

export function AttendanceCalendar({
  month,
  records,
  selected,
  onMonthChange,
  onSelect,
  loading,
}: Props) {
  const map = new Map(records.map((r) => [r.attendance_date, r]));
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  if (loading) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="h-5 w-32 bg-dark-muted rounded mx-auto mb-4" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-md bg-dark-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="card p-3 sm:p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => onMonthChange(subMonths(month, 1))}
          className="p-2 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors duration-hover"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium text-text-primary" key={format(month, 'yyyy-MM')}>
          {format(month, 'MMMM yyyy')}
        </p>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="p-2 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors duration-hover"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <div key={d} className="text-center text-2xs uppercase tracking-wider text-text-muted py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" key={format(month, 'yyyy-MM')}>
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const record = map.get(key) ?? null;
          const status = normalizeStatus(record?.status);
          const selectedDay = selected ? isSameDay(day, selected) : false;
          const inMonth = isSameMonth(day, month);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(day, record)}
              title={
                record
                  ? `${statusLabel(status)} · ${formatRecordedTime(record.recorded_at)}`
                  : statusLabel(null)
              }
              className={clsx(
                'relative flex flex-col items-center justify-center rounded-md py-1.5 min-h-[40px] sm:min-h-[44px] text-sm transition-colors duration-hover',
                selectedDay && 'bg-surface-active text-text-primary',
                !selectedDay && inMonth && 'text-text-primary hover:bg-dark-hover',
                !selectedDay && !inMonth && 'text-text-muted/40',
                !selectedDay && isToday(day) && 'calendar-today-pill',
              )}
              aria-label={`${format(day, 'MMMM d')}: ${statusLabel(status)}`}
            >
              <span className="text-xs mb-0.5 tabular-nums">{format(day, 'd')}</span>
              <span
                className={clsx(
                  'h-1.5 w-1.5 rounded-full',
                  status ? statusDotClass(status) : 'bg-transparent',
                  !inMonth && 'opacity-40',
                )}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
