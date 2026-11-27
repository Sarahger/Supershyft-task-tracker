import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { departmentsApi, weeklyUpdatesApi } from '../../services/endpoints';
import { useAuth } from '../../contexts/AuthContext';
import { EmptyState, Skeleton } from '../ui/Skeleton';
import { EmployeeProfileStrip } from './EmployeeProfileStrip';
import { OverdueRevisionModal } from './OverdueRevisionModal';
import { SubmitWeeklyUpdateForm } from './SubmitWeeklyUpdateForm';
import { WeeklyReportCard } from './WeeklyReportCard';
import {
  mondayOf,
  monthKeyFromDate,
  monthSelectOptions,
  weeksInMonth,
} from '../../lib/weeklyPlanParse';
import type { WeeklyCommitment } from '../../types';

function isoMonday(day: Date = new Date()) {
  return format(mondayOf(day), 'yyyy-MM-dd');
}

function monthKeyFromWeekStart(weekStartIso: string): string {
  try {
    return format(parseISO(weekStartIso), 'yyyy-MM');
  } catch {
    return monthKeyFromDate();
  }
}

export function WeeklyUpdatesPanel() {
  const { user } = useAuth();
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [weekStart, setWeekStart] = useState(isoMonday());
  const [selectedMonth, setSelectedMonth] = useState(() => monthKeyFromDate());
  const [selectedUserId, setSelectedUserId] = useState<number | null>(user?.id ?? null);
  const [writing, setWriting] = useState(false);
  const [reviseItem, setReviseItem] = useState<WeeklyCommitment | null>(null);

  const monthOptions = useMemo(() => monthSelectOptions(), []);
  const weekOptions = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return [];
    return weeksInMonth(year, monthIndex);
  }, [selectedMonth]);

  // People strip only depends on department — week/month filters reload cards only.
  const employeeParams = useMemo(
    () => (departmentId !== '' ? { department_id: Number(departmentId) } : {}),
    [departmentId],
  );

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: ['weekly-updates', 'employees', employeeParams],
    queryFn: () => weeklyUpdatesApi.employees(employeeParams).then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const employees = employeesData?.items ?? [];

  useEffect(() => {
    if (!employees.length) return;
    if (selectedUserId && employees.some((e) => e.id === selectedUserId)) return;
    const preferred = employees.find((e) => e.id === user?.id) ?? employees[0];
    setSelectedUserId(preferred.id);
  }, [employees, selectedUserId, user?.id]);

  const { data: historyData, isLoading: historyLoading, isFetching: historyFetching, isError: historyError } = useQuery({
    queryKey: ['weekly-updates', 'user', selectedUserId, weekStart],
    queryFn: () => weeklyUpdatesApi.userHistory(selectedUserId!, weekStart).then((r) => r.data.data),
    enabled: selectedUserId != null,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

  // Keep the week select valid when the month changes or weekStart is outside the month.
  useEffect(() => {
    if (!weekOptions.length) return;
    if (weekOptions.some((w) => w.monday === weekStart)) return;
    const todayMonday = isoMonday();
    const preferred =
      weekOptions.find((w) => w.monday === todayMonday)?.monday
      ?? weekOptions[0]?.monday;
    if (preferred) setWeekStart(preferred);
  }, [weekOptions, weekStart]);

  // ignore placeholder from a different week/user while the matching card loads
  const historyMatchesSelection = Boolean(
    historyData
    && historyData.user?.id === selectedUserId
    && (historyData.focus_week === weekStart
      || historyData.current_period_start === weekStart
      || historyData.reports?.some((r) => r.period_start === weekStart)),
  );
  const history = historyMatchesSelection ? historyData : undefined;
  const showHistorySkeleton =
    selectedUserId != null && ((historyLoading && !historyData) || (historyFetching && !historyMatchesSelection));

  const selected = employees.find((e) => e.id === selectedUserId);
  const isOwn = selectedUserId === user?.id;
  const writablePeriod = history?.writable_period_start ?? history?.current_period_start ?? weekStart;
  const selectedReport = history?.reports.find((r) => r.period_start === weekStart) ?? null;
  // Current week and every future week are editable (including empty drafts).
  const canWrite = Boolean(isOwn && weekStart >= writablePeriod);
  const writeWeekEndIso =
    weekStart === history?.writable_period_start && history.writable_period_end
      ? history.writable_period_end
      : weekStart === history?.current_period_start && history.current_period_end
        ? history.current_period_end
        : format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');
  const writeWeekEnd = format(parseISO(writeWeekEndIso), 'MMMM d, yyyy');
  const weekLabel = `${format(parseISO(weekStart), 'MMMM d')} – ${writeWeekEnd}`;
  const liveCurrentWeek = history?.current_week_tasks ?? history?.outstanding ?? [];
  const showUnwrittenCard = !showHistorySkeleton && isOwn && canWrite && !writing && !selectedReport;
  const showSelectedCard = !showHistorySkeleton && Boolean(selectedReport) && !(writing && selectedReport?.period_start === weekStart);

  const jumpToWeek = (mondayIso: string) => {
    if (!mondayIso) return;
    const monday = isoMonday(parseISO(mondayIso));
    setSelectedMonth(monthKeyFromWeekStart(monday));
    setWeekStart(monday);
    requestAnimationFrame(() => {
      document.getElementById(`week-${monday}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const onMonthChange = (monthValue: string) => {
    setSelectedMonth(monthValue);
    const [yearStr, monthStr] = monthValue.split('-');
    const weeks = weeksInMonth(Number(yearStr), Number(monthStr) - 1);
    if (!weeks.length) return;
    const todayMonday = isoMonday();
    const todayMonth = monthKeyFromDate();
    const nextWeek =
      monthValue === todayMonth
        ? (weeks.find((w) => w.monday === todayMonday) ?? weeks[weeks.length - 1])
        : weeks[0];
    setWeekStart(nextWeek.monday);
    requestAnimationFrame(() => {
      document.getElementById(`week-${nextWeek.monday}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          Share completed work and this week&apos;s tasks. Use @name to tag someone. Plan future weeks on those weeks.
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
              <span className="block text-2xs uppercase tracking-wider text-text-muted mb-1.5">Month</span>
              <select
                className="input w-full text-sm"
                value={selectedMonth}
                onChange={(e) => onMonthChange(e.target.value)}
              >
                {monthOptions.map((month) => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-2xs uppercase tracking-wider text-text-muted mb-1.5">Week</span>
              <select
                className="input w-full text-sm"
                value={weekOptions.some((w) => w.monday === weekStart) ? weekStart : (weekOptions[0]?.monday ?? '')}
                onChange={(e) => jumpToWeek(e.target.value)}
              >
                {weekOptions.map((week) => (
                  <option key={week.monday} value={week.monday}>{week.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-dark-border bg-dark-card p-3 sm:p-4">
            <p className="text-2xs uppercase tracking-wider text-text-muted mb-2">People</p>
            {employeesLoading && employees.length === 0 ? (
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
          {showUnwrittenCard && (
            <div className="rounded-2xl border border-dark-border bg-dark-card px-5 py-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
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
              <div className="space-y-3">
                <div>
                  <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted">Weekly Tasks</p>
                  {liveCurrentWeek.length === 0 ? (
                    <p className="text-sm text-text-muted mt-1">No tasks yet</p>
                  ) : (
                    <ol className="space-y-1 mt-1">
                      {liveCurrentWeek.map((item, i) => {
                        const carried = Boolean(item.is_carried_forward || item.commitment_type === 'carried_forward' || item.is_overdue);
                        return (
                          <li key={item.task_id ?? `${item.title}-${i}`} className="flex items-start gap-2">
                            <span className="text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5">{i + 1}.</span>
                            <p className={carried ? 'text-sm text-amber-400' : 'text-sm text-text-primary'}>
                              {item.title}
                              {item.is_overdue ? <span className="ml-2 text-2xs text-accent-danger">Overdue</span> : null}
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
                <div>
                  <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted">Completed Tasks</p>
                  <p className="text-sm text-text-muted mt-1">No tasks yet</p>
                </div>
              </div>
            </div>
          )}

          {writing && isOwn && canWrite && (
            <div className="rounded-2xl border border-dark-border bg-dark-card p-5 sm:p-6">
              <SubmitWeeklyUpdateForm
                periodStart={weekStart}
                existing={selectedReport ?? undefined}
                onClose={() => setWriting(false)}
              />
            </div>
          )}

          {showHistorySkeleton && <Skeleton className="h-48 w-full" />}
          {historyError && (
            <EmptyState title="Could not load weekly updates" description="Try again in a moment." />
          )}
          {!showHistorySkeleton && history && !showSelectedCard && !showUnwrittenCard && !writing && (
            <div className="rounded-2xl border border-dark-border bg-dark-card p-5">
              <p className="text-sm text-text-muted">
                {isOwn
                  ? 'No weekly update for this week yet.'
                  : `${selected?.first_name ?? 'This person'} has no weekly update for this week.`}
              </p>
            </div>
          )}

          {showSelectedCard && selectedReport && (() => {
            const report = selectedReport;
            // Only overlay history-level live buckets onto the writable week.
            // Earlier still-editable weeks already carry their own live sections from the API.
            const overlayWritableLive =
              report.period_start === writablePeriod || report.is_current;
            const currentIds = new Set((report.current_week_tasks ?? []).map((c) => c.task_id).filter(Boolean));
            const merged = overlayWritableLive
              ? {
                  ...report,
                  current_week_tasks: [
                    ...liveCurrentWeek.filter((c) => c.task_id && !currentIds.has(c.task_id)),
                    ...(report.current_week_tasks ?? []),
                  ],
                }
              : {
                  ...report,
                  current_week_tasks: report.current_week_tasks ?? [],
                };
            const openCount = merged.current_week_tasks?.length ?? 0;
            return (
              <WeeklyReportCard
                key={report.id}
                report={merged}
                author={author}
                onEdit={canWrite && !writing ? () => setWriting(true) : undefined}
                actionLabel={report.status === 'draft' && openCount === 0 ? 'Write update' : 'Edit'}
                onRevise={canWrite ? setReviseItem : undefined}
              />
            );
          })()}
        </section>
      </div>

      <OverdueRevisionModal item={reviseItem} onClose={() => setReviseItem(null)} />
    </div>
  );
}
