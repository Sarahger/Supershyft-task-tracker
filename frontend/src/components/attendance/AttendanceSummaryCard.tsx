import clsx from 'clsx';
import type { AttendanceSummary } from '../../types';

interface Props {
  summary: AttendanceSummary | undefined;
  loading?: boolean;
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="tabular-nums text-text-primary font-medium">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-dark-muted overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AttendanceSummaryCard({ summary, loading }: Props) {
  if (loading || !summary) {
    return (
      <div className="rounded-2xl border border-dark-border bg-dark-card p-5 animate-pulse space-y-3">
        <div className="h-4 w-32 bg-dark-muted rounded" />
        <div className="h-2 bg-dark-muted rounded" />
        <div className="h-2 bg-dark-muted rounded" />
        <div className="h-2 bg-dark-muted rounded" />
      </div>
    );
  }

  const max = Math.max(summary.working_days, summary.wfo_count + summary.wfh_count + summary.leave_count, 1);

  return (
    <section className="rounded-2xl border border-dark-border bg-dark-card p-5">
      <h2 className="text-sm font-semibold text-text-primary mb-4">Monthly Summary</h2>
      <div className="space-y-3">
        <Bar label="Present (WFO)" value={summary.wfo_count} max={max} color="bg-emerald-500" />
        <Bar label="WFH" value={summary.wfh_count} max={max} color="bg-sky-500" />
        <Bar label="Leave" value={summary.leave_count} max={max} color="bg-amber-500" />
      </div>
      <div className="mt-4 pt-3 border-t border-dark-border flex items-center justify-between">
        <span className="text-xs text-text-muted">Attendance %</span>
        <span className="text-lg font-semibold tabular-nums text-text-primary">
          {summary.attendance_percent}%
        </span>
      </div>
    </section>
  );
}
