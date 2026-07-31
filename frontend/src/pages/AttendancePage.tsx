import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isToday, parseISO, startOfWeek } from 'date-fns';
import { Shield } from 'lucide-react';
import { attendanceApi } from '../services/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { canAccessAttendanceHr } from '../lib/roles';
import { toast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { AttendanceTodayHero } from '../components/attendance/AttendanceTodayHero';
import { AttendanceWeekStrip } from '../components/attendance/AttendanceWeekStrip';
import { AttendanceSummaryCard } from '../components/attendance/AttendanceSummaryCard';
import { AttendanceCalendar } from '../components/attendance/AttendanceCalendar';
import { AttendanceMarkModal } from '../components/attendance/AttendanceMarkModal';
import type { AttendanceRecord, AttendanceStatus } from '../types';
import { isAttendanceEditableDay } from '../components/attendance/attendanceUtils';

function toIsoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export default function AttendancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now);
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [markSuccess, setMarkSuccess] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    day: Date;
    record: AttendanceRecord | null;
  } | null>(null);

  const year = month.getFullYear();
  const monthNum = month.getMonth() + 1;

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'me', year, monthNum],
    queryFn: () => attendanceApi.me({ year, month: monthNum }).then((r) => r.data.data),
  });

  useEffect(() => {
    if (data && !data.today_record && !markSuccess && !editTarget) {
      setShowTodayModal(true);
    }
  }, [data, markSuccess, editTarget]);

  const markMutation = useMutation({
    mutationFn: ({ status, date }: { status: AttendanceStatus; date?: string }) =>
      attendanceApi.mark(status, date).then((r) => r.data.data),
    onSuccess: (_record, vars) => {
      const forToday = !vars.date || vars.date === (data?.today ?? toIsoDate(new Date()));
      setMarkSuccess(true);
      toast.success(forToday ? 'Attendance saved — See you today' : 'Attendance saved');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setTimeout(() => {
        setMarkSuccess(false);
        setShowTodayModal(false);
        setEditTarget(null);
      }, 1000);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Could not save attendance';
      toast.error(typeof msg === 'string' ? msg : 'Could not save attendance');
    },
  });

  const weekStart = data?.today
    ? startOfWeek(parseISO(data.today), { weekStartsOn: 1 })
    : startOfWeek(now, { weekStartsOn: 1 });

  const openDayEditor = (day: Date, record: AttendanceRecord | null) => {
    if (!isAttendanceEditableDay(day)) {
      toast.info('You can only mark or edit today and yesterday.');
      return;
    }
    if (isToday(day)) {
      setEditTarget(null);
      setShowTodayModal(true);
      return;
    }
    setShowTodayModal(false);
    setEditTarget({ day, record });
  };

  return (
    <div
      className="w-full h-[calc(100dvh-5.25rem)] flex flex-col gap-3 overflow-hidden max-md:h-auto max-md:overflow-visible"
      data-testid="attendance-page"
    >
      <header className="shrink-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">Attendance</h1>
          <p className="text-xs text-text-muted mt-0.5 truncate">
            Mark or edit today and yesterday only.
          </p>
        </div>
        {canAccessAttendanceHr(user) && (
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/attendance/hr" data-testid="link-attendance-hr">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">HR overview</span>
              </Button>
            </Link>
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 md:grid-rows-[minmax(0,0.9fr)_minmax(0,1.15fr)] gap-3 max-md:grid-rows-none max-md:auto-rows-min">
        <div className="md:col-span-5 min-h-0 max-md:min-h-[8.5rem]">
          <AttendanceTodayHero
            todayRecord={data?.today_record}
            showMarkModal={showTodayModal && !editTarget}
            markSuccess={markSuccess && !editTarget}
            marking={markMutation.isPending}
            onMark={(status) => markMutation.mutate({ status })}
            onOpenMark={() => {
              setEditTarget(null);
              setShowTodayModal(true);
            }}
            onCloseMark={() => setShowTodayModal(false)}
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
            onMonthChange={setMonth}
            onSelect={(day, record) => openDayEditor(day, record)}
            loading={isLoading}
          />
        </div>
      </div>

      <AttendanceMarkModal
        open={!!editTarget || (markSuccess && !!editTarget)}
        loading={markMutation.isPending}
        success={markSuccess && !!editTarget}
        date={editTarget?.day}
        currentStatus={editTarget?.record?.status}
        isEdit={!!editTarget?.record}
        onSelect={(status) =>
          editTarget &&
          markMutation.mutate({ status, date: toIsoDate(editTarget.day) })
        }
        onClose={() => setEditTarget(null)}
      />
    </div>
  );
}
