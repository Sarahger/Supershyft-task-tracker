import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, isAfter, startOfDay, startOfWeek, addDays } from 'date-fns';
import { CalendarDays, Download, X } from 'lucide-react';
import clsx from 'clsx';
import { attendanceApi } from '../services/endpoints';
import { AttendanceHrStats, ATTENDANCE_HR_STAT_LABELS } from '../components/attendance/AttendanceHrStats';
import { AttendanceHrPeopleModal } from '../components/attendance/AttendanceHrPeopleModal';
import { AttendanceHrDayTable } from '../components/attendance/AttendanceHrDayTable';
import { AttendanceHrWeekTable } from '../components/attendance/AttendanceHrWeekTable';
import { AttendanceEmployeeDrawer } from '../components/attendance/AttendanceEmployeeDrawer';
import { AttendanceCalendar } from '../components/attendance/AttendanceCalendar';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import type { AttendanceTodayStatKey } from '../types';

function toIsoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export default function AttendanceHrPage() {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(() => startOfDay(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [view, setView] = useState<'day' | 'week'>('day');
  const [drawerUserId, setDrawerUserId] = useState<number | null>(null);
  const [statKey, setStatKey] = useState<AttendanceTodayStatKey | null>(null);
  const [exporting, setExporting] = useState(false);

  const dayIso = toIsoDate(selectedDay);
  const weekStart = startOfWeek(selectedDay, { weekStartsOn: 1 });
  const weekStartIso = toIsoDate(weekStart);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'day', dayIso],
    queryFn: () => attendanceApi.day({ day: dayIso }).then((r) => r.data.data),
  });

  const { data: weekData, isLoading: weekLoading } = useQuery({
    queryKey: ['attendance', 'week', weekStartIso],
    queryFn: () => attendanceApi.week({ week_start: weekStartIso }).then((r) => r.data.data),
    enabled: view === 'week',
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await attendanceApi.exportCsv({
        year: selectedDay.getFullYear(),
        month: selectedDay.getMonth() + 1,
        status: 'ALL',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'attendance_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const pickDay = (day: Date) => {
    if (isAfter(startOfDay(day), startOfDay(new Date()))) {
      toast.info('Future dates are not available.');
      return;
    }
    setSelectedDay(startOfDay(day));
    setCalendarOpen(false);
    setStatKey(null);
  };

  const people = (statKey && data?.stats?.people?.[statKey]) || [];
  const peopleTitle = statKey
    ? `${ATTENDANCE_HR_STAT_LABELS[statKey]} · ${people.length}`
    : '';
  const dayLabel = format(selectedDay, 'EEE, MMM d');
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 5), 'MMM d')}`;

  return (
    <div className="w-full pb-12" data-testid="attendance-hr-page">
      <PageHeader
        title="Attendance — HR"
        subtitle="Daily and weekly organization overview."
        onMobileBack={() => navigate('/attendance')}
        action={
          <Button
            variant="secondary"
            loading={exporting}
            onClick={handleExport}
            data-testid="export-csv"
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        }
      />

      <AttendanceHrStats
        stats={data?.stats}
        loading={isLoading}
        activeKey={statKey}
        onSelect={setStatKey}
      />

      <div className="sticky top-0 z-20 mt-6 mb-4 py-3 bg-dark-bg border-b border-dark-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-secondary">
              {view === 'day' ? 'Day' : 'Week'}
            </p>
            <p className="text-sm font-semibold text-text-primary truncate" data-testid="hr-selected-day">
              {view === 'day' ? dayLabel : weekLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex rounded-lg border border-dark-border overflow-hidden bg-dark-card">
              <button
                type="button"
                onClick={() => setView('day')}
                data-testid="hr-view-day"
                className={clsx(
                  'px-3 py-2 text-xs font-medium min-h-[36px] transition-colors duration-hover',
                  view === 'day'
                    ? 'bg-surface-highlight text-text-primary'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => setView('week')}
                data-testid="hr-view-week"
                className={clsx(
                  'px-3 py-2 text-xs font-medium min-h-[36px] transition-colors duration-hover',
                  view === 'week'
                    ? 'bg-surface-highlight text-text-primary'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                Week
              </button>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setCalendarMonth(selectedDay);
                setCalendarOpen(true);
              }}
              data-testid="hr-open-calendar"
              aria-label={view === 'day' ? 'Pick a day' : 'Pick a week'}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{view === 'day' ? 'Change day' : 'Change week'}</span>
            </Button>
          </div>
        </div>
      </div>

      <section className="workspace-section !mb-0">
        <h2 className="workspace-section-title">
          Attendance · {view === 'day' ? dayLabel : weekLabel}
        </h2>
        {view === 'day' ? (
          <AttendanceHrDayTable
            rows={data?.rows ?? []}
            loading={isLoading}
            onSelectUser={setDrawerUserId}
          />
        ) : (
          <AttendanceHrWeekTable
            week={weekData}
            loading={weekLoading}
            onSelectUser={setDrawerUserId}
          />
        )}
      </section>

      {calendarOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="fixed inset-0 bg-[var(--overlay-backdrop)]"
            onClick={() => setCalendarOpen(false)}
          />
          <div
            className={clsx(
              'relative w-full sm:max-w-md bg-dark-card border border-dark-border',
              'rounded-t-2xl sm:rounded-2xl max-h-[min(90dvh,640px)] overflow-y-auto',
              'pb-[env(safe-area-inset-bottom,0px)]',
            )}
            role="dialog"
            aria-modal="true"
            aria-label={view === 'day' ? 'Select day' : 'Select week'}
            data-testid="hr-calendar-popup"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
              <h2 className="text-base font-semibold text-text-primary">
                {view === 'day' ? 'Select day' : 'Select a day in the week'}
              </h2>
              <button
                type="button"
                onClick={() => setCalendarOpen(false)}
                className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              <AttendanceCalendar
                month={calendarMonth}
                records={[]}
                selected={selectedDay}
                onMonthChange={setCalendarMonth}
                onSelect={(day) => pickDay(day)}
              />
            </div>
          </div>
        </div>
      )}

      <AttendanceHrPeopleModal
        open={!!statKey}
        title={peopleTitle}
        people={people}
        onClose={() => setStatKey(null)}
        onSelectUser={setDrawerUserId}
      />

      <AttendanceEmployeeDrawer userId={drawerUserId} onClose={() => setDrawerUserId(null)} />
    </div>
  );
}
