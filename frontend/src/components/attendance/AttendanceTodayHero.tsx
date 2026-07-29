import clsx from 'clsx';
import type { AttendanceRecord } from '../../types';
import { formatRecordedTime, statusBadgeClass, statusShort } from './attendanceUtils';
import { AttendanceMarkModal } from './AttendanceMarkModal';
import type { AttendanceStatus } from '../../types';

interface Props {
  todayRecord: AttendanceRecord | null | undefined;
  showMarkModal: boolean;
  markSuccess: boolean;
  marking: boolean;
  onMark: (status: AttendanceStatus) => void;
  loading?: boolean;
}

export function AttendanceTodayHero({
  todayRecord,
  showMarkModal,
  markSuccess,
  marking,
  onMark,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-dark-border bg-dark-card p-6 animate-pulse">
        <div className="h-5 w-40 bg-dark-muted rounded mb-3" />
        <div className="h-10 w-28 bg-dark-muted rounded" />
      </div>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-dark-border bg-dark-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Attendance Today</h2>
        {todayRecord ? (
          <div data-testid="attendance-submitted">
            <p className="text-sm text-text-muted mb-3">Today&apos;s Attendance</p>
            <span
              className={clsx(
                'inline-flex items-center rounded-xl border px-4 py-2 text-2xl font-semibold',
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
          <div>
            <p className="text-sm text-text-muted mb-2">You haven&apos;t marked attendance yet.</p>
            <p className="text-xs text-text-muted">The prompt will appear so you can mark in one tap.</p>
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
