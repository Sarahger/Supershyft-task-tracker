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
import type { DailyUpdateCalendarDay } from '../../types';

interface Props {
  month: Date;
  selected: Date;
  markers: DailyUpdateCalendarDay[];
  onMonthChange: (month: Date) => void;
  onSelect: (day: Date) => void;
}

export function DailyUpdateCalendar({ month, selected, markers, onMonthChange, onSelect }: Props) {
  const markerMap = new Map(markers.map((m) => [m.date, m]));
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  return (
    <div className="rounded-2xl border border-dark-border bg-dark-card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => onMonthChange(subMonths(month, 1))}
          className="p-1.5 rounded-lg text-text-muted hover:bg-dark-hover hover:text-text-primary"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-medium text-text-primary">{format(month, 'MMMM yyyy')}</p>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="p-1.5 rounded-lg text-text-muted hover:bg-dark-hover hover:text-text-primary"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <div key={d} className="text-center text-2xs uppercase tracking-wide text-text-muted py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const marker = markerMap.get(key);
          const selectedDay = isSameDay(day, selected);
          const inMonth = isSameMonth(day, month);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(day)}
              className={clsx(
                'relative flex flex-col items-center justify-center rounded-lg py-1.5 min-h-[36px] text-sm transition-colors',
                selectedDay && 'bg-accent-primary text-white',
                !selectedDay && inMonth && 'text-text-primary hover:bg-dark-hover',
                !selectedDay && !inMonth && 'text-text-muted/50',
                !selectedDay && isToday(day) && 'ring-1 ring-accent-primary/40',
              )}
            >
              {format(day, 'd')}
              {(marker?.has_own || (marker?.mention_count ?? 0) > 0 || (marker?.team_count ?? 0) > 0) && (
                <span className="absolute bottom-0.5 flex gap-0.5">
                  {marker?.has_own && (
                    <span className={clsx('h-1 w-1 rounded-full', selectedDay ? 'bg-white' : 'bg-accent-primary')} />
                  )}
                  {(marker?.mention_count ?? 0) > 0 && (
                    <span className={clsx('h-1 w-1 rounded-full', selectedDay ? 'bg-white/80' : 'bg-emerald-400')} />
                  )}
                  {(marker?.team_count ?? 0) > 0 && !marker?.has_own && (
                    <span className={clsx('h-1 w-1 rounded-full', selectedDay ? 'bg-white/60' : 'bg-sky-400')} />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
