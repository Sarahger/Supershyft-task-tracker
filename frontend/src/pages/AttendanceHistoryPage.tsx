import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { ArrowLeft } from 'lucide-react';
import { attendanceApi } from '../services/endpoints';
import { AttendanceCalendar } from '../components/attendance/AttendanceCalendar';
import { AttendanceTable } from '../components/attendance/AttendanceTable';
import { formatRecordedTime, statusLabel } from '../components/attendance/attendanceUtils';
import type { AttendanceRecord } from '../types';

function monthOptions(count = 18): { value: string; label: string; year: number; month: number }[] {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${d.getMonth() + 1}`,
      label: format(d, 'MMMM yyyy'),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  return out;
}

export default function AttendanceHistoryPage() {
  const options = useMemo(() => monthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(options[0].value);
  const [view, setView] = useState<'calendar' | 'table'>('calendar');
  const [detail, setDetail] = useState<{ day: Date; record: AttendanceRecord | null } | null>(null);

  const opt = options.find((o) => o.value === selectedMonth) ?? options[0];
  const monthDate = new Date(opt.year, opt.month - 1, 1);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'me', opt.year, opt.month],
    queryFn: () => attendanceApi.me({ year: opt.year, month: opt.month }).then((r) => r.data.data),
  });

  return (
    <div className="w-full pb-12 max-w-5xl" data-testid="attendance-history-page">
      <header className="mb-6">
        <Link
          to="/attendance"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Attendance
        </Link>
        <h1 className="text-xl font-semibold text-text-primary">Attendance History</h1>
        <p className="text-sm text-text-muted mt-0.5">Your personal monthly record.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-5 sticky top-0 z-10 py-2 bg-dark-bg">
        <label className="text-xs text-text-muted" htmlFor="attendance-month">
          Month
        </label>
        <select
          id="attendance-month"
          data-testid="history-month-select"
          value={selectedMonth}
          onChange={(e) => {
            setSelectedMonth(e.target.value);
            setDetail(null);
          }}
          className="rounded-lg border border-dark-border bg-dark-card text-sm text-text-primary px-3 py-2 min-h-[44px]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex rounded-lg border border-dark-border overflow-hidden">
          <button
            type="button"
            data-testid="view-calendar"
            onClick={() => setView('calendar')}
            className={clsx(
              'px-3 py-2 text-xs font-medium min-h-[44px]',
              view === 'calendar' ? 'bg-dark-hover text-text-primary' : 'text-text-muted',
            )}
          >
            Calendar
          </button>
          <button
            type="button"
            data-testid="view-table"
            onClick={() => setView('table')}
            className={clsx(
              'px-3 py-2 text-xs font-medium min-h-[44px]',
              view === 'table' ? 'bg-dark-hover text-text-primary' : 'text-text-muted',
            )}
          >
            Table
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5">
        <div>
          {view === 'calendar' ? (
            <AttendanceCalendar
              month={monthDate}
              records={data?.records ?? []}
              selected={detail?.day}
              onMonthChange={(m) => {
                setSelectedMonth(`${m.getFullYear()}-${m.getMonth() + 1}`);
                setDetail(null);
              }}
              onSelect={(day, record) => setDetail({ day, record })}
              loading={isLoading}
            />
          ) : (
            <AttendanceTable
              records={data?.records ?? []}
              loading={isLoading}
              onSelect={(record) =>
                setDetail({ day: parseISO(record.attendance_date), record })
              }
            />
          )}
        </div>

        <aside className="rounded-2xl border border-dark-border bg-dark-card p-4 h-fit sticky top-16">
          <h2 className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">Day detail</h2>
          {detail ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-text-primary">{format(detail.day, 'EEEE, MMM d, yyyy')}</p>
              <p className="text-text-secondary">{statusLabel(detail.record?.status)}</p>
              {detail.record?.recorded_at && (
                <p className="text-xs text-text-muted">
                  Recorded time: {formatRecordedTime(detail.record.recorded_at)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Select a day to see status and time.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
