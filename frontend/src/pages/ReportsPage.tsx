import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, endOfMonth, endOfQuarter, format, startOfMonth, startOfQuarter } from 'date-fns';
import clsx from 'clsx';
import { reportsApi, departmentsApi } from '../services/endpoints';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { canAccessManagerFeatures } from '../lib/roles';
import { mondayOf } from '../lib/weeklyPlanParse';
import { OverviewCharts } from '../components/reports/OverviewCharts';
import { EvaluationsPanel } from '../components/reports/EvaluationsPanel';
import type { ReportAssigneeStats } from '../types';

function WorkloadBar({ person }: { person: ReportAssigneeStats }) {
  const total = person.pending || 1;
  const segments = [
    { value: person.overdue, color: '#ef4444', label: 'Overdue' },
    { value: person.blocked, color: '#fb923c', label: 'Blocked' },
    { value: person.in_progress, color: '#fbbf24', label: 'In progress' },
    {
      value: Math.max(0, person.pending - person.overdue - person.blocked - person.in_progress),
      color: '#60a5fa',
      label: 'Other pending',
    },
  ].filter((s) => s.value > 0);

  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-dark-muted min-w-[80px]" title={`${person.pending} pending tasks`}>
      {segments.map((seg) => (
        <div
          key={seg.label}
          style={{ width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color }}
        />
      ))}
    </div>
  );
}

function PersonWorkloadTable({ people }: { people: ReportAssigneeStats[] }) {
  if (!people.length) {
    return <p className="text-sm text-text-muted py-8 text-center">No assigned tasks yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dark-border text-left">
            <th className="px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider">Person</th>
            <th className="px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center">Pending</th>
            <th className="px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center">In progress</th>
            <th className="px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center">Overdue</th>
            <th className="px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center">Blocked</th>
            <th className="px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center">Due this week</th>
            <th className="px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center">Done</th>
            <th className="px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider min-w-[120px]">Load</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.user_id} className="border-b border-dark-border hover:bg-dark-hover transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3 min-w-[160px]">
                  <Avatar name={person.name} size="sm" />
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary truncate">{person.name}</p>
                    <p className="text-xs text-text-muted truncate">
                      {person.departments?.length ? person.departments.join(', ') : 'No department'}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-center">
                <span className={clsx('font-semibold tabular-nums', person.pending > 0 ? 'metric-sky-strong' : 'text-text-muted')}>
                  {person.pending}
                </span>
              </td>
              <td className="px-3 py-3 text-center tabular-nums metric-amber-strong">{person.in_progress}</td>
              <td className="px-3 py-3 text-center">
                <span className={clsx('tabular-nums font-medium', person.overdue > 0 ? 'metric-red' : 'text-text-muted')}>
                  {person.overdue}
                </span>
              </td>
              <td className="px-3 py-3 text-center tabular-nums metric-orange-strong">{person.blocked}</td>
              <td className="px-3 py-3 text-center tabular-nums metric-purple-strong">{person.due_this_week}</td>
              <td className="px-3 py-3 text-center tabular-nums metric-emerald-strong">{person.completed}</td>
              <td className="px-4 py-3">
                <WorkloadBar person={person} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ReportTab = 'overview' | 'evaluations';
type PeriodPreset = 'week' | 'month' | 'quarter' | 'custom';

function iso(day: Date) {
  return format(day, 'yyyy-MM-dd');
}

export default function ReportsPage() {
  const { user } = useAuth();
  const isManager = canAccessManagerFeatures(user);
  const [tab, setTab] = useState<ReportTab>('overview');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [period, setPeriod] = useState<PeriodPreset>('month');
  const [customStart, setCustomStart] = useState(iso(startOfMonth(new Date())));
  const [customEnd, setCustomEnd] = useState(iso(endOfMonth(new Date())));
  const [openEvaluationId, setOpenEvaluationId] = useState<number | null>(null);
  const clearOpenedEvaluation = useCallback(() => setOpenEvaluationId(null), []);

  const reportFilters = useMemo(
    () => ({ department_id: departmentFilter ? Number(departmentFilter) : undefined }),
    [departmentFilter],
  );
  const departmentId = departmentFilter ? Number(departmentFilter) : undefined;

  const range = useMemo(() => {
    const now = new Date();
    if (period === 'week') {
      const start = mondayOf(now);
      return { start: iso(start), end: iso(addDays(start, 6)) };
    }
    if (period === 'quarter') {
      return { start: iso(startOfQuarter(now)), end: iso(endOfQuarter(now)) };
    }
    if (period === 'custom') {
      return { start: customStart, end: customEnd || customStart };
    }
    return { start: iso(startOfMonth(now)), end: iso(endOfMonth(now)) };
  }, [period, customStart, customEnd]);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', reportFilters],
    queryFn: () => reportsApi.tasks(reportFilters).then((r) => r.data.data),
    enabled: isManager,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
    enabled: isManager,
  });

  const handleExport = async () => {
    try {
      const response = await reportsApi.exportCsv(reportFilters);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tasks_report.csv';
      a.click();
      toast.success('Report exported');
    } catch {
      toast.error('Export failed');
    }
  };

  if (!isManager) {
    return (
      <div className="max-w-workspace mx-auto pb-12">
        <PageHeader title="Reports" subtitle="Reports are available to managers and admins." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-workspace mx-auto pb-12 space-y-4">
        <div className="animate-pulse h-10 w-48 bg-dark-muted rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-72 bg-dark-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-workspace mx-auto pb-12 space-y-8">
      <PageHeader
        title="Reports"
        subtitle="See who has work pending, what needs attention, and how the team is progressing"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {departments && departments.length > 0 && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="input py-1.5 text-sm w-auto"
                aria-label="Filter by department"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            {tab === 'overview' && (
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodPreset)}
                className="input py-1.5 text-sm w-auto"
                aria-label="Reporting period"
              >
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="quarter">This quarter</option>
                <option value="custom">Custom range</option>
              </select>
            )}
            {tab === 'overview' && period === 'custom' && (
              <>
                <input type="date" className="input py-1.5 text-sm w-auto" value={customStart} onChange={(e) => setCustomStart(e.target.value)} aria-label="Start date" />
                <input type="date" className="input py-1.5 text-sm w-auto" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} aria-label="End date" />
              </>
            )}
            <Button variant="secondary" onClick={handleExport}>Export CSV</Button>
          </div>
        }
      />

      <div className="flex gap-2 border-b border-dark-border">
        {([
          ['overview', 'Overview'],
          ['evaluations', 'Evaluations'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx(
              'px-3 py-2 text-sm border-b-2 -mb-px',
              tab === id ? 'border-accent-primary text-text-primary' : 'border-transparent text-text-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
          <OverviewCharts
            departmentId={departmentId}
            start={range.start}
            end={range.end}
            onOpenEvaluation={(id) => {
              setOpenEvaluationId(id);
              setTab('evaluations');
            }}
          />
          <section className="card overflow-hidden">
            <div className="px-6 py-5 border-b border-dark-border">
              <h2 className="text-sm font-medium text-text-primary">Workload by person</h2>
              <p className="text-xs text-text-muted mt-1">
                Pending tasks per team member — sorted by who has the most open work
              </p>
            </div>
            <PersonWorkloadTable people={data?.by_assignee ?? []} />
          </section>
        </>
      ) : (
        <EvaluationsPanel
          departmentId={departmentId}
          initialEvaluationId={openEvaluationId}
          onConsumedInitial={clearOpenedEvaluation}
        />
      )}
    </div>
  );
}
