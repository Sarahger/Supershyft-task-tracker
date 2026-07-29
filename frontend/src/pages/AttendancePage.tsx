import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfWeek } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { attendanceApi } from '../services/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { canAccessAttendanceHr } from '../lib/roles';
import { toast } from '../components/ui/Toast';
import { AttendanceTodayHero } from '../components/attendance/AttendanceTodayHero';
import { AttendanceWeekStrip } from '../components/attendance/AttendanceWeekStrip';
import { AttendanceSummaryCard } from '../components/attendance/AttendanceSummaryCard';
import { AttendanceCalendar } from '../components/attendance/AttendanceCalendar';
import type { AttendanceRecord, AttendanceStatus } from '../types';
import { formatRecordedTime, statusLabel } from '../components/attendance/attendanceUtils';

export default function AttendancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [markSuccess, setMarkSuccess] = useState(false);
  const [selected, setSelected] = useState<{ day: Date; record: AttendanceRecord | null } | null>(null);

  const year = month.getFullYear();
  const monthNum = month.getMonth() + 1;

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'me', year, monthNum],
    queryFn: () => attendanceApi.me({ year, month: monthNum }).then((r) => r.data.data),
  });

  useEffect(() => {
    if (data && !data.today_record && !markSuccess) {
      setShowMarkModal(true);
    }
    if (data?.today_record) {
      setShowMarkModal(false);
    }
  }, [data, markSuccess]);

  const markMutation = useMutation({
    mutationFn: (status: AttendanceStatus) => attendanceApi.mark(status).then((r) => r.data.data),
    onSuccess: () => {
      setMarkSuccess(true);
      toast.success('Attendance Recorded — See you today');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setTimeout(() => {
        setMarkSuccess(false);
        setShowMarkModal(false);
      }, 1200);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not mark attendance';
      toast.error(typeof msg === 'string' ? msg : 'Already submitted today.');
      setShowMarkModal(false);
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  const weekStart = data?.today
    ? startOfWeek(parseISO(data.today), { weekStartsOn: 1 })
    : startOfWeek(now, { weekStartsOn: 1 });

  return (
    <div className="w-full pb-12 max-w-5xl" data-testid="attendance-page">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Attendance</h1>
          <p className="text-sm text-text-muted mt-0.5">Mark once a day. View your week and month at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/attendance/history"
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary px-3 py-2 rounded-lg hover:bg-dark-hover min-h-[44px]"
          >
            <CalendarDays className="h-4 w-4" />
            History
          </Link>
          {canAccessAttendanceHr(user) && (
            <Link
              to="/attendance/hr"
              className="inline-flex items-center gap-1.5 text-sm text-accent-primary hover:opacity-90 px-3 py-2 rounded-lg hover:bg-dark-hover min-h-[44px]"
              data-testid="link-attendance-hr"
            >
              HR overview
            </Link>
          )}
        </div>
      </header>

      <div className="space-y-5">
        <AttendanceTodayHero
          todayRecord={data?.today_record}
          showMarkModal={showMarkModal}
          markSuccess={markSuccess}
          marking={markMutation.isPending}
          onMark={(status) => markMutation.mutate(status)}
          loading={isLoading}
        />

        <AttendanceWeekStrip week={data?.week ?? []} weekStart={weekStart} loading={isLoading} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AttendanceSummaryCard summary={data?.summary} loading={isLoading} />
          <div className="space-y-3">
            <AttendanceCalendar
              month={month}
              records={data?.records ?? []}
              selected={selected?.day}
              onMonthChange={setMonth}
              onSelect={(day, record) => setSelected({ day, record })}
              loading={isLoading}
            />
            {selected && (
              <div className="rounded-xl border border-dark-border bg-surface-subtle p-4 text-sm">
                <p className="font-medium text-text-primary">{format(selected.day, 'EEEE, MMM d')}</p>
                <p className="text-text-secondary mt-1">{statusLabel(selected.record?.status)}</p>
                {selected.record?.recorded_at && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {formatRecordedTime(selected.record.recorded_at)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
