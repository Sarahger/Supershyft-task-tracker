import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { attendanceApi } from '../../services/endpoints';
import { Drawer } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Skeleton } from '../ui/Skeleton';
import { AttendanceCalendar } from './AttendanceCalendar';
import { AttendanceSummaryCard } from './AttendanceSummaryCard';
import { formatRecordedTime, statusLabel } from './attendanceUtils';
import type { AttendanceRecord } from '../../types';

interface Props {
  userId: number | null;
  onClose: () => void;
}

export function AttendanceEmployeeDrawer({ userId, onClose }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now);
  const [selected, setSelected] = useState<{ day: Date; record: AttendanceRecord | null } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'user', userId, month.getFullYear(), month.getMonth() + 1],
    queryFn: () =>
      attendanceApi
        .userDetail(userId!, { year: month.getFullYear(), month: month.getMonth() + 1 })
        .then((r) => r.data.data),
    enabled: userId != null,
  });

  return (
    <Drawer isOpen={userId != null} onClose={onClose}>
      <div className="px-6 pt-14 pb-8 space-y-6" data-testid="attendance-employee-drawer">
        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <header className="flex items-start gap-3">
              <Avatar
                name={`${data.user.first_name} ${data.user.last_name}`}
                src={data.user.profile_picture}
                size="lg"
              />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-text-primary truncate">
                  {data.user.first_name} {data.user.last_name}
                </h2>
                <p className="text-sm text-text-muted truncate">
                  {(data.user.departments || []).join(', ') || 'No department'}
                </p>
                <p className="text-xs text-text-muted capitalize mt-0.5">
                  {data.user.role || '—'}
                  {data.user.job_title ? ` · ${data.user.job_title}` : ''}
                </p>
              </div>
            </header>

            <AttendanceCalendar
              month={month}
              records={data.records}
              selected={selected?.day}
              onMonthChange={(m) => {
                setMonth(m);
                setSelected(null);
              }}
              onSelect={(day, record) => setSelected({ day, record })}
            />

            {selected && (
              <div className="card p-4 text-sm bg-surface-subtle">
                <p className="font-medium text-text-primary">{format(selected.day, 'EEEE, MMM d, yyyy')}</p>
                <p className="text-text-secondary mt-1">{statusLabel(selected.record?.status)}</p>
                {selected.record?.recorded_at && (
                  <p className="text-text-muted text-xs mt-0.5">
                    Recorded at {formatRecordedTime(selected.record.recorded_at)}
                  </p>
                )}
              </div>
            )}

            <AttendanceSummaryCard summary={data.summary} />

            <div className="card p-4 flex justify-between text-sm bg-surface-subtle">
              <span className="text-text-muted">Late Count</span>
              <span className="tabular-nums text-text-secondary">{data.summary.late_count}</span>
            </div>

            {data.records.length === 0 && (
              <p className="text-sm text-text-muted text-center">
                No attendance found for {format(month, 'MMMM yyyy')}.
              </p>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
