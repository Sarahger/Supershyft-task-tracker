import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, isAfter, startOfDay } from 'date-fns';
import { CalendarDays, Download, X } from 'lucide-react';
import clsx from 'clsx';
import { attendanceApi } from '../services/endpoints';
import { AttendanceHrStats, ATTENDANCE_HR_STAT_LABELS } from '../components/attendance/AttendanceHrStats';
import { AttendanceHrPeopleModal } from '../components/attendance/AttendanceHrPeopleModal';
import { AttendanceHrDayTable } from '../components/attendance/AttendanceHrDayTable';
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
  const [drawerUserId, setDrawerUserId] = useState<number | null>(null);
  const [statKey, setStatKey] = useState<AttendanceTodayStatKey | null>(null);
  const [exporting, setExporting] = useState(false);

  const dayIso = toIsoDate(selectedDay);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'day', dayIso],
    queryFn: () => attendanceApi.day({ day: dayIso }).then((r) => r.data.data),
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

  return (
    <div className="w-full pb-12" data-testid="attendance-hr-page">
      <PageHeader
        title="Attendance — HR"
        subtitle="Daily organization overview."
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
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-secondary">Day</p>
            <p className="text-sm font-semibold text-text-primary truncate" data-testid="hr-selected-day">
              {dayLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
              aria-label="Pick a day"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Change day</span>
            </Button>
          </div>
        </div>
      </div>

      <section className="workspace-section !mb-0">
        <h2 className="workspace-section-title">Attendance · {dayLabel}</h2>
        <AttendanceHrDayTable
          rows={data?.rows ?? []}
          loading={isLoading}
          onSelectUser={setDrawerUserId}
        />
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
            aria-label="Select day"
            data-testid="hr-calendar-popup"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
              <h2 className="text-base font-semibold text-text-primary">Select day</h2>
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
