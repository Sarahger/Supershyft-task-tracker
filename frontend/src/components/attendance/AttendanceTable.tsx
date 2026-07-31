import { format, parseISO } from 'date-fns';
import type { AttendanceRecord } from '../../types';
import { AttendanceStatusDot } from './AttendanceStatusDot';
import { formatRecordedTime, statusLabel } from './attendanceUtils';
import { EmptyState } from '../ui/Skeleton';
import { Avatar } from '../ui/Avatar';

interface Props {
  records: AttendanceRecord[];
  loading?: boolean;
  showEmployee?: boolean;
  onSelect?: (record: AttendanceRecord) => void;
  onSelectUser?: (userId: number) => void;
}

export function AttendanceTable({
  records,
  loading,
  showEmployee = false,
  onSelect,
  onSelectUser,
}: Props) {
  if (loading) {
    return (
      <div className="task-table animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 border-b border-dark-border bg-dark-muted/40" />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="card py-4">
        <EmptyState
          title="No attendance found for this month."
          description="Mark your attendance from the Attendance home page."
        />
      </div>
    );
  }

  return (
    <div className="task-table" data-testid="hr-attendance-table">
      <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 task-table-header">
            <tr className="text-left text-2xs uppercase tracking-wider text-text-muted">
              {showEmployee && <th className="px-4 py-2.5 font-medium">Employee</th>}
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Day</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const d = parseISO(r.attendance_date);
              const name = r.user
                ? `${r.user.first_name} ${r.user.last_name}`.trim()
                : null;
              return (
                <tr
                  key={r.id}
                  className="border-b border-dark-border/60 hover:bg-dark-hover cursor-pointer transition-colors duration-hover last:border-0"
                  onClick={() => {
                    if (onSelectUser && r.user_id) onSelectUser(r.user_id);
                    else onSelect?.(r);
                  }}
                >
                  {showEmployee && (
                    <td className="px-4 py-2.5">
                      {name ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={name} src={r.user?.profile_picture} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-text-primary text-xs font-medium">{name}</p>
                            <p className="truncate text-2xs text-text-muted">
                              {(r.user?.departments || []).join(', ') || '—'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  )}
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
