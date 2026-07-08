import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  ClipboardList, CheckCircle2, Clock, Ban, Eye, TrendingUp, Users, AlertTriangle,
  PlayCircle, CalendarClock,
} from 'lucide-react';
import clsx from 'clsx';
import { reportsApi, dashboardApi, departmentsApi } from '../services/endpoints';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { canAccessManagerFeatures } from '../lib/roles';
import { useTheme } from '../contexts/ThemeContext';
import { getChartTheme } from '../lib/chartTheme';
import { STATUS_LABELS, PRIORITY_LABELS, HEALTH_LABELS } from '../types';
import type { ReportAssigneeStats } from '../types';

const STATUS_COLORS: Record<string, string> = {
  unassigned: '#94a3b8',
  backlog: '#64748b',
  to_do: '#60a5fa',
  in_progress: '#fbbf24',
  blocked: '#ef4444',
  ready_for_review: '#a78bfa',
  in_review: '#c084fc',
  changes_requested: '#fb923c',
  approved: '#34d399',
  testing: '#22d3ee',
  bugs_found: '#fb7185',
  completed: '#10b981',
  cancelled: '#71717a',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#94a3b8',
  medium: '#60a5fa',
  high: '#fbbf24',
  critical: '#ef4444',
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#34d399',
  at_risk: '#fbbf24',
  delayed: '#ef4444',
  completed: '#71717a',
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  color,
  bg,
  border,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: typeof ClipboardList;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <div className={clsx('card p-5 border', border, bg)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={clsx('text-3xl font-semibold tabular-nums', color)}>{value}</p>
          <p className="text-sm text-text-primary mt-1 font-medium">{label}</p>
          {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
        </div>
        <div className={clsx('p-2.5 rounded-lg', bg)}>
          <Icon className={clsx('h-5 w-5', color)} />
        </div>
      </div>
    </div>
  );
}

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

export default function ReportsPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const chartTheme = getChartTheme(theme);
  const isManager = canAccessManagerFeatures(user);
  const [departmentFilter, setDepartmentFilter] = useState('');

  const reportFilters = useMemo(
    () => ({ department_id: departmentFilter ? Number(departmentFilter) : undefined }),
    [departmentFilter],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['reports', reportFilters],
    queryFn: () => reportsApi.tasks(reportFilters).then((r) => r.data.data),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then((r) => r.data.data),
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

  const myStats = useMemo(() => {
    if (!data?.by_assignee?.length) return null;
    if (isManager) return null;
    return data.by_assignee.find((p) => p.user_id === user?.id) ?? data.by_assignee[0];
  }, [data, isManager, user?.id]);

  if (isLoading) {
    return (
      <div className="max-w-workspace mx-auto pb-12 space-y-4">
        <div className="animate-pulse h-10 w-48 bg-dark-muted rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-dark-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const total = data?.total || 0;
  const pending = data?.pending ?? Math.max(0, total - (data?.completed || 0));
  const completed = data?.completed || 0;
  const overdue = data?.overdue || 0;
  const blocked = data?.blocked || 0;
  const inProgress = data?.in_progress || 0;
  const unassignedPending = data?.unassigned_pending || 0;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const overviewPie = [
    { name: 'Still to do', value: pending, fill: '#60a5fa' },
    { name: 'Completed', value: completed, fill: '#34d399' },
    { name: 'Overdue', value: overdue, fill: '#ef4444' },
    { name: 'Blocked', value: blocked, fill: '#fb923c' },
  ].filter((d) => d.value > 0);

  const statusData = data?.by_status
    ? (Object.entries(data.by_status) as [string, number][])
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          key,
          name: STATUS_LABELS[key] || key.replace(/_/g, ' '),
          value,
          fill: STATUS_COLORS[key] || '#71717a',
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  const priorityData = data?.by_priority
    ? (Object.entries(data.by_priority) as [string, number][])
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          key,
          name: PRIORITY_LABELS[key] || key,
          value,
          fill: PRIORITY_COLORS[key] || '#71717a',
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  const assigneeChart = (data?.by_assignee ?? [])
    .filter((p) => p.pending > 0)
    .slice(0, 8)
    .map((p) => ({
      name: p.name.split(' ')[0],
      pending: p.pending,
      overdue: p.overdue,
    }));

  return (
    <div className="max-w-workspace mx-auto pb-12 space-y-8">
      <PageHeader
        title="Reports"
        subtitle={
          isManager
            ? 'See who has work pending, what needs attention, and how the team is progressing'
            : 'Your task workload and progress at a glance'
        }
        action={
          isManager ? (
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
              <Button variant="secondary" onClick={handleExport}>Export CSV</Button>
            </div>
          ) : undefined
        }
      />

      {/* Plain-language insights */}
      {(overdue > 0 || unassignedPending > 0 || (data?.people_with_overdue ?? 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {overdue > 0 && (
            <div className="insight-danger">
              <AlertTriangle className="h-5 w-5 insight-danger-icon shrink-0 mt-0.5" />
              <div>
                <p className="insight-danger-title">{overdue} overdue task{overdue !== 1 ? 's' : ''}</p>
                <p className="insight-danger-sub">Past due date and not finished yet</p>
              </div>
            </div>
          )}
          {isManager && (data?.people_with_overdue ?? 0) > 0 && (
            <div className="insight-warning">
              <Users className="h-5 w-5 insight-warning-icon shrink-0 mt-0.5" />
              <div>
                <p className="insight-warning-title">
                  {data!.people_with_overdue} team member{data!.people_with_overdue !== 1 ? 's' : ''} with overdue work
                </p>
                <p className="insight-warning-sub">Check the workload table below</p>
              </div>
            </div>
          )}
          {isManager && unassignedPending > 0 && (
            <div className="insight-info">
              <ClipboardList className="h-5 w-5 insight-info-icon shrink-0 mt-0.5" />
              <div>
                <p className="insight-info-title">{unassignedPending} unassigned pending task{unassignedPending !== 1 ? 's' : ''}</p>
                <p className="insight-info-sub">No one owns these yet</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Personal summary for employees */}
      {!isManager && myStats && (
        <section className="card p-6 border border-blue-500/20 bg-blue-500/5">
          <h2 className="text-sm font-medium text-text-primary mb-1">Your workload</h2>
          <p className="text-xs text-text-muted mb-4">Tasks assigned to you right now</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Pending', value: myStats.pending, color: 'metric-sky-strong' },
              { label: 'In progress', value: myStats.in_progress, color: 'metric-amber-strong' },
              { label: 'Overdue', value: myStats.overdue, color: 'metric-red' },
              { label: 'Blocked', value: myStats.blocked, color: 'metric-orange-strong' },
              { label: 'Due this week', value: myStats.due_this_week, color: 'metric-purple-strong' },
              { label: 'Completed', value: myStats.completed, color: 'metric-emerald-strong' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-surface-subtle border border-dark-border px-3 py-3 text-center">
                <p className={clsx('text-2xl font-semibold tabular-nums', item.color)}>{item.value}</p>
                <p className="text-xs text-text-muted mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Team summary */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3">
          {isManager ? 'Team snapshot' : 'Overview'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard
            label="Pending"
            hint="Not finished yet"
            value={pending}
            icon={ClipboardList}
            color="metric-sky"
            bg="bg-sky-500/10"
            border="border-sky-500/30"
          />
          <StatCard
            label="In progress"
            hint="Actively being worked on"
            value={inProgress}
            icon={PlayCircle}
            color="metric-amber"
            bg="bg-amber-500/10"
            border="border-amber-500/30"
          />
          <StatCard
            label="Overdue"
            hint="Past due date"
            value={overdue}
            icon={Clock}
            color="metric-red"
            bg="bg-red-500/10"
            border="border-red-500/30"
          />
          <StatCard
            label="Blocked"
            hint="Waiting on something"
            value={blocked}
            icon={Ban}
            color="metric-orange"
            bg="bg-orange-500/10"
            border="border-orange-500/30"
          />
          <StatCard
            label="Completed"
            hint={`${completionRate}% of all tasks`}
            value={completed}
            icon={CheckCircle2}
            color="metric-emerald"
            bg="bg-emerald-500/10"
            border="border-emerald-500/30"
          />
        </div>
      </section>

      {/* Per-person workload — main manager view */}
      {isManager && (
        <section className="card overflow-hidden">
          <div className="px-6 py-5 border-b border-dark-border">
            <h2 className="text-sm font-medium text-text-primary">Workload by person</h2>
            <p className="text-xs text-text-muted mt-1">
              Pending tasks per team member — sorted by who has the most open work
            </p>
          </div>
          <PersonWorkloadTable people={data?.by_assignee ?? []} />
        </section>
      )}

      {/* Pending by person chart */}
      {isManager && assigneeChart.length > 0 && (
        <section className="card p-6">
          <h3 className="text-sm font-medium text-text-primary mb-1">Who has the most pending work?</h3>
          <p className="text-xs text-text-muted mb-4">Blue = pending · Red segment = overdue within pending</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={assigneeChart} margin={{ left: 8, right: 16, bottom: 8 }}>
              <XAxis dataKey="name" tick={{ fill: chartTheme.axisTick, fontSize: 12 }} axisLine={{ stroke: chartTheme.axisLine }} tickLine={false} />
              <YAxis tick={{ fill: chartTheme.axisTick, fontSize: 11 }} axisLine={{ stroke: chartTheme.axisLine }} tickLine={false} width={32} allowDecimals={false} />
              <Tooltip contentStyle={chartTheme.tooltip} cursor={{ fill: chartTheme.cursor }} />
              <Bar dataKey="pending" stackId="a" fill="#60a5fa" name="Pending" radius={[0, 0, 0, 0]} />
              <Bar dataKey="overdue" stackId="a" fill="#ef4444" name="Overdue" radius={[4, 4, 0, 0]} />
              <Legend formatter={(value) => <span className="text-text-secondary text-xs">{value}</span>} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Completion + breakdown */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-6 border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-center min-h-[240px] md:col-span-1">
          <p className="text-sm text-text-secondary mb-1">Completion rate</p>
          <p className="text-4xl font-semibold metric-emerald tabular-nums">{completionRate}%</p>
          <p className="text-xs text-text-muted mt-2">{completed} of {total} tasks finished</p>
          <div className="mt-4 h-2 rounded-full bg-dark-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        <div className="card p-6 min-h-[240px] md:col-span-3">
          <h3 className="text-sm font-medium text-text-primary mb-1">Where tasks stand</h3>
          <p className="text-xs text-text-muted mb-2">Share of pending, done, overdue, and blocked</p>
          {overviewPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={overviewPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={78}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={{ stroke: chartTheme.axisTick, strokeWidth: 1 }}
                >
                  {overviewPie.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTheme.tooltip} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-muted py-12 text-center">No task data yet</p>
          )}
        </div>
      </section>

      {/* Extra personal stats from dashboard */}
      {dashboard?.stats && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3">Quick counts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              label="Your open tasks"
              value={dashboard.stats.open_tasks}
              icon={TrendingUp}
              color="metric-sky"
              bg="bg-sky-500/10"
              border="border-sky-500/20"
            />
            <StatCard
              label="Due this week"
              value={dashboard.stats.my_tasks_week}
              icon={CalendarClock}
              color="metric-purple"
              bg="bg-purple-500/10"
              border="border-purple-500/20"
            />
            <StatCard
              label="Reviews waiting on you"
              value={dashboard.stats.pending_reviews}
              icon={Eye}
              color="metric-violet"
              bg="bg-violet-500/10"
              border="border-violet-500/20"
            />
          </div>
        </section>
      )}

      {/* Status & priority */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="text-sm font-medium text-text-primary mb-1">Tasks by status</h3>
          <p className="text-xs text-text-muted mb-4">How work is distributed across stages</p>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" tick={{ fill: chartTheme.axisTick, fontSize: 11 }} axisLine={{ stroke: chartTheme.axisLine }} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: chartTheme.axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTheme.tooltip} cursor={{ fill: chartTheme.cursor }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                  {statusData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-muted py-12 text-center">No status data</p>
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-medium text-text-primary mb-1">Tasks by priority</h3>
          <p className="text-xs text-text-muted mb-4">Critical and high priority need faster turnaround</p>
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityData}>
                <XAxis dataKey="name" tick={{ fill: chartTheme.axisTick, fontSize: 12 }} axisLine={{ stroke: chartTheme.axisLine }} tickLine={false} />
                <YAxis tick={{ fill: chartTheme.axisTick, fontSize: 11 }} axisLine={{ stroke: chartTheme.axisLine }} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip contentStyle={chartTheme.tooltip} cursor={{ fill: chartTheme.cursor }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={48}>
                  {priorityData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-muted py-12 text-center">No priority data</p>
          )}
        </div>
      </section>

      {/* Project health */}
      {isManager && dashboard?.projects && dashboard.projects.length > 0 && (
        <section className="card p-6">
          <h3 className="text-sm font-medium text-text-primary mb-1">Project health</h3>
          <p className="text-xs text-text-muted mb-4">Green = on track · Yellow = at risk · Red = delayed</p>
          <div className="space-y-3">
            {dashboard.projects.map((p) => {
              const color = HEALTH_COLORS[p.health] || '#71717a';
              const label = HEALTH_LABELS[p.health] || p.health;
              return (
                <div key={p.id} className="flex items-center gap-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary truncate">{p.name}</p>
                    <div className="mt-2 h-1.5 rounded-full bg-dark-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: `${color}40` }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: p.health === 'healthy' ? '100%' : p.health === 'at_risk' ? '65%' : '35%',
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <span
                    className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ color, backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
