import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { reportsApi } from '../../services/endpoints';
import { useTheme } from '../../contexts/ThemeContext';
import { getChartTheme } from '../../lib/chartTheme';
import { STATUS_LABELS } from '../../types';
import type { ReportAnalytics } from '../../types';

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

function axisLabel(start: string, end: string) {
  if (start === end) return format(parseISO(start), 'd MMM');
  return format(parseISO(start), 'd MMM');
}

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
  onOpenEvaluation,
}: {
  departmentId?: number;
  start: string;
  end: string;
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
      <CompletionChart data={data} chartTheme={chartTheme} />
      <StatusChart data={data} chartTheme={chartTheme} />
      <PerformersChart data={data} chartTheme={chartTheme} onOpen={onOpenEvaluation} />
    </div>
  );
}

function CompletionChart({
  data,
  chartTheme,
}: {
  data: ReportAnalytics;
  chartTheme: ReturnType<typeof getChartTheme>;
}) {
  const points = data.completion_trend.map((row) => ({
    ...row,
    label: axisLabel(row.start, row.end),
  }));
  const hasTasks = points.some((row) => row.due > 0);
  return (
    <ChartCard title="Task Completion Trend" description="Tasks due in each interval that were completed by the end of it.">
      {!hasTasks ? <EmptyChart text="No tasks were due in this period." /> : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={points} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid stroke={chartTheme.axisLine} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: chartTheme.axisTick, fontSize: 11 }} axisLine={{ stroke: chartTheme.axisLine }} tickLine={false} />
            <YAxis tick={{ fill: chartTheme.axisTick, fontSize: 11 }} axisLine={false} tickLine={false} width={36} domain={[0, 100]} unit="%" />
            <Tooltip
              contentStyle={chartTheme.tooltip}
              formatter={(_value, _name, item) => {
                const row = item.payload as typeof points[number];
                const rate = row.rate == null ? '—' : `${row.rate}%`;
                return [`${rate} · ${row.completed} of ${row.due} completed`, 'Completion'];
              }}
            />
            <Line type="monotone" dataKey="rate" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
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
