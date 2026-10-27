import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { departmentsApi, weeklyUpdatesApi } from '../../services/endpoints';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState, Skeleton } from '../ui/Skeleton';
import { Button } from '../ui/Button';
import { EmployeeProfileStrip } from './EmployeeProfileStrip';
import { LegacyDailyNotes } from './LegacyDailyNotes';
import { OverdueRevisionModal } from './OverdueRevisionModal';
import { SubmitWeeklyUpdateForm } from './SubmitWeeklyUpdateForm';
import { WeeklyOverviewStats, type OverviewFilter } from './WeeklyOverviewStats';
import { WeeklyReportCard } from './WeeklyReportCard';
import { mondayOf } from '../../lib/weeklyPlanParse';
import type { WeeklyCommitment } from '../../types';

function isoMonday(day: Date = new Date()) {
  return format(mondayOf(day), 'yyyy-MM-dd');
}

export function WeeklyUpdatesPanel() {
  const { user } = useAuth();
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [weekStart, setWeekStart] = useState(isoMonday());
  const [selectedUserId, setSelectedUserId] = useState<number | null>(user?.id ?? null);
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>('all');
  const [writing, setWriting] = useState(false);
  const [reviseItem, setReviseItem] = useState<WeeklyCommitment | null>(null);

  const params = {
    week_start: weekStart,
    ...(departmentId !== '' ? { department_id: Number(departmentId) } : {}),
  };

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['weekly-updates', 'overview', params],
    queryFn: () => weeklyUpdatesApi.overview(params).then((r) => r.data.data),
  });

  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ['weekly-updates', 'employees', params],
    queryFn: () => weeklyUpdatesApi.employees(params).then((r) => r.data.data),
  });

  const employees = employeesData?.items ?? [];

  const visibleEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (overviewFilter === 'submitted') return emp.has_submitted;
      if (overviewFilter === 'pending') return !emp.has_submitted;
      if (overviewFilter === 'overdue' || overviewFilter === 'carried_forward') return emp.has_overdue;
      return true;
    });
  }, [employees, overviewFilter]);

  useEffect(() => {
    if (!visibleEmployees.length) return;
    if (selectedUserId && visibleEmployees.some((e) => e.id === selectedUserId)) return;
    const preferred = visibleEmployees.find((e) => e.id === user?.id) ?? visibleEmployees[0];
    setSelectedUserId(preferred.id);
  }, [visibleEmployees, selectedUserId, user?.id]);

  const { data: history, isLoading: historyLoading, isError: historyError } = useQuery({
    queryKey: ['weekly-updates', 'user', selectedUserId, weekStart],
    queryFn: () => weeklyUpdatesApi.userHistory(selectedUserId!, weekStart).then((r) => r.data.data),
    enabled: selectedUserId != null,
  });

  useEffect(() => {
    if (!history?.focus_week) return;
    const el = document.getElementById(`week-${history.focus_week}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [history?.focus_week, selectedUserId]);

  const selected = employees.find((e) => e.id === selectedUserId);
  const isOwn = selectedUserId === user?.id;
  const currentPeriod = history?.current_period_start ?? weekStart;
  const writePeriod = weekStart <= currentPeriod ? weekStart : currentPeriod;
  const currentReport = history?.reports.find((r) => r.period_start === writePeriod);
  const canWrite = isOwn && (!currentReport || currentReport.editable);

  const jumpToWeek = (value: string) => {
    if (!value) return;
    const monday = isoMonday(parseISO(value));
    setWeekStart(monday);
    requestAnimationFrame(() => {
      document.getElementById(`week-${monday}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-text-secondary">Department</span>
            <select
              className="input min-w-[180px]"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">All Departments</option>
              {(departments ?? []).map((d: { id: number; name: string }) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block text-xs font-medium text-text-secondary">Jump to week</span>
            <input
              type="date"
              className="input"
              value={weekStart}
              onChange={(e) => jumpToWeek(e.target.value)}
            />
          </label>
        </div>
        {overviewLoading || !overview ? (
          <Skeleton className="h-8 w-72" />
        ) : (
          <WeeklyOverviewStats overview={overview} active={overviewFilter} onSelect={setOverviewFilter} />
        )}
      </div>

      {employeesLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : (
        <EmployeeProfileStrip
          employees={visibleEmployees}
          selectedId={selectedUserId}
          onSelect={(id) => {
            setSelectedUserId(id);
            setWriting(false);
          }}
        />
      )}

      {isOwn && canWrite && !writing && (
        <div className="flex justify-end">
          <Button type="button" onClick={() => setWriting(true)}>
            {currentReport ? 'Edit weekly update' : 'Write weekly update'}
          </Button>
        </div>
      )}

      {writing && isOwn && (
        <SubmitWeeklyUpdateForm
          periodStart={writePeriod}
          existing={currentReport}
          onClose={() => setWriting(false)}
        />
      )}

      {selected && history?.outstanding?.length ? (
        <section className="rounded-2xl border border-accent-danger/30 bg-dark-card px-4 py-3">
          <h3 className="text-sm font-medium text-text-primary mb-2">Outstanding and overdue</h3>
          <ul className="space-y-1">
            {history.outstanding.map((item) => (
              <li key={item.task_id ?? item.title} className="text-sm text-text-secondary flex items-center justify-between gap-2">
                <span>{item.title}</span>
                {item.is_overdue && isOwn && (
                  <button type="button" className="text-xs text-accent-primary" onClick={() => setReviseItem(item)}>
                    Revise deadline
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {historyLoading && <Skeleton className="h-48 w-full" />}
      {historyError && (
        <EmptyState title="Could not load weekly updates" description="Try again in a moment." />
      )}
      {!historyLoading && history && history.reports.length === 0 && !writing && (
        <EmptyState
          title={isOwn ? 'No weekly update yet' : `${selected?.first_name ?? 'This person'} has no weekly updates yet`}
          description={isOwn ? 'Write this week’s update when you are ready.' : 'Historical reports will appear here once they submit.'}
        />
      )}

      <div className="space-y-4">
        {history?.reports.map((report) => (
          <WeeklyReportCard
            key={report.id}
            report={report}
            onRevise={isOwn ? setReviseItem : undefined}
          />
        ))}
      </div>

      {history && <LegacyDailyNotes notes={history.legacy_daily_notes} />}

      <OverdueRevisionModal item={reviseItem} onClose={() => setReviseItem(null)} />
    </div>
  );
}
