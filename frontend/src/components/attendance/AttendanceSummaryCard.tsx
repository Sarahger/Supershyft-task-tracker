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
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-text-secondary">{label}</span>
        <span className="tabular-nums text-text-primary font-medium">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-dark-muted overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AttendanceSummaryCard({ summary, loading }: Props) {
  if (loading || !summary) {
    return (
      <div className="card p-5 animate-pulse space-y-3">
        <div className="h-3 w-28 bg-dark-muted rounded" />
        <div className="h-2 bg-dark-muted rounded" />
        <div className="h-2 bg-dark-muted rounded" />
        <div className="h-2 bg-dark-muted rounded" />
      </div>
    );
  }

  const max = Math.max(summary.working_days, summary.wfo_count + summary.wfh_count + summary.leave_count, 1);

  return (
    <section className="card p-5 h-full">
      <h2 className="workspace-section-title !mb-4 !px-0">Monthly summary</h2>
      <div className="space-y-3.5">
        <Bar label="Present (WFO)" value={summary.wfo_count} max={max} color="bg-emerald-500" />
        <Bar label="WFH" value={summary.wfh_count} max={max} color="bg-sky-500" />
        <Bar label="Leave" value={summary.leave_count} max={max} color="bg-amber-500" />
      </div>
      <div className="mt-5 pt-4 border-t border-dark-border flex items-center justify-between">
        <span className="text-xs text-text-muted">Attendance %</span>
        <span className="text-xl font-semibold tabular-nums metric-emerald">
          {summary.attendance_percent}%
        </span>
      </div>
    </section>
  );
}
