import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subYears,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';
import { periodLabel, type WorkVaultPeriod } from '../../lib/workVault';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseSelected(mode: WorkVaultPeriod, value: string) {
  if (mode === 'month' && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }
  const match = value.match(/^(\d{4})-W(\d{2})$/);
  if (mode === 'week' && match) {
    const year = Number(match[1]);
    const week = Number(match[2]);
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const day = simple.getUTCDay();
    const monday = new Date(simple);
    monday.setUTCDate(simple.getUTCDate() - (day <= 4 ? day - 1 : day - 8));
    return new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
  }
  return new Date();
}

function weekValueFromDate(day: Date) {
  const thursday = new Date(day);
  thursday.setDate(day.getDate() + 4 - (day.getDay() || 7));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function sameWeek(a: Date, b: Date) {
  return weekValueFromDate(a) === weekValueFromDate(b);
}

export function PeriodFilter({
  mode,
  value,
  onChange,
}: {
  mode: WorkVaultPeriod;
  value: string;
  onChange: (mode: WorkVaultPeriod, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Exclude<WorkVaultPeriod, ''>>(mode || 'week');
  const [cursor, setCursor] = useState(() => parseSelected(mode, value));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setTab(mode || 'week');
    setCursor(parseSelected(mode, value));
  }, [open, mode, value]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selected = mode ? parseSelected(mode, value) : null;
  const label = periodLabel(mode, value);

  const pickWeek = (day: Date) => {
    onChange('week', weekValueFromDate(day));
    setOpen(false);
  };

  const pickMonth = (year: number, monthIndex: number) => {
    onChange('month', `${year}-${String(monthIndex + 1).padStart(2, '0')}`);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          'p-2 rounded-md min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors',
          open || mode
            ? 'text-accent-primary bg-dark-hover'
            : 'text-text-muted hover:text-text-primary hover:bg-dark-hover',
        )}
        aria-label="Choose week or month"
        aria-expanded={open}
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl dropdown-panel border border-dark-border p-3 shadow-lg">
          <div className="flex rounded-lg bg-dark-muted p-0.5 mb-3">
            {(['week', 'month'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={clsx(
                  'flex-1 py-1.5 text-xs font-medium rounded-md capitalize',
                  tab === item ? 'bg-dark-card text-text-primary' : 'text-text-muted hover:text-text-secondary',
                )}
              >
                {item}
              </button>
            ))}
          </div>

          {tab === 'week' ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <button type="button" className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover" onClick={() => setCursor(subMonths(cursor, 1))} aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-medium text-text-primary">{format(cursor, 'MMMM yyyy')}</p>
                <button type="button" className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="text-center text-2xs uppercase tracking-wider text-text-muted py-0.5">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const inMonth = isSameMonth(day, cursor);
                  const selectedWeek = selected && mode === 'week' && sameWeek(day, selected);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => pickWeek(day)}
                      className={clsx(
                        'h-8 rounded-md text-xs',
                        !inMonth && 'text-text-muted/40',
                        inMonth && !selectedWeek && 'text-text-secondary hover:bg-dark-hover',
                        selectedWeek && 'bg-accent-primary/15 text-accent-primary font-medium',
                        isToday(day) && !selectedWeek && 'ring-1 ring-dark-border',
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <button type="button" className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover" onClick={() => setCursor(subYears(cursor, 1))} aria-label="Previous year">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-medium text-text-primary">{format(cursor, 'yyyy')}</p>
                <button type="button" className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover" onClick={() => setCursor(addYears(cursor, 1))} aria-label="Next year">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS.map((name, index) => {
                  const selectedMonth = mode === 'month' && selected
                    && selected.getFullYear() === cursor.getFullYear()
                    && selected.getMonth() === index;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => pickMonth(cursor.getFullYear(), index)}
                      className={clsx(
                        'py-2 rounded-md text-xs',
                        selectedMonth
                          ? 'bg-accent-primary/15 text-accent-primary font-medium'
                          : 'text-text-secondary hover:bg-dark-hover',
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex justify-between items-center mt-3 pt-2 border-t border-dark-border">
            <p className="text-2xs text-text-muted truncate pr-2">{label}</p>
            {mode ? (
              <button
                type="button"
                className="text-2xs text-text-secondary hover:text-text-primary inline-flex items-center gap-1"
                onClick={() => {
                  onChange('', '');
                  setOpen(false);
                }}
              >
                <X className="h-3 w-3" /> All time
              </button>
            ) : (
              <span className="text-2xs text-text-muted">All time</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
