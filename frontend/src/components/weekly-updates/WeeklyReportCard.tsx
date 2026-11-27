import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { isMentionPart, splitCommentMentions } from '../../lib/mentions';
import { formatHoursLabel, mondayOf, toDateInput } from '../../lib/weeklyPlanParse';
import { Avatar } from '../ui/Avatar';
import type { WeeklyAuthor, WeeklyCommitment, WeeklyCompletion, WeeklyLeaveContext, WeeklyReport } from '../../types';

function formatRange(start: string, end: string) {
  return `${format(parseISO(start), 'd MMM')} – ${format(parseISO(end), 'd MMM yyyy')}`;
}

function weekKindLabel(report: WeeklyReport) {
  if (report.is_current) return 'Current week';
  try {
    const todayMonday = format(mondayOf(new Date()), 'yyyy-MM-dd');
    return report.period_start > todayMonday ? 'Upcoming week' : 'Earlier week';
  } catch {
    return 'Earlier week';
  }
}

function formatShortDate(value?: string | null) {
  if (!value) return null;
  try {
    return format(parseISO(value), 'd MMM');
  } catch {
    return null;
  }
}

function leaveSummary(ctx?: WeeklyLeaveContext | null) {
  if (!ctx) return [];
  const items = [
    ...ctx.leave_days.map((d) => `${d.label} ${formatShortDate(d.date) ?? d.date}`),
    ...ctx.holidays
      .filter((h) => h.kind === 'holiday')
      .map((d) => `${d.label} ${formatShortDate(d.date) ?? d.date}`),
  ];
  return items;
}

function hasRevisedDue(item: { original_due_date?: string | null; due_date?: string | null; deadline_revisions?: unknown[] }): boolean {
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
  className,
}: {
  title: string;
  taskId?: number | null;
  className?: string;
}) {
  const { openTask } = useTaskDrawer();
  const textClass = clsx('text-[15px] leading-relaxed text-left', className ?? 'text-text-primary');
  if (taskId) {
    return (
      <button
        type="button"
        onClick={() => openTask(taskId)}
        className={clsx(textClass, 'hover:underline')}
      >
        <MentionText text={title} />
      </button>
    );
  }
  return (
    <p className={textClass}>
      <MentionText text={title} />
    </p>
  );
}

function metaLine(timeLabel: string | null, dateLabel: string | null, datePrefix: string) {
  return [timeLabel, dateLabel ? `${datePrefix} ${dateLabel}` : null].filter(Boolean).join(' · ');
}

