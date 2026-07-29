import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { attendanceApi } from '../services/endpoints';
import { PageHeader } from '../components/ui/PageHeader';
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
  const navigate = useNavigate();
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
      <PageHeader
        title="Attendance History"
        subtitle="Your personal monthly record."
        onMobileBack={() => navigate('/attendance')}
      />

      <div className="flex flex-wrap items-center gap-3 mb-6 sticky top-0 z-10 py-2 bg-dark-bg">
        <label className="text-xs font-medium text-text-secondary" htmlFor="attendance-month">
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
          className="input py-2 text-sm w-auto min-h-[40px]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex rounded-lg border border-dark-border overflow-hidden bg-dark-card">
          <button
            type="button"
            data-testid="view-calendar"
            onClick={() => setView('calendar')}
            className={clsx(
              'px-3 py-2 text-xs font-medium min-h-[40px] transition-colors duration-hover',
              view === 'calendar' ? 'bg-surface-highlight text-text-primary' : 'text-text-muted hover:text-text-secondary',
            )}
          >
            Calendar
          </button>
          <button
            type="button"
            data-testid="view-table"
            onClick={() => setView('table')}
            className={clsx(
              'px-3 py-2 text-xs font-medium min-h-[40px] transition-colors duration-hover',
              view === 'table' ? 'bg-surface-highlight text-text-primary' : 'text-text-muted hover:text-text-secondary',
            )}
          >
            Table
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
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

        <aside className="card p-4 h-fit sticky top-16">
          <h2 className="workspace-section-title !mb-3 !px-0">Day detail</h2>
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
