import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfWeek } from 'date-fns';
import { CalendarDays, Shield } from 'lucide-react';
import { attendanceApi } from '../services/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { canAccessAttendanceHr } from '../lib/roles';
import { toast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { AttendanceTodayHero } from '../components/attendance/AttendanceTodayHero';
import { AttendanceWeekStrip } from '../components/attendance/AttendanceWeekStrip';
import { AttendanceSummaryCard } from '../components/attendance/AttendanceSummaryCard';
import { AttendanceCalendar } from '../components/attendance/AttendanceCalendar';
import type { AttendanceRecord, AttendanceStatus } from '../types';
import { formatRecordedTime, statusLabel } from '../components/attendance/attendanceUtils';

export default function AttendancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
    <div
      className="w-full h-[calc(100dvh-5.25rem)] max-md:h-[calc(100dvh-9.75rem)] flex flex-col gap-3 overflow-hidden max-md:overflow-y-auto max-md:h-auto max-md:max-h-[calc(100dvh-9.75rem)]"
      data-testid="attendance-page"
    >
      <header className="shrink-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Attendance</h1>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            Mark once a day. Week and month at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate('/attendance/history')}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">History</span>
          </Button>
          {canAccessAttendanceHr(user) && (
            <Link to="/attendance/hr" data-testid="link-attendance-hr">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">HR overview</span>
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 md:grid-rows-[minmax(0,0.9fr)_minmax(0,1.15fr)] gap-3 max-md:grid-rows-none max-md:auto-rows-min">
        <div className="md:col-span-5 min-h-0 max-md:min-h-[8.5rem]">
          <AttendanceTodayHero
            todayRecord={data?.today_record}
            showMarkModal={showMarkModal}
            markSuccess={markSuccess}
            marking={markMutation.isPending}
            onMark={(status) => markMutation.mutate(status)}
            onOpenMark={() => setShowMarkModal(true)}
            loading={isLoading}
          />
        </div>

        <div className="md:col-span-7 min-h-0 max-md:min-h-[7.5rem]">
          <AttendanceWeekStrip week={data?.week ?? []} weekStart={weekStart} loading={isLoading} />
        </div>

        <div className="md:col-span-4 min-h-0 max-md:min-h-[11rem]">
          <AttendanceSummaryCard summary={data?.summary} loading={isLoading} />
        </div>

        <div className="md:col-span-8 min-h-0 relative max-md:min-h-[18rem]">
          <AttendanceCalendar
            month={month}
            records={data?.records ?? []}
            selected={selected?.day}
            onMonthChange={setMonth}
            onSelect={(day, record) => setSelected({ day, record })}
            loading={isLoading}
          />
          {selected && (
            <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-dark-border bg-dark-card/95 backdrop-blur-sm px-3 py-2 flex items-center justify-between gap-3 text-sm shadow-lg">
              <div className="min-w-0">
                <p className="font-medium text-text-primary truncate">
                  {format(selected.day, 'EEE, MMM d')}
                </p>
                <p className="text-xs text-text-secondary truncate">
                  {statusLabel(selected.record?.status)}
                  {selected.record?.recorded_at
                    ? ` · ${formatRecordedTime(selected.record.recorded_at)}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs text-text-muted hover:text-text-primary shrink-0"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
