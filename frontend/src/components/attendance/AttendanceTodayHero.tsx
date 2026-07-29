import clsx from 'clsx';
import { Building2, CalendarCheck, Home, Umbrella } from 'lucide-react';
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
  loading?: boolean;
}

function StatusIcon({ status }: { status: AttendanceStatus }) {
  if (status === 'WFO') return <Building2 className="h-5 w-5" />;
  if (status === 'WFH') return <Home className="h-5 w-5" />;
  return <Umbrella className="h-5 w-5" />;
}

export function AttendanceTodayHero({
  todayRecord,
  showMarkModal,
  markSuccess,
  marking,
  onMark,
  onOpenMark,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="h-5 w-40 bg-dark-muted rounded mb-3" />
        <div className="h-10 w-28 bg-dark-muted rounded" />
      </div>
    );
  }

  return (
    <>
      <section
        className={clsx(
          'card p-5',
          todayRecord ? statusAccentBorder(todayRecord.status) : 'border-sky-500/20 bg-sky-500/5',
        )}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className={clsx(
              'p-2 rounded-lg shrink-0',
              todayRecord ? statusIconWrap(todayRecord.status) : 'bg-sky-500/10 text-sky-400',
            )}
          >
            {todayRecord ? <StatusIcon status={todayRecord.status} /> : <CalendarCheck className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-text-primary">Attendance Today</h2>
            <p className="text-sm text-text-muted mt-0.5">
              {todayRecord
                ? 'Your status for today is locked in.'
                : 'Mark once — no forms, no confirmation.'}
            </p>
          </div>
        </div>

        {todayRecord ? (
          <div data-testid="attendance-submitted">
            <span
              className={clsx(
                'chip inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold',
                statusBadgeClass(todayRecord.status),
              )}
            >
              {statusShort(todayRecord.status)}
            </span>
            <p className="mt-3 text-sm text-text-secondary">
              Recorded today at {formatRecordedTime(todayRecord.recorded_at)}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Attendance for today has already been submitted.
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-text-secondary flex-1">
              You haven&apos;t marked attendance yet.
            </p>
            {onOpenMark && (
              <Button className="gap-2 shrink-0" onClick={onOpenMark}>
                <CalendarCheck className="h-4 w-4" />
                Mark attendance
              </Button>
            )}
          </div>
        )}
      </section>

      <AttendanceMarkModal
        open={(showMarkModal && !todayRecord) || markSuccess}
        loading={marking}
        success={markSuccess}
        onSelect={onMark}
      />
    </>
  );
}
