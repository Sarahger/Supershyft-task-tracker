import type { AttendanceDayRow } from '../../types';
import { AttendanceStatusDot } from './AttendanceStatusDot';
import { formatRecordedTime, statusLabel } from './attendanceUtils';
import { EmptyState } from '../ui/Skeleton';
import { Avatar } from '../ui/Avatar';

interface Props {
  rows: AttendanceDayRow[];
  loading?: boolean;
  onSelectUser?: (userId: number) => void;
}

export function AttendanceHrDayTable({ rows, loading, onSelectUser }: Props) {
  if (loading) {
    return (
      <div className="task-table animate-pulse" data-testid="hr-attendance-table">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 border-b border-dark-border bg-dark-muted/40" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card py-4" data-testid="hr-attendance-table">
        <EmptyState title="No employees found." description="Active employees will appear here." />
      </div>
    );
  }

  return (
    <div className="task-table" data-testid="hr-attendance-table">
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full text-sm">
          <thead className="task-table-header">
            <tr className="text-left text-2xs uppercase tracking-wider text-text-muted">
              <th className="px-4 py-2.5 font-medium">Employee</th>
              <th className="px-4 py-2.5 font-medium">Attendance</th>
              <th className="px-4 py-2.5 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const name = `${row.user.first_name} ${row.user.last_name}`.trim();
              return (
                <tr
                  key={row.user.id}
                  className="border-b border-dark-border/60 hover:bg-dark-hover cursor-pointer transition-colors duration-hover last:border-0"
                  onClick={() => onSelectUser?.(row.user.id)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={name} src={row.user.profile_picture} size="sm" />
                      <span className="truncate text-text-primary text-xs font-medium">{name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <AttendanceStatusDot status={row.status} showLabel recordedAt={row.recorded_at} />
                    <span className="sr-only">{statusLabel(row.status)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-text-muted tabular-nums">
                    {row.recorded_at ? formatRecordedTime(row.recorded_at) : '—'}
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
