import { format, parseISO } from 'date-fns';
import type { AttendanceWeek } from '../../types';
import { AttendanceStatusDot } from './AttendanceStatusDot';
import { statusLabel } from './attendanceUtils';
import { Avatar } from '../ui/Avatar';

interface Props {
  week: AttendanceWeek | undefined;
  loading?: boolean;
  onSelectUser: (userId: number) => void;
  search?: string;
}

export function AttendanceHrWeekTable({ week, loading, onSelectUser, search = '' }: Props) {
  const q = search.trim().toLowerCase();

  if (loading || !week) {
    return (
      <div className="task-table p-4 animate-pulse space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-dark-muted rounded" />
        ))}
      </div>
    );
  }

  const rows = week.rows.filter((row) => {
    if (!q) return true;
    const name = `${row.user.first_name} ${row.user.last_name}`.toLowerCase();
    const depts = (row.user.departments || []).join(' ').toLowerCase();
    return name.includes(q) || depts.includes(q);
  });

  const dayHeaders = week.rows[0]?.days.map((d) => format(parseISO(d.date), 'EEE')) ?? [
    'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
  ];

  return (
    <div className="task-table" data-testid="hr-week-table">
      <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-20 task-table-header">
            <tr className="text-2xs uppercase tracking-wider text-text-muted">
              <th className="sticky left-0 z-30 task-table-header px-3 py-2.5 text-left font-medium min-w-[160px]">
                Employee
              </th>
              <th className="px-2 py-2.5 text-left font-medium min-w-[100px]">Department</th>
              {dayHeaders.map((d) => (
                <th key={d} className="px-2 py-2.5 text-center font-medium w-12">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const name = `${row.user.first_name} ${row.user.last_name}`;
              const dept = (row.user.departments || []).join(', ') || '—';
              return (
                <tr
                  key={row.user.id}
                  className="border-b border-dark-border/50 hover:bg-dark-hover cursor-pointer transition-colors duration-hover last:border-0"
                  onClick={() => onSelectUser(row.user.id)}
                >
                  <td className="sticky left-0 z-10 bg-dark-card px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={name} src={row.user.profile_picture} size="sm" />
                      <span className="truncate text-text-primary text-xs font-medium">{name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs text-text-muted truncate max-w-[120px]">{dept}</td>
                  {row.days.map((cell) => (
                    <td key={cell.date} className="px-2 py-2 text-center">
                      <span className="inline-flex justify-center" title={statusLabel(cell.status)}>
                        <AttendanceStatusDot status={cell.status} recordedAt={cell.recorded_at} size="md" />
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-text-muted">
                  No employees match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
