import { format, parseISO } from 'date-fns';
import type { AttendanceWeek } from '../../types';
import { AttendanceStatusDot } from './AttendanceStatusDot';
import { statusLabel } from './attendanceUtils';
import { Avatar } from '../ui/Avatar';

interface Props {
  week: AttendanceWeek | undefined;
  loading?: boolean;
  onSelectUser: (userId: number) => void;
}

/** Monday–Saturday only (indices 0–5 of Mon-based week). */
const WORK_DAY_COUNT = 6;

export function AttendanceHrWeekTable({ week, loading, onSelectUser }: Props) {
  if (loading || !week) {
    return (
      <div className="task-table p-4 animate-pulse space-y-2" data-testid="hr-week-table">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-dark-muted rounded" />
        ))}
      </div>
    );
  }

  const sampleDays = (week.rows[0]?.days ?? []).slice(0, WORK_DAY_COUNT);
  const dayHeaders =
    sampleDays.length > 0
      ? sampleDays.map((d) => ({
          key: d.date,
          label: format(parseISO(d.date), 'EEE'),
          dateLabel: format(parseISO(d.date), 'd'),
        }))
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, i) => ({
          key: String(i),
          label,
          dateLabel: '',
        }));

  return (
    <div className="task-table" data-testid="hr-week-table">
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full text-sm border-collapse">
          <thead className="task-table-header">
            <tr className="text-2xs uppercase tracking-wider text-text-muted">
              <th className="sticky left-0 z-10 task-table-header px-3 py-2.5 text-left font-medium min-w-[140px]">
                Employee
              </th>
              {dayHeaders.map((d) => (
                <th key={d.key} className="px-1.5 py-2.5 text-center font-medium min-w-[44px]">
                  <span className="block">{d.label}</span>
                  {d.dateLabel ? (
                    <span className="block text-text-muted font-normal normal-case tracking-normal">
                      {d.dateLabel}
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.rows.map((row) => {
              const name = `${row.user.first_name} ${row.user.last_name}`.trim();
              const days = row.days.slice(0, WORK_DAY_COUNT);
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
                  {days.map((cell) => (
                    <td key={cell.date} className="px-1.5 py-2 text-center">
                      <span
                        className="inline-flex justify-center"
                        title={
                          cell.status
                            ? `${statusLabel(cell.status)}${cell.recorded_at ? ` · ${format(parseISO(cell.recorded_at), 'h:mm a')}` : ''}`
                            : 'Not marked'
                        }
                      >
                        <AttendanceStatusDot status={cell.status} recordedAt={cell.recorded_at} size="md" />
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
            {week.rows.length === 0 && (
              <tr>
                <td colSpan={1 + WORK_DAY_COUNT} className="px-4 py-8 text-center text-sm text-text-muted">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
