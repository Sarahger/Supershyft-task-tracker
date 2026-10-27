import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { formatHoursLabel, toDateInput } from '../../lib/weeklyPlanParse';
import type { WeeklyCommitment, WeeklyReport } from '../../types';

function formatRange(start: string, end: string) {
  return `${format(parseISO(start), 'd MMM')} – ${format(parseISO(end), 'd MMM yyyy')}`;
}

function TaskMeta({
  item,
  onRevise,
}: {
  item: WeeklyCommitment;
  onRevise?: (item: WeeklyCommitment) => void;
}) {
  const { openTask } = useTaskDrawer();
  return (
    <li className="flex flex-col gap-1 py-2 border-b border-dark-border last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {item.task_id ? (
            <button type="button" onClick={() => openTask(item.task_id!)} className="text-sm text-text-primary hover:underline text-left">
              {item.title}
            </button>
          ) : (
            <p className="text-sm text-text-primary">{item.title}</p>
          )}
          <p className="text-xs text-text-muted mt-0.5">
            {formatHoursLabel(item.estimated_hours ?? null)}
            {item.original_due_date && (
              <> · Original {format(parseISO(item.original_due_date), 'd MMM')}</>
            )}
            {item.due_date && (
              <> · Due {format(parseISO(item.due_date), 'd MMM')}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1 shrink-0">
          {item.is_carried_forward && (
            <span className="text-2xs rounded-full border border-dark-border px-2 py-0.5 text-text-muted">Carried forward</span>
          )}
          {item.is_overdue && (
            <span className="text-2xs rounded-full border border-accent-danger/40 px-2 py-0.5 text-accent-danger">Overdue</span>
          )}
          {item.is_resolved && (
            <span className="text-2xs rounded-full border border-dark-border px-2 py-0.5 text-text-muted">Done</span>
          )}
        </div>
      </div>
      {item.deadline_revisions && item.deadline_revisions.length > 0 && (
        <div className="text-2xs text-text-muted space-y-0.5">
          {item.deadline_revisions.map((rev) => (
            <p key={rev.id}>
              {rev.reason}
              {rev.new_due_date ? ` → ${format(parseISO(rev.new_due_date), 'd MMM')}` : ''}
            </p>
          ))}
        </div>
      )}
      {item.is_overdue && item.task_id && onRevise && (
        <button type="button" onClick={() => onRevise(item)} className="text-xs text-accent-primary self-start">
          Add reason and revised deadline
        </button>
      )}
    </li>
  );
}

export function WeeklyReportCard({
  report,
  onRevise,
}: {
  report: WeeklyReport;
  onRevise?: (item: WeeklyCommitment) => void;
}) {
  const { openTask } = useTaskDrawer();
  return (
    <article
      id={`week-${report.period_start}`}
      className={clsx(
        'rounded-2xl border bg-dark-card px-4 py-4 space-y-4',
        report.is_current ? 'border-accent-primary/40' : 'border-dark-border',
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">
            {report.is_current ? 'Current period' : 'Earlier week'}
          </p>
          <h3 className="text-base font-semibold text-text-primary">
            {formatRange(report.period_start, report.period_end)}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Next week {formatRange(report.planning_start, report.planning_end)}
          </p>
        </div>
        <span className={clsx('text-xs rounded-full border px-2.5 py-1', report.status === 'submitted' ? 'border-accent-success/30 text-accent-success' : 'border-dark-border text-text-muted')}>
          {report.status === 'submitted' ? 'Submitted' : 'Draft'}
        </span>
      </header>

      <section>
        <h4 className="text-xs font-medium text-text-secondary mb-1">Last week’s tasks</h4>
        {report.completions.length === 0 ? (
          <p className="text-sm text-text-muted">No completed work recorded.</p>
        ) : (
          <ul>
            {report.completions.map((item, i) => (
              <li key={`${item.task_id ?? item.title}-${i}`} className="flex items-start gap-2 py-1">
                <span className="text-xs text-text-muted w-5 shrink-0 pt-0.5">{i + 1}.</span>
                <div className="min-w-0">
                  {item.task_id ? (
                    <button type="button" onClick={() => openTask(item.task_id!)} className="text-sm text-text-primary hover:underline text-left">
                      {item.title}
                    </button>
                  ) : (
                    <p className="text-sm text-text-primary">{item.title}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-xs font-medium text-text-secondary mb-1">This week’s tasks</h4>
        {report.commitments.length === 0 ? (
          <p className="text-sm text-text-muted">No commitments recorded.</p>
        ) : (
          <ol className="list-none">
            {report.commitments.map((item, i) => (
              <li key={`${item.task_id ?? item.title}-${i}`} className="flex gap-2">
                <span className="text-xs text-text-muted w-5 shrink-0 pt-2">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <TaskMeta item={item} onRevise={onRevise} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="text-xs text-text-muted space-y-1">
        <p>
          {report.leave.working_days} working day{report.leave.working_days === 1 ? '' : 's'} this period
          {' · '}
          {report.planning_leave.working_days} next week
        </p>
        {[...report.leave.leave_days, ...report.leave.holidays.filter((h) => h.kind === 'holiday')].length > 0 && (
          <p>
            {[...report.leave.leave_days, ...report.leave.holidays.filter((h) => h.kind === 'holiday')]
              .map((d) => `${d.label} ${toDateInput(d.date)}`)
              .join(' · ')}
          </p>
        )}
        {report.leave_notes && <p className="text-text-secondary">{report.leave_notes}</p>}
      </section>
    </article>
  );
}
