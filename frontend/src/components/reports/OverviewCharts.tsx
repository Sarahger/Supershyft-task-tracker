import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  Bar, BarChart, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { reportsApi } from '../../services/endpoints';
import { useTheme } from '../../contexts/ThemeContext';
import { getChartTheme } from '../../lib/chartTheme';
import { STATUS_LABELS } from '../../types';
import type { ReportAnalytics, ReportAssigneeStats } from '../../types';

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

function periodLabel(start: string) {
  return format(parseISO(start), 'MMM yyyy');
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6 min-h-[280px]">
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      {description && <p className="text-xs text-text-muted mt-1 mb-4">{description}</p>}
      {children}
    </section>
  );
}

function EmptyChart({ text }: { text: string }) {
  return <p className="text-sm text-text-muted py-16 text-center">{text}</p>;
}

export function OverviewCharts({
  departmentId,
  start,
  end,
  people,
  onOpenEvaluation,
}: {
  departmentId?: number;
  start: string;
  end: string;
  people: ReportAssigneeStats[];
  onOpenEvaluation: (evaluationId: number) => void;
}) {
  const { theme } = useTheme();
  const chartTheme = getChartTheme(theme);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports-analytics', start, end, departmentId ?? null],
    queryFn: () => reportsApi.analytics({
      start_date: start,
      end_date: end,
      ...(departmentId ? { department_id: departmentId } : {}),
    }).then((r) => r.data.data),
    enabled: Boolean(start && end),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-72 bg-dark-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-text-muted">Could not load report charts.</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PerformersChart data={data} chartTheme={chartTheme} onOpen={onOpenEvaluation} />
      <StatusChart data={data} chartTheme={chartTheme} />
      <div className="lg:col-span-2">
        <PendingWorkChart people={people} chartTheme={chartTheme} />
      </div>
    </div>
  );
}

function StatusChart({
  data,
  chartTheme,
}: {
  data: ReportAnalytics;
  chartTheme: ReturnType<typeof getChartTheme>;
}) {
  const rows = data.by_status.map((row) => ({
    ...row,
    name: STATUS_LABELS[row.status] || row.status.replace(/_/g, ' '),
    fill: STATUS_COLORS[row.status] || '#71717a',
  }));
  return (
    <ChartCard title="Tasks by Status" description="How many current tasks sit in each status.">
      {rows.length === 0 ? <EmptyChart text="No tasks yet." /> : (
        <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 32)}>
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fill: chartTheme.axisTick, fontSize: 11 }} axisLine={{ stroke: chartTheme.axisLine }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: chartTheme.axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={chartTheme.tooltip} cursor={{ fill: chartTheme.cursor }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
              {rows.map((row) => (
                <Cell key={row.status} fill={row.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function chartFirstName(name: string, taken: Map<string, number>) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] || name;
  if ((taken.get(first) ?? 0) < 2) return first;
  const last = parts[1];
  return last ? `${first} ${last[0]}` : first;
}

function PendingWorkChart({
  people,
  chartTheme,
}: {
  people: ReportAssigneeStats[];
  chartTheme: ReturnType<typeof getChartTheme>;
}) {
  const ranked = people
    .filter((person) => person.pending > 0)
    .slice()
    .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));
  const firstCounts = new Map<string, number>();
  ranked.forEach((person) => {
    const first = person.name.trim().split(/\s+/)[0] || person.name;
    firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
  });
  const rows = ranked.map((person) => ({
    name: chartFirstName(person.name, firstCounts),
    fullName: person.name,
    pending: Math.max(0, person.pending - person.overdue),
    overdue: person.overdue,
  }));
  return (
    <ChartCard title="Who has the most pending work?" description="Blue = pending · Red segment = overdue within pending">
      {rows.length === 0 ? <EmptyChart text="Nobody has pending work." /> : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
            <XAxis dataKey="name" tick={{ fill: chartTheme.axisTick, fontSize: 12 }} axisLine={{ stroke: chartTheme.axisLine }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: chartTheme.axisTick, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={chartTheme.tooltip}
              cursor={{ fill: chartTheme.cursor }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as { fullName: string; pending: number; overdue: number };
                return (
                  <div style={chartTheme.tooltip} className="px-3 py-2">
                    <p>{row.fullName}</p>
                    <p>Pending {row.pending + row.overdue}</p>
                    <p>Overdue {row.overdue}</p>
                  </div>
                );
              }}
            />
            <Legend
              iconType="square"
              formatter={(value) => <span style={{ color: chartTheme.axisTick }}>{value}</span>}
            />
            <Bar dataKey="pending" name="Pending" stackId="work" fill="#3b82f6" maxBarSize={56} />
            <Bar dataKey="overdue" name="Overdue" stackId="work" fill="#ef4444" maxBarSize={56} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function PerformersChart({
  data,
  chartTheme,
  onOpen,
}: {
  data: ReportAnalytics;
  chartTheme: ReturnType<typeof getChartTheme>;
  onOpen: (evaluationId: number) => void;
}) {
  const rows = data.top_performers.map((row) => ({
    ...row,
    label: `${row.name} · ${periodLabel(row.period_start)}`,
  }));
  return (
    <ChartCard title="Top-Performing Employees" description="Finalized KRA/KPI scores for this period. Drafts are not included.">
      {rows.length === 0 ? <EmptyChart text="No finalized evaluations for this period." /> : (
        <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 36)}>
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fill: chartTheme.axisTick, fontSize: 11 }} axisLine={{ stroke: chartTheme.axisLine }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fill: chartTheme.axisTick, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={chartTheme.tooltip}
              formatter={(value, _name, item) => {
                const row = item.payload as typeof rows[number];
                return [`${value}/100 · ${periodLabel(row.period_start)}`, 'Score'];
              }}
            />
            <Bar
              dataKey="score"
              fill="#a78bfa"
              radius={[0, 4, 4, 0]}
              barSize={16}
              cursor="pointer"
              onClick={(bar) => {
                const row = (bar as { payload?: typeof rows[number] }).payload;
                if (row?.evaluation_id) onOpen(row.evaluation_id);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
