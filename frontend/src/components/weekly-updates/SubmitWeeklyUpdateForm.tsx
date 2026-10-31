import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { DailyUpdateEditor } from '../daily-updates/DailyUpdateEditor';
import { tasksApi, usersApi, weeklyUpdatesApi } from '../../services/endpoints';
import { extractMentionedUserIds, type MentionUser } from '../../lib/mentions';
import {
  formatDueNoonForApi,
  formatHoursLabel,
  parseWeeklyDoneList,
  parseWeeklyPlanList,
  toDateInput,
} from '../../lib/weeklyPlanParse';
import type { Task, WeeklyCommitment, WeeklyCompletion } from '../../types';

interface CompletionDraft {
  key: string;
  task_id?: number | null;
  title: string;
  description?: string;
  completion_date: string;
  source: 'suggested' | 'manual';
  included: boolean;
}

interface CommitmentDraft {
  key: string;
  task_id?: number | null;
  title: string;
  description: string;
  estimated_hours: string;
  due_date: string;
  commitment_type: 'existing' | 'new' | 'carried_forward';
  revision_reason: string;
  is_overdue?: boolean;
  original_due_date?: string | null;
}

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function SubmitWeeklyUpdateForm({
  periodStart,
  existing,
  onClose,
}: {
  periodStart: string;
  existing?: { completions: WeeklyCompletion[]; commitments: WeeklyCommitment[] };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [doneText, setDoneText] = useState('');
  const [planText, setPlanText] = useState('');
  const [dueDates, setDueDates] = useState<Record<string, string>>({});
  const [revisionReasons, setRevisionReasons] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [completionDates, setCompletionDates] = useState<Record<number, string>>({});

  const { data: suggestions } = useQuery({
    queryKey: ['weekly-updates', 'suggestions', periodStart],
    queryFn: () => weeklyUpdatesApi.suggestions(periodStart).then((r) => r.data.data),
  });
  const { data: carry } = useQuery({
    queryKey: ['weekly-updates', 'carry-forward', periodStart],
    queryFn: () => weeklyUpdatesApi.carryForward(periodStart).then((r) => r.data.data),
  });
  const { data: myTasks } = useQuery({
    queryKey: ['tasks', 'my'],
    queryFn: () => tasksApi.my().then((r) => r.data.data ?? []),
  });
  const { data: usersList } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const r = await usersApi.list({ page_size: 100 });
      const items = r.data?.data?.items;
      return Array.isArray(items) ? items : [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const mentionUsers: MentionUser[] = (usersList ?? []).filter((u) => u.status !== 'inactive');

  const carried = carry?.items ?? [];

  useEffect(() => {
    if (initialized) return;
    if (suggestions === undefined || carry === undefined) return;

    const selected = new Set<number>();
    const completedOn: Record<number, string> = {};
    const doneLines: string[] = [];
    (existing?.completions ?? []).forEach((item, i) => {
      if (item.task_id) {
        selected.add(item.task_id);
        if (item.completion_date) completedOn[item.task_id] = item.completion_date;
      } else if (item.title) {
        doneLines.push(`${i + 1}. ${item.title}`);
      }
    });
    (suggestions.items ?? []).forEach((item) => {
      if (item.task_id && item.included !== false) {
        selected.add(item.task_id);
        if (item.completion_date) completedOn[item.task_id] = item.completion_date;
      }
    });
    setSelectedTaskIds(selected);
    setCompletionDates(completedOn);
    setDoneText(doneLines.join('\n'));

    const planLines: string[] = [];
    const dates: Record<string, string> = {};
    (existing?.commitments ?? [])
      .filter((c) => c.commitment_type !== 'carried_forward')
      .forEach((item, i) => {
        const hours = item.estimated_hours != null ? ` (${formatHoursLabel(item.estimated_hours)})` : '';
        planLines.push(`${i + 1}. ${item.title}${hours}`);
        if (item.due_date) dates[item.title.trim().toLowerCase()] = toDateInput(item.due_date);
      });
    setPlanText(planLines.join('\n'));
    setDueDates(dates);
    setInitialized(true);
  }, [initialized, suggestions, carry, existing]);

  const completedTasks = useMemo(() => {
    const byId = new Map<number, {
      id: number;
      title: string;
      completion_date?: string | null;
      estimated_hours?: number | null;
      source: 'suggested' | 'manual';
    }>();
    for (const item of existing?.completions ?? []) {
      if (!item.task_id) continue;
      byId.set(item.task_id, {
        id: item.task_id,
        title: item.title,
        completion_date: item.completion_date,
        estimated_hours: item.estimated_hours,
        source: item.source === 'manual' ? 'manual' : 'suggested',
      });
    }
    for (const item of suggestions?.items ?? []) {
      if (!item.task_id || byId.has(item.task_id)) continue;
      byId.set(item.task_id, {
        id: item.task_id,
        title: item.title,
        completion_date: item.completion_date,
        estimated_hours: item.estimated_hours,
        source: 'suggested',
      });
    }
    return [...byId.values()];
  }, [existing, suggestions]);

  const parsedDone = useMemo(() => parseWeeklyDoneList(doneText), [doneText]);
  const parsedPlan = useMemo(
    () => parseWeeklyPlanList(planText, { periodStart }),
    [planText, periodStart],
  );

  const togglePill = (taskId: number) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const completions: CompletionDraft[] = [];
      const seen = new Set<number>();
      for (const task of completedTasks) {
        if (seen.has(task.id)) continue;
        seen.add(task.id);
        completions.push({
          key: `done-${task.id}`,
          task_id: task.id,
          title: task.title,
          completion_date: completionDates[task.id] || task.completion_date || format(new Date(), 'yyyy-MM-dd'),
          source: task.source,
          included: selectedTaskIds.has(task.id),
        });
      }
      for (const item of parsedDone) {
        const match = completedTasks.find((t) => t.title.trim().toLowerCase() === item.title.trim().toLowerCase());
        if (match && seen.has(match.id)) continue;
        completions.push({
          key: newKey(),
          task_id: match?.id ?? null,
          title: match && !seen.has(match.id) ? match.title : item.title,
          description: item.description,
          completion_date: format(new Date(), 'yyyy-MM-dd'),
          source: match ? 'suggested' : 'manual',
          included: true,
        });
        if (match) seen.add(match.id);
      }

      const plan: CommitmentDraft[] = [
        ...carried.map((item) => {
          const key = `cf-${item.task_id}`;
          const currentDue = toDateInput(item.due_date);
          const nextDue = dueDates[key] || currentDue;
          return {
            key: `cf-${item.task_id ?? item.title}`,
            task_id: item.task_id,
            title: item.title,
            description: item.description ?? '',
            estimated_hours: item.estimated_hours != null ? String(item.estimated_hours) : '',
            due_date: nextDue,
            commitment_type: 'carried_forward' as const,
            revision_reason: nextDue && currentDue && nextDue !== currentDue ? (revisionReasons[key] || '') : '',
            is_overdue: item.is_overdue,
            original_due_date: item.original_due_date,
          };
        }),
        ...parsedPlan.items.map((item) => {
          const match = (myTasks ?? []).find((t: Task) => t.title.trim().toLowerCase() === item.title.trim().toLowerCase());
          const key = item.title.trim().toLowerCase();
          const nextDue = dueDates[key] || item.dueDate || '';
          const currentDue = match ? toDateInput(match.due_date) : '';
          return {
            key: `p-${item.title}`,
            task_id: match?.id ?? null,
            title: item.title,
            description: '',
            estimated_hours: item.estimatedHours != null ? String(item.estimatedHours) : '',
            due_date: nextDue,
            commitment_type: (match ? 'existing' : 'new') as 'existing' | 'new',
            revision_reason: match && currentDue && nextDue && nextDue !== currentDue ? (revisionReasons[key] || '') : '',
          };
        }),
      ];

      for (const item of plan) {
        if (!item.title.trim()) continue;
        if (!item.due_date) throw new Error(`Add a due date for “${item.title}”`);
        const hours = Number(item.estimated_hours);
        if (!hours || hours <= 0) throw new Error(`Add time required for “${item.title}”`);
        const previousDue = item.commitment_type === 'carried_forward'
          ? toDateInput(carried.find((c) => c.task_id === item.task_id)?.due_date)
          : item.commitment_type === 'existing'
            ? toDateInput((myTasks ?? []).find((t: Task) => t.id === item.task_id)?.due_date)
            : '';
        if (previousDue && item.due_date !== previousDue && !item.revision_reason.trim()) {
          throw new Error(`Add a reason for changing the due date of “${item.title}”`);
        }
      }

      const mentionSource = [doneText, planText, ...completions.map((c) => c.title), ...plan.map((c) => c.title)].join('\n');

      return weeklyUpdatesApi.upsert({
        period_start: periodStart,
        mentioned_user_ids: extractMentionedUserIds(mentionSource, mentionUsers),
        completions: completions.map((c) => ({
          task_id: c.task_id ?? null,
          title: c.title.trim(),
          completion_date: c.completion_date || null,
          source: c.source,
          included: c.included,
        })),
        commitments: plan.filter((c) => c.title.trim()).map((c) => ({
          task_id: c.task_id ?? null,
          title: c.title.trim(),
          description: c.description.trim() || null,
          estimated_hours: Number(c.estimated_hours),
          due_date: formatDueNoonForApi(c.due_date),
          commitment_type: c.commitment_type,
          revision_reason: c.revision_reason.trim() || null,
        })),
      });
    },
    onSuccess: (res) => {
      const errors = res.data.data?.create_errors ?? [];
      if (errors.length) {
        toast.error(`Saved, but ${errors.length} task${errors.length === 1 ? '' : 's'} failed to create. Retry to finish those only.`);
      } else {
        toast.success('Weekly update submitted');
      }
      qc.invalidateQueries({ queryKey: ['weekly-updates'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data;
      toast.error(
        (typeof detail?.detail === 'string' && detail.detail)
          || detail?.message
          || (err as Error).message
          || 'Could not submit weekly update',
      );
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-text-primary">Write weekly update</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Week of {format(parseISO(periodStart), 'd MMM yyyy')} · Type @ to tag someone
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-text-muted hover:text-text-secondary">
          Cancel
        </button>
      </header>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">Last week’s tasks</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Tasks marked complete this week are already included. Uncheck anything to leave out, or add extra work below.
          </p>
        </div>
        {completedTasks.length > 0 ? (
          <ol className="space-y-1">
            {completedTasks.map((task, i) => {
              const selected = selectedTaskIds.has(task.id);
              const timeLabel = task.estimated_hours != null ? formatHoursLabel(task.estimated_hours) : null;
              const doneLabel = task.completion_date
                ? format(parseISO(task.completion_date), 'd MMM')
                : null;
              const meta = [timeLabel, doneLabel ? `Completed ${doneLabel}` : null].filter(Boolean).join(' · ');
              return (
                <li key={task.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1.5 accent-accent-primary"
                    checked={selected}
                    onChange={() => togglePill(task.id)}
                    aria-label={`Include ${task.title}`}
                  />
                  <span className="text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5">{i + 1}.</span>
                  <div className="min-w-0 flex-1 flex items-start justify-between gap-4">
                    <p className={clsx('text-[15px] leading-relaxed', selected ? 'text-text-primary' : 'text-text-muted line-through')}>
                      {task.title}
                    </p>
                    {meta ? (
                      <p className="shrink-0 text-xs tabular-nums text-text-muted pt-1 text-right">{meta}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-text-muted">No tracker tasks were marked complete this week.</p>
        )}
        <DailyUpdateEditor
          value={doneText}
          onChange={setDoneText}
          users={mentionUsers}
          showExtras={false}
          placeholder={'Add anything else that is not a tracker task\n1. Server updates with @Name'}
        />
        {parsedDone.length > 0 && (
          <p className="text-xs text-text-muted">{parsedDone.length} extra item{parsedDone.length === 1 ? '' : 's'} will be included.</p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">This week’s tasks</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Numbered list with /friday or /tuesday for due date and #3h for time. Tag people with @name.
          </p>
        </div>
        {carried.length > 0 && (
          <div className="rounded-xl border border-dark-border px-3 py-2 space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-medium text-amber-400">Carried forward</p>
              <p className="text-2xs text-text-muted">
                <span className="text-amber-400">Yellow</span> = carried forward
              </p>
            </div>
            {carried.map((item) => {
              const key = `cf-${item.task_id}`;
              const currentDue = toDateInput(item.due_date);
              const nextDue = dueDates[key] || currentDue;
              const dateChanged = Boolean(nextDue && currentDue && nextDue !== currentDue);
              return (
                <div key={item.task_id ?? item.title} className="space-y-2">
                  <div className="grid sm:grid-cols-[1fr_140px] gap-2 items-center">
                    <p className="text-sm text-amber-400">
                      {item.title}
                      {item.is_overdue && <span className="ml-2 text-2xs text-accent-danger">Overdue</span>}
                    </p>
                    <Input
                      label={dateChanged ? 'Revised due date' : undefined}
                      type="date"
                      value={nextDue}
                      onChange={(e) => setDueDates((prev) => ({ ...prev, [key]: e.target.value }))}
                      error={!nextDue ? 'Required' : undefined}
                    />
                  </div>
                  {dateChanged && (
                    <Input
                      label="Reason for changing"
                      value={revisionReasons[key] || ''}
                      onChange={(e) => setRevisionReasons((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Why is the due date changing?"
                      error={!revisionReasons[key]?.trim() ? 'Required when changing the due date' : undefined}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        <DailyUpdateEditor
          value={planText}
          onChange={setPlanText}
          users={mentionUsers}
          showExtras={false}
          placeholder={'1. Custom Packages on Flutter /wednesday #2d\n2. Review with @Name /tuesday #1h\n3. AWS final integration /friday #3h'}
        />
        {parsedPlan.items.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-secondary">Review due dates</p>
            {parsedPlan.items.map((item) => {
              const key = item.title.trim().toLowerCase();
              const due = dueDates[key] || item.dueDate || '';
              const match = (myTasks ?? []).find((t: Task) => t.title.trim().toLowerCase() === key);
              const currentDue = match ? toDateInput(match.due_date) : '';
              const dateChanged = Boolean(match && currentDue && due && due !== currentDue);
              return (
                <div key={key} className="space-y-2">
                  <div className="grid sm:grid-cols-[1fr_auto_140px] gap-2 items-start">
                    <div>
                      <p className="text-sm text-text-primary">{item.title}</p>
                      {item.missingEffort && (
                        <p className="text-2xs text-accent-danger">Add time required in the list, e.g. #3h or (4hrs)</p>
                      )}
                    </div>
                    <p className="text-xs text-text-muted pt-2">{item.timeLabel || formatHoursLabel(item.estimatedHours)}</p>
                    <Input
                      label={dateChanged ? 'Revised due date' : undefined}
                      type="date"
                      value={due}
                      onChange={(e) => setDueDates((prev) => ({ ...prev, [key]: e.target.value }))}
                      error={!due ? 'Required' : undefined}
                    />
                  </div>
                  {dateChanged && (
                    <Input
                      label="Reason for changing"
                      value={revisionReasons[key] || ''}
                      onChange={(e) => setRevisionReasons((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Why is the due date changing?"
                      error={!revisionReasons[key]?.trim() ? 'Required when changing the due date' : undefined}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="button" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Submit weekly update
        </Button>
      </div>
    </div>
  );
}
