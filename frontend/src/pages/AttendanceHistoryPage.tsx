import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { Pencil } from 'lucide-react';
import { attendanceApi } from '../services/endpoints';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { AttendanceCalendar } from '../components/attendance/AttendanceCalendar';
import { AttendanceTable } from '../components/attendance/AttendanceTable';
import { AttendanceMarkModal } from '../components/attendance/AttendanceMarkModal';
import {
  formatRecordedTime,
  isAttendanceEditableDay,
  statusLabel,
} from '../components/attendance/attendanceUtils';
import type { AttendanceRecord, AttendanceStatus } from '../types';

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

function toIsoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export default function AttendanceHistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const options = useMemo(() => monthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(options[0].value);
  const [view, setView] = useState<'calendar' | 'table'>('calendar');
  const [detail, setDetail] = useState<{ day: Date; record: AttendanceRecord | null } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [markSuccess, setMarkSuccess] = useState(false);

  const opt = options.find((o) => o.value === selectedMonth) ?? options[0];
  const monthDate = new Date(opt.year, opt.month - 1, 1);
  const canEditDetail = detail ? isAttendanceEditableDay(detail.day) : false;

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'me', opt.year, opt.month],
    queryFn: () => attendanceApi.me({ year: opt.year, month: opt.month }).then((r) => r.data.data),
  });

  const markMutation = useMutation({
    mutationFn: ({ status, date }: { status: AttendanceStatus; date: string }) =>
      attendanceApi.mark(status, date).then((r) => r.data.data),
    onSuccess: () => {
      setMarkSuccess(true);
      toast.success('Attendance saved');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setTimeout(() => {
        setMarkSuccess(false);
        setEditOpen(false);
      }, 1000);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not save attendance';
      toast.error(typeof msg === 'string' ? msg : 'Could not save attendance');
    },
  });

  const selectDay = (day: Date, record: AttendanceRecord | null) => {
    setDetail({ day, record });
    if (isAttendanceEditableDay(day)) {
      setEditOpen(true);
    } else {
      setEditOpen(false);
    }
  };

  return (
    <div className="w-full pb-12 max-w-5xl" data-testid="attendance-history-page">
      <PageHeader
        title="Attendance History"
        subtitle="View your history. Mark or edit only today and yesterday."
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
            setEditOpen(false);
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
              view === 'calendar'
                ? 'bg-surface-highlight text-text-primary'
                : 'text-text-muted hover:text-text-secondary',
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
              view === 'table'
                ? 'bg-surface-highlight text-text-primary'
                : 'text-text-muted hover:text-text-secondary',
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
                setEditOpen(false);
              }}
              onSelect={selectDay}
              loading={isLoading}
            />
          ) : (
            <AttendanceTable
              records={data?.records ?? []}
              loading={isLoading}
              onSelect={(record) => selectDay(parseISO(record.attendance_date), record)}
            />
          )}
        </div>

        <aside className="card p-4 h-fit sticky top-16">
          <h2 className="workspace-section-title !mb-3 !px-0">Day detail</h2>
          {detail ? (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-text-primary">
                  {format(detail.day, 'EEEE, MMM d, yyyy')}
                </p>
                <p className="text-text-secondary mt-1">{statusLabel(detail.record?.status)}</p>
                {detail.record?.recorded_at && (
                  <p className="text-xs text-text-muted">
                    Recorded time: {formatRecordedTime(detail.record.recorded_at)}
                  </p>
                )}
                {!canEditDetail && (
                  <p className="text-xs text-text-muted mt-2">
                    Only today and yesterday can be marked or edited.
                  </p>
                )}
              </div>
              {canEditDetail && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1.5 w-full"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {detail.record ? 'Edit attendance' : 'Mark attendance'}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Select a day to view or edit.</p>
          )}
        </aside>
      </div>

      {detail && canEditDetail && (
        <AttendanceMarkModal
          open={editOpen || markSuccess}
          loading={markMutation.isPending}
          success={markSuccess}
          date={detail.day}
          currentStatus={detail.record?.status}
          isEdit={!!detail.record}
          onSelect={(status) => markMutation.mutate({ status, date: toIsoDate(detail.day) })}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
