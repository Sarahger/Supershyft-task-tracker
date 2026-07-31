import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isAfter, isToday, parseISO, startOfDay, startOfWeek } from 'date-fns';
import { CalendarDays, Pencil, Shield } from 'lucide-react';
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
import { formatRecordedTime, statusLabel } from '../components/attendance/attendanceUtils';

function toIsoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function isFutureDay(d: Date): boolean {
  return isAfter(startOfDay(d), startOfDay(new Date()));
}

export default function AttendancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now);
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [markSuccess, setMarkSuccess] = useState(false);
  const [selected, setSelected] = useState<{ day: Date; record: AttendanceRecord | null } | null>(null);
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
    if (isFutureDay(day)) {
      toast.info('Future dates cannot be marked.');
      return;
    }
    setSelected({ day, record });
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
            Mark or edit today and past days. Future days stay locked.
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
            selected={selected?.day}
            onMonthChange={setMonth}
            onSelect={(day, record) => openDayEditor(day, record)}
            loading={isLoading}
          />
          {selected && !isFutureDay(selected.day) && (
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
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  onClick={() => openDayEditor(selected.day, selected.record)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {selected.record ? 'Edit' : 'Mark'}
                </Button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
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
