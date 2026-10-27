import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { isMentionPart, splitCommentMentions } from '../../lib/mentions';
import { formatHoursLabel, toDateInput } from '../../lib/weeklyPlanParse';
import { Avatar } from '../ui/Avatar';
import type { WeeklyAuthor, WeeklyCommitment, WeeklyReport } from '../../types';

function formatRange(start: string, end: string) {
  return `${format(parseISO(start), 'd MMM')} – ${format(parseISO(end), 'd MMM yyyy')}`;
}

function formatShortDate(value?: string | null) {
  if (!value) return null;
  try {
    return format(parseISO(value), 'd MMM');
  } catch {
    return null;
  }
}

function hasRevisedDue(item: WeeklyCommitment): boolean {
  if (item.deadline_revisions && item.deadline_revisions.length > 0) return true;
  if (!item.original_due_date || !item.due_date) return false;
  return toDateInput(item.original_due_date) !== toDateInput(item.due_date);
}

function MentionText({ text }: { text: string }) {
  return (
    <>
      {splitCommentMentions(text).map((part, i) =>
        isMentionPart(part) ? (
          <span key={i} className="text-accent-primary font-medium">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function TaskTitle({
  title,
  taskId,
}: {
  title: string;
  taskId?: number | null;
}) {
  const { openTask } = useTaskDrawer();
  if (taskId) {
    return (
      <button
        type="button"
        onClick={() => openTask(taskId)}
        className="text-[15px] leading-relaxed text-text-primary hover:underline text-left"
      >
        <MentionText text={title} />
      </button>
    );
  }
  return (
    <p className="text-[15px] leading-relaxed text-text-primary">
      <MentionText text={title} />
    </p>
  );
}

function CommitmentRow({
  item,
  index,
  onRevise,
}: {
  item: WeeklyCommitment;
  index: number;
  onRevise?: (item: WeeklyCommitment) => void;
}) {
  const revised = hasRevisedDue(item);
  const dueLabel = formatShortDate(item.due_date);
  const timeLabel = formatHoursLabel(item.estimated_hours ?? null);
  const latestReason = item.deadline_revisions?.at(-1)?.reason;

  return (
    <li className="flex items-start gap-2 py-1">
      <span className="text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5">{index}.</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <TaskTitle title={item.title} taskId={item.task_id} />
          <p className="shrink-0 text-xs tabular-nums text-text-muted pt-1 text-right">
            {[
              timeLabel,
              dueLabel ? (revised ? `Revised due ${dueLabel}` : `Due ${dueLabel}`) : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        {revised && latestReason && (
          <p className="text-2xs text-text-muted mt-0.5">{latestReason}</p>
        )}
        {item.is_overdue && item.task_id && onRevise && (
          <button type="button" onClick={() => onRevise(item)} className="text-xs text-accent-primary mt-1">
            Add reason and revised deadline
          </button>
        )}
      </div>
    </li>
  );
}

export function WeeklyReportCard({
  report,
  author,
  onRevise,
  onEdit,
}: {
  report: WeeklyReport;
  author?: WeeklyAuthor | null;
  onRevise?: (item: WeeklyCommitment) => void;
  onEdit?: () => void;
}) {
  const person = author ?? report.author;
  const personName = person ? `${person.first_name} ${person.last_name}`.trim() : 'Weekly update';
  const leaveItems = [
    ...report.leave.leave_days,
    ...report.leave.holidays.filter((h) => h.kind === 'holiday'),
  ];

  return (
    <article
      id={`week-${report.period_start}`}
      className="min-w-0 rounded-2xl border border-dark-border bg-dark-card p-5 sm:p-6 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted">
            {report.is_current ? 'Current week' : 'Earlier week'}
          </p>
          <h3 className="text-base font-semibold text-text-primary mt-0.5">
            {formatRange(report.period_start, report.period_end)}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Next week {formatRange(report.planning_start, report.planning_end)}
          </p>
        </div>
        {onEdit && (
          <button type="button" onClick={onEdit} className="text-sm text-accent-primary hover:underline">
            Edit
          </button>
        )}
      </div>

      {person && (
        <div className="flex items-center gap-2">
          <Avatar name={personName} size="sm" src={person.profile_picture ?? undefined} />
          <p className="text-sm font-medium text-text-primary truncate">{personName}</p>
          <span
            className={clsx(
              'ml-auto shrink-0 text-2xs rounded-full border px-2 py-0.5',
              report.status === 'submitted'
                ? 'border-accent-success/30 text-accent-success'
                : 'border-dark-border text-text-muted',
            )}
          >
            {report.status === 'submitted' ? 'Submitted' : 'Draft'}
          </span>
        </div>
      )}

      <section className="space-y-1.5">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted">Last week</p>
        {report.completions.length === 0 ? (
          <p className="text-sm text-text-muted">No completed work recorded.</p>
        ) : (
          <ol className="space-y-1">
            {report.completions.map((item, i) => (
              <li key={`${item.task_id ?? item.title}-${i}`} className="flex items-start gap-2">
                <span className="text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5">{i + 1}.</span>
                <TaskTitle title={item.title} taskId={item.task_id} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="border-t border-dark-border" />

      <section className="space-y-1">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted">Next week</p>
        {report.commitments.length === 0 ? (
          <p className="text-sm text-text-muted">No commitments recorded.</p>
        ) : (
          <ol>
            {report.commitments.map((item, i) => (
              <CommitmentRow
                key={`${item.task_id ?? item.title}-${i}`}
                item={item}
                index={i + 1}
                onRevise={onRevise}
              />
            ))}
          </ol>
        )}
      </section>

      {(leaveItems.length > 0 || report.leave_notes) && (
        <footer className="text-xs text-text-muted space-y-0.5">
          {leaveItems.length > 0 && (
            <p>{leaveItems.map((d) => `${d.label} ${toDateInput(d.date)}`).join(' · ')}</p>
          )}
          {report.leave_notes && (
            <p className="text-text-secondary">
              <MentionText text={report.leave_notes} />
            </p>
          )}
        </footer>
      )}
    </article>
  );
}
