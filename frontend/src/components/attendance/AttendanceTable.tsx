import { format, parseISO } from 'date-fns';
import type { AttendanceRecord } from '../../types';
import { AttendanceStatusDot } from './AttendanceStatusDot';
import { formatRecordedTime, statusLabel } from './attendanceUtils';
import { EmptyState } from '../ui/Skeleton';

interface Props {
  records: AttendanceRecord[];
  loading?: boolean;
  onSelect?: (record: AttendanceRecord) => void;
}

export function AttendanceTable({ records, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-dark-border bg-dark-card overflow-hidden animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 border-b border-dark-border bg-dark-muted/40" />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <EmptyState
        title="No attendance found for this month."
        description="Mark your attendance from the Attendance home page."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-dark-border bg-dark-card overflow-hidden">
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-dark-card border-b border-dark-border z-10">
            <tr className="text-left text-2xs uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Day</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const d = parseISO(r.attendance_date);
              return (
                <tr
                  key={r.id}
                  className="border-b border-dark-border/60 hover:bg-dark-hover cursor-pointer"
                  onClick={() => onSelect?.(r)}
                >
                  <td className="px-4 py-2.5 text-text-primary tabular-nums">
                    {format(d, 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{format(d, 'EEE')}</td>
                  <td className="px-4 py-2.5">
                    <AttendanceStatusDot status={r.status} showLabel recordedAt={r.recorded_at} />
                    <span className="sr-only">{statusLabel(r.status)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-text-muted tabular-nums">
                    {formatRecordedTime(r.recorded_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
