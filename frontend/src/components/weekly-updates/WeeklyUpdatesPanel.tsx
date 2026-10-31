import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { departmentsApi, weeklyUpdatesApi } from '../../services/endpoints';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState, Skeleton } from '../ui/Skeleton';
import { EmployeeProfileStrip } from './EmployeeProfileStrip';
import { LegacyDailyNotes } from './LegacyDailyNotes';
import { OverdueRevisionModal } from './OverdueRevisionModal';
import { SubmitWeeklyUpdateForm } from './SubmitWeeklyUpdateForm';
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

  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ['weekly-updates', 'employees', params],
    queryFn: () => weeklyUpdatesApi.employees(params).then((r) => r.data.data),
  });

  const employees = employeesData?.items ?? [];

  useEffect(() => {
    if (!employees.length) return;
    if (selectedUserId && employees.some((e) => e.id === selectedUserId)) return;
    const preferred = employees.find((e) => e.id === user?.id) ?? employees[0];
    setSelectedUserId(preferred.id);
  }, [employees, selectedUserId, user?.id]);

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
  const weekEnd = format(addDays(parseISO(weekStart), 6), 'MMMM d, yyyy');
  const weekLabel = `${format(parseISO(weekStart), 'MMMM d')} – ${weekEnd}`;

  const jumpToWeek = (value: string) => {
    if (!value) return;
    const monday = isoMonday(parseISO(value));
    setWeekStart(monday);
    requestAnimationFrame(() => {
      document.getElementById(`week-${monday}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const author = selected
    ? {
        id: selected.id,
        first_name: selected.first_name,
        last_name: selected.last_name,
        profile_picture: selected.profile_picture,
      }
    : history?.user ?? null;

  return (
    <div className="flex flex-col gap-4 md:h-full md:min-h-0">
      <header className="shrink-0">
        <h1 className="text-xl font-semibold text-text-primary">Weekly Updates</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Share last week and next week. Use @name to tag someone.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)] md:flex-1 md:min-h-0">
        <aside className="space-y-3 md:overflow-y-auto min-w-0">
          <div className="rounded-2xl border border-dark-border bg-dark-card p-3 sm:p-4 space-y-3">
            <label className="block">
              <span className="block text-2xs uppercase tracking-wider text-text-muted mb-1.5">Department</span>
              <select
                className="input w-full text-sm"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">All Departments</option>
                {(departments ?? []).map((d: { id: number; name: string }) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-2xs uppercase tracking-wider text-text-muted mb-1.5">Jump to week</span>
              <input
                type="date"
                className="input w-full text-sm"
                value={weekStart}
                onChange={(e) => jumpToWeek(e.target.value)}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-dark-border bg-dark-card p-3 sm:p-4">
            <p className="text-2xs uppercase tracking-wider text-text-muted mb-2">People</p>
            {employeesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <EmployeeProfileStrip
                employees={employees}
                selectedId={selectedUserId}
                onSelect={(id) => {
                  setSelectedUserId(id);
                  setWriting(false);
                }}
              />
            )}
          </div>
        </aside>

        <section className="min-h-[280px] min-w-0 space-y-4 md:overflow-y-auto">
          {isOwn && canWrite && !writing && !currentReport && (
            <div className="rounded-2xl border border-dark-border bg-dark-card px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted">Week of</p>
                <h3 className="text-sm font-semibold text-text-primary mt-0.5">{weekLabel}</h3>
              </div>
              <button
                type="button"
                onClick={() => setWriting(true)}
                className="text-sm text-accent-primary hover:underline"
              >
                Write
              </button>
            </div>
          )}

          {writing && isOwn && (
            <div className="rounded-2xl border border-dark-border bg-dark-card p-5 sm:p-6">
              <SubmitWeeklyUpdateForm
                periodStart={writePeriod}
                existing={currentReport}
                onClose={() => setWriting(false)}
              />
            </div>
          )}

          {historyLoading && <Skeleton className="h-48 w-full" />}
          {historyError && (
            <EmptyState title="Could not load weekly updates" description="Try again in a moment." />
          )}
          {!historyLoading && history && history.reports.length === 0 && !writing && (
            <div className="rounded-2xl border border-dark-border bg-dark-card p-5">
              <p className="text-sm text-text-muted">
                {isOwn
                  ? 'No weekly update yet — write one when you are ready.'
                  : `${selected?.first_name ?? 'This person'} has no weekly updates yet.`}
              </p>
            </div>
          )}

          {history?.reports
            .filter((report) => !(writing && report.period_start === writePeriod))
            .map((report) => (
            <WeeklyReportCard
              key={report.id}
              report={report}
              author={author}
              onEdit={isOwn && canWrite && !writing && report.period_start === writePeriod
                ? () => setWriting(true)
                : undefined}
              actionLabel={report.status === 'draft' && report.commitments.length === 0 ? 'Write next week' : 'Edit'}
              onRevise={isOwn ? setReviseItem : undefined}
            />
          ))}

          {history && <LegacyDailyNotes notes={history.legacy_daily_notes} />}
        </section>
      </div>

      <OverdueRevisionModal item={reviseItem} onClose={() => setReviseItem(null)} />
    </div>
  );
}