function CompletionRow({ item, index }: { item: WeeklyCompletion; index: number }) {
  const timeLabel = item.estimated_hours != null ? formatHoursLabel(item.estimated_hours) : null;
  const doneLabel = formatShortDate(item.completion_date || item.completed_at);
  const delayed = Boolean(item.is_delayed || item.is_carried_forward);
  const revised = hasRevisedDue(item);
  // Prefer the current (revised) due date; tag it when it differs from the original.
  const dueLabel = formatShortDate(item.due_date || item.original_due_date);
  const duePrefix = revised ? 'Revised due' : 'Due';

  return (
    <li className="flex items-start gap-2 py-1">
      <span className="text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5">{index}.</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-1 md:gap-4">
          <TaskTitle title={item.title} taskId={item.task_id} className="text-text-primary" />
          {timeLabel || doneLabel || dueLabel ? (
            <p className="text-xs tabular-nums text-text-muted md:pt-1 md:text-right md:shrink-0">
              {timeLabel}
              {timeLabel && (doneLabel || dueLabel) ? ' · ' : null}
              {dueLabel ? <>{duePrefix} {dueLabel}{doneLabel ? ' · ' : null}</> : null}
              {doneLabel ? (
                <>
                  <span className={delayed ? 'text-amber-400' : undefined}>Completed</span> {doneLabel}
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function CommitmentRow({
  item,
  index,
  onRevise,
  freezeCarriedForward,
}: {
  item: WeeklyCommitment;
  index: number;
  onRevise?: (item: WeeklyCommitment) => void;
  freezeCarriedForward?: boolean;
}) {
  const revised = hasRevisedDue(item);
  const latestRevision = item.deadline_revisions?.[item.deadline_revisions.length - 1];
  // Always show the current (new) due date; "Revised due" indicates it changed from the original.
  const dueLabel = formatShortDate(latestRevision?.new_due_date || item.due_date);
  const timeLabel = item.estimated_hours != null ? formatHoursLabel(item.estimated_hours) : null;
  const latestReason = latestRevision?.reason;
  const carried = freezeCarriedForward
    ? item.commitment_type === 'carried_forward'
    : Boolean(item.is_carried_forward || item.commitment_type === 'carried_forward');
  const meta = metaLine(timeLabel, dueLabel, revised ? 'Revised due' : 'Due');

  return (
    <li className="flex items-start gap-2 py-1">
      <span className="text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5">{index}.</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-1 md:gap-4">
          <TaskTitle
            title={item.title}
            taskId={item.task_id}
            className={carried ? 'text-amber-400' : undefined}
          />
          {meta ? (
            <p className="text-xs tabular-nums text-text-muted md:pt-1 md:text-right md:shrink-0">{meta}</p>
          ) : null}
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

function TaskSection({
  title,
  emptyLabel,
  items,
  onRevise,
  freezeCarriedForward,
}: {
  title: string;
  emptyLabel: string;
  items: WeeklyCommitment[];
  onRevise?: (item: WeeklyCommitment) => void;
  freezeCarriedForward?: boolean;
}) {
  return (
    <section className="space-y-1">
      <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">{emptyLabel}</p>
      ) : (
        <ol>
          {items.map((item, i) => (
            <CommitmentRow
              key={`${item.task_id ?? item.title}-${i}`}
              item={item}
              index={i + 1}
              onRevise={onRevise}
              freezeCarriedForward={freezeCarriedForward}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

export function WeeklyReportCard({
  report,
  author,
  onRevise,
  onEdit,
  actionLabel = 'Edit',
}: {
  report: WeeklyReport;
  author?: WeeklyAuthor | null;
  onRevise?: (item: WeeklyCommitment) => void;
  onEdit?: () => void;
  actionLabel?: string;
}) {
  const person = author ?? report.author;
  const personName = person ? `${person.first_name} ${person.last_name}`.trim() : 'Weekly update';
  const thisWeekLeave = leaveSummary(report.leave);

  const freezeCarriedForward = !report.editable;
  const currentWeekTasks = report.current_week_tasks ?? [];
  const hasDelayed =
    report.completions.some((item) => item.is_delayed || item.is_carried_forward) ||
    currentWeekTasks.some((item) =>
      freezeCarriedForward
        ? item.commitment_type === 'carried_forward'
        : Boolean(item.is_carried_forward || item.commitment_type === 'carried_forward'),
    );

  return (
    <article
      id={`week-${report.period_start}`}
      className="min-w-0 rounded-2xl border border-dark-border bg-dark-card p-5 sm:p-6 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted">
            {weekKindLabel(report)}
            {!report.editable ? ' · Locked' : null}
          </p>
          <h3 className="text-base font-semibold text-text-primary mt-0.5">
            {formatRange(report.period_start, report.period_end)}
          </h3>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-dark-border bg-dark-elevated px-2.5 py-1 text-xs font-medium text-text-primary hover:bg-dark-hover transition-colors"
            >
              {actionLabel}
            </button>
          )}
          {hasDelayed && (
            <p className="text-2xs text-text-muted">
              <span className="text-amber-400">Yellow</span> = delayed / carried forward
            </p>
          )}
        </div>
      </div>

      {person && (
        <div className="flex items-center gap-2">
          <Avatar name={personName} size="sm" src={person.profile_picture ?? undefined} />
          <p className="text-sm font-medium text-text-primary truncate">{personName}</p>
        </div>
      )}

      <section className="space-y-1.5">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted">Completed Tasks</p>
        {report.completions.length === 0 ? (
          <p className="text-sm text-text-muted">No tasks yet</p>
        ) : (
          <ol className="space-y-1">
            {report.completions.map((item, i) => (
              <CompletionRow
                key={`${item.task_id ?? item.title}-${i}`}
                item={item}
                index={i + 1}
              />
            ))}
          </ol>
        )}
      </section>

      <div className="border-t border-dark-border" />

      <TaskSection
        title="Current Week's Tasks"
        emptyLabel="No tasks yet"
        items={currentWeekTasks}
        onRevise={onRevise}
        freezeCarriedForward={freezeCarriedForward}
      />

      {thisWeekLeave.length > 0 && (
        <footer className="text-xs text-text-muted space-y-0.5">
          <p>{thisWeekLeave.join(' · ')}</p>
        </footer>
      )}
    </article>
  );
}
