import clsx from 'clsx';
import { Building2, CalendarCheck, Clock, Home, Pencil, Umbrella, Users } from 'lucide-react';
import type { AttendanceRecord, AttendanceStatus } from '../../types';
import {
  formatRecordedTime,
  statusAccentBorder,
  statusBadgeClass,
  statusIconWrap,
  statusShort,
} from './attendanceUtils';
import { AttendanceMarkModal } from './AttendanceMarkModal';
import { Button } from '../ui/Button';

interface Props {
  todayRecord: AttendanceRecord | null | undefined;
  showMarkModal: boolean;
  markSuccess: boolean;
  marking: boolean;
  onMark: (status: AttendanceStatus) => void;
  onOpenMark?: () => void;
  onCloseMark?: () => void;
  loading?: boolean;
}

function StatusIcon({ status }: { status: AttendanceStatus }) {
  if (status === 'WFO') return <Building2 className="h-4 w-4" />;
  if (status === 'WFH') return <Home className="h-4 w-4" />;
  if (status === 'HALF_DAY') return <Clock className="h-4 w-4" />;
  if (status === 'CAMP') return <Users className="h-4 w-4" />;
  return <Umbrella className="h-4 w-4" />;
}

export function AttendanceTodayHero({
  todayRecord,
  showMarkModal,
  markSuccess,
  marking,
  onMark,
  onOpenMark,
  onCloseMark,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="card h-full p-3 animate-pulse">
        <div className="h-4 w-32 bg-dark-muted rounded mb-2" />
        <div className="h-6 w-24 bg-dark-muted rounded" />
      </div>
    );
  }

  return (
    <>
      <section
        className={clsx(
          'card h-full min-h-0 p-3 flex flex-col gap-2',
          todayRecord ? statusAccentBorder(todayRecord.status) : 'border-sky-500/20 bg-sky-500/5',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={clsx(
              'p-1.5 rounded-lg shrink-0',
              todayRecord ? statusIconWrap(todayRecord.status) : 'bg-sky-500/10 text-sky-400',
            )}
          >
            {todayRecord ? <StatusIcon status={todayRecord.status} /> : <CalendarCheck className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-text-primary leading-tight">Attendance Today</h2>
            {!todayRecord && (
              <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
                Mark today — or tap yesterday on the calendar to edit.
              </p>
            )}
          </div>
          {todayRecord && onOpenMark && (
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 shrink-0"
              onClick={onOpenMark}
              data-testid="edit-today-attendance"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>

        {todayRecord ? (
          <div data-testid="attendance-submitted" className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={clsx(
                'chip inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-sm font-semibold',
                statusBadgeClass(todayRecord.status),
              )}
            >
              {statusShort(todayRecord.status)}
            </span>
            <p className="text-xs text-text-secondary">
              Recorded at {formatRecordedTime(todayRecord.recorded_at)}
            </p>
            {todayRecord.status === 'WFO' && (
              <p className="text-xs text-text-muted w-full sm:w-auto">
                {todayRecord.location_verified
                  ? `✓ ${todayRecord.office_name || 'Office verified'}${todayRecord.distance_from_office != null ? ` · ${Math.round(todayRecord.distance_from_office)}m` : ''}`
                  : todayRecord.location_verified === false
                    ? 'Location not verified'
                    : null}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="text-xs text-text-secondary flex-1 line-clamp-1">
              You haven&apos;t marked attendance yet.
            </p>
            {onOpenMark && (
              <Button size="sm" className="gap-1.5 shrink-0" onClick={onOpenMark}>
                <CalendarCheck className="h-3.5 w-3.5" />
                Mark attendance
              </Button>
            )}
          </div>
        )}
      </section>

      <AttendanceMarkModal
        open={showMarkModal || markSuccess}
        loading={marking}
        success={markSuccess}
        isEdit={!!todayRecord}
        currentStatus={todayRecord?.status}
        onSelect={onMark}
        onClose={onCloseMark}
      />
    </>
  );
}
