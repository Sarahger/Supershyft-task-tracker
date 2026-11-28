import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import {
  Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { reportsApi } from '../../services/endpoints';
import { useTheme } from '../../contexts/ThemeContext';
import { getChartTheme } from '../../lib/chartTheme';
import { Avatar } from '../ui/Avatar';
import type { ReportAnalytics, ReportAssigneeStats, ReportLeaveBalance } from '../../types';

function periodLabel(start: string) {
  return format(parseISO(start), 'MMM yyyy');
}

function ChartCard({
  title,
  description,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx('card p-6 min-h-[280px] h-full flex flex-col', className)}>
      <h3 className="text-sm font-medium text-text-primary shrink-0">{title}</h3>
      {description && (
        <p className="text-xs text-text-muted mt-1 mb-4 shrink-0">{description}</p>
      )}
      <div className={clsx('flex-1 min-h-0', bodyClassName)}>{children}</div>
    </section>
  );
}

function EmptyChart({ text }: { text: string }) {
  return <p className="text-sm text-text-muted py-16 text-center">{text}</p>;
}

function formatLeaveDays(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:min-h-[360px]">
        <div className="lg:col-span-3 h-72 bg-dark-muted rounded-lg animate-pulse" />
        <div className="lg:col-span-9 h-72 bg-dark-muted rounded-lg animate-pulse" />
        <div className="lg:col-span-12 h-72 bg-dark-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-text-muted">Could not load report charts.</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-3 lg:min-h-[360px]">
        <PerformersChart data={data} chartTheme={chartTheme} onOpen={onOpenEvaluation} />
      </div>
      <div className="lg:col-span-9 lg:min-h-[360px]">
        <AnnualLeavesCard rows={data.leave_balances ?? []} />
      </div>
      <div className="lg:col-span-12">
        <PendingWorkChart people={people} chartTheme={chartTheme} />
      </div>
    </div>
  );
}

function AnnualLeavesCard({ rows }: { rows: ReportLeaveBalance[] }) {
  const year = rows[0]?.year ?? new Date().getFullYear();
  const through = rows[0]?.through
    ? format(parseISO(rows[0].through), 'MMM d')
    : null;

  return (
    <ChartCard
      title="Annual leaves"
      description={
        through
          ? `${year} allotment · taken through week ending ${through}`
          : `${year} allotment · taken through the current week`
      }
      bodyClassName="overflow-y-auto"
    >
      {rows.length === 0 ? (
        <EmptyChart text="No people to show." />
      ) : (
        <div className="space-y-3 h-full">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs shrink-0">
            <span className="metric-sky-strong font-medium">Assigned</span>
            <span className="metric-amber-strong font-medium">Taken</span>
            <span className="metric-emerald-strong font-medium">Remaining</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 content-start">
            {rows.map((row) => (
              <div
                key={row.user_id}
                className="rounded-lg border border-dark-border bg-surface-subtle px-3 py-3 flex flex-col items-center gap-2 text-center"
              >
                <Avatar name={row.name} size="md" />
                <p className="text-sm font-medium text-text-primary truncate w-full" title={row.name}>
                  {row.name}
                </p>
                <div className="flex items-baseline justify-center gap-3 w-full">
                  <span className="tabular-nums text-base font-semibold metric-sky-strong">
                    {formatLeaveDays(row.assigned)}
                  </span>
                  <span className="tabular-nums text-base font-semibold metric-amber-strong">
                    {formatLeaveDays(row.taken)}
                  </span>
                  <span className="tabular-nums text-base font-semibold metric-emerald-strong">
                    {formatLeaveDays(row.pending)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
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
  const firstCounts = new Map<string, number>();
  data.top_performers.forEach((row) => {
    const first = row.name.trim().split(/\s+/)[0] || row.name;
    firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
  });
  const rows = data.top_performers.map((row) => ({
    ...row,
    shortName: chartFirstName(row.name, firstCounts),
    label: `${row.name} · ${periodLabel(row.period_start)} avg`,
  }));
  return (
    <ChartCard
      title="Top-Performing Employees"
      description="Monthly avg of finalized scores."
    >
      {rows.length === 0 ? <EmptyChart text="No finalized evaluations for this period." /> : (
        <ResponsiveContainer width="100%" height="100%" minHeight={240}>
          <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fill: chartTheme.axisTick, fontSize: 10 }} axisLine={{ stroke: chartTheme.axisLine }} tickLine={false} />
            <YAxis
              type="category"
              dataKey="shortName"
              width={72}
              tick={{ fill: chartTheme.axisTick, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={chartTheme.tooltip}
              formatter={(value, _name, item) => {
                const row = item.payload as typeof rows[number];
                const count = row.evaluation_count ?? 1;
                return [
                  `${value}/100 · ${periodLabel(row.period_start)} avg (${count} period${count === 1 ? '' : 's'})`,
                  row.name,
                ];
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
