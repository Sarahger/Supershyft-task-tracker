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
  existing?: { leave_notes?: string | null; completions: WeeklyCompletion[]; commitments: WeeklyCommitment[] };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [doneText, setDoneText] = useState('');
  const [planText, setPlanText] = useState('');
  const [dueDates, setDueDates] = useState<Record<string, string>>({});
  const [leaveNotes, setLeaveNotes] = useState(existing?.leave_notes ?? '');
  const [initialized, setInitialized] = useState(false);

  const { data: suggestions } = useQuery({
    queryKey: ['weekly-updates', 'suggestions', periodStart],
    queryFn: () => weeklyUpdatesApi.suggestions(periodStart).then((r) => r.data.data),
  });
  const { data: carry } = useQuery({
    queryKey: ['weekly-updates', 'carry-forward', periodStart],
    queryFn: () => weeklyUpdatesApi.carryForward(periodStart).then((r) => r.data.data),
  });
  const { data: leave } = useQuery({
    queryKey: ['weekly-updates', 'leave', periodStart],
    queryFn: () => weeklyUpdatesApi.leaveContext({ week_start: periodStart }).then((r) => r.data.data),
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
    const doneLines: string[] = [];
    (existing?.completions ?? []).forEach((item, i) => {
      if (item.task_id) selected.add(item.task_id);
      else if (item.title) doneLines.push(`${i + 1}. ${item.title}`);
    });
    (suggestions.items ?? []).forEach((item) => {
      if (item.task_id && item.included !== false) selected.add(item.task_id);
    });
    setSelectedTaskIds(selected);
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

  const pillTasks = useMemo(() => {
    const byId = new Map<number, { id: number; title: string; status: string; suggested: boolean }>();
    for (const item of suggestions?.items ?? []) {
      if (!item.task_id) continue;
      byId.set(item.task_id, { id: item.task_id, title: item.title, status: 'completed', suggested: true });
    }
    for (const task of myTasks ?? []) {
      if (['cancelled'].includes(task.status)) continue;
      if (!byId.has(task.id)) {
        byId.set(task.id, { id: task.id, title: task.title, status: task.status, suggested: task.status === 'completed' });
      }
    }
    return [...byId.values()].slice(0, 40);
  }, [suggestions, myTasks]);

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
      for (const task of pillTasks) {
        if (!selectedTaskIds.has(task.id) || seen.has(task.id)) continue;
        seen.add(task.id);
        completions.push({
          key: `pill-${task.id}`,
          task_id: task.id,
          title: task.title,
          completion_date: format(new Date(), 'yyyy-MM-dd'),
          source: task.suggested ? 'suggested' : 'manual',
          included: true,
        });
      }
      for (const item of parsedDone) {
        const match = pillTasks.find((t) => t.title.trim().toLowerCase() === item.title.trim().toLowerCase());
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
        ...carried.map((item) => ({
          key: `cf-${item.task_id ?? item.title}`,
          task_id: item.task_id,
          title: item.title,
          description: item.description ?? '',
          estimated_hours: item.estimated_hours != null ? String(item.estimated_hours) : '',
          due_date: dueDates[`cf-${item.task_id}`] || toDateInput(item.due_date),
          commitment_type: 'carried_forward' as const,
          revision_reason: '',
          is_overdue: item.is_overdue,
          original_due_date: item.original_due_date,
        })),
        ...parsedPlan.items.map((item) => {
          const match = (myTasks ?? []).find((t: Task) => t.title.trim().toLowerCase() === item.title.trim().toLowerCase());
          return {
            key: `p-${item.title}`,
            task_id: match?.id ?? null,
            title: item.title,
            description: '',
            estimated_hours: item.estimatedHours != null ? String(item.estimatedHours) : '',
            due_date: dueDates[item.title.trim().toLowerCase()] || item.dueDate || '',
            commitment_type: (match ? 'existing' : 'new') as 'existing' | 'new',
            revision_reason: '',
          };
        }),
      ];

      for (const item of plan) {
        if (!item.title.trim()) continue;
        if (!item.due_date) throw new Error(`Add a due date for “${item.title}”`);
        const hours = Number(item.estimated_hours);
        if (!hours || hours <= 0) throw new Error(`Add time required for “${item.title}”`);
        if (item.is_overdue && !item.revision_reason.trim() && item.commitment_type === 'carried_forward') {
          throw new Error(`“${item.title}” is overdue — add a reason and a revised deadline`);
        }
      }

      const mentionSource = [doneText, planText, leaveNotes, ...completions.map((c) => c.title), ...plan.map((c) => c.title)].join('\n');

      return weeklyUpdatesApi.upsert({
        period_start: periodStart,
        leave_notes: leaveNotes.trim() || undefined,
        mentioned_user_ids: extractMentionedUserIds(mentionSource, mentionUsers),
        completions: completions.map((c) => ({
          task_id: c.task_id ?? null,
          title: c.title.trim(),
          completion_date: c.completion_date || null,
          source: c.source,
          included: true,
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
            Tap tracker tasks that were finished, and/or write the rest as a numbered list.
          </p>
        </div>
        {pillTasks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pillTasks.map((task) => {
              const selected = selectedTaskIds.has(task.id);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => togglePill(task.id)}
                  className={clsx(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    selected
                      ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                      : 'border-dark-border text-text-secondary hover:text-text-primary',
                  )}
                >
                  {task.title}
                </button>
              );
            })}
          </div>
        )}
        <DailyUpdateEditor
          value={doneText}
          onChange={setDoneText}
          users={mentionUsers}
          showExtras={false}
          placeholder={'1. Server updates with @Name\n2. Diwali website animation\n3. PDF automation for Diwali website'}
        />
        {parsedDone.length > 0 && (
          <p className="text-xs text-text-muted">{parsedDone.length} written item{parsedDone.length === 1 ? '' : 's'} will be included.</p>
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
            <p className="text-xs font-medium text-text-secondary">Carried forward</p>
            {carried.map((item) => (
              <div key={item.task_id ?? item.title} className="grid sm:grid-cols-[1fr_140px] gap-2 items-center">
                <p className="text-sm text-text-primary">
                  {item.title}
                  {item.is_overdue && <span className="ml-2 text-2xs text-accent-danger">Overdue</span>}
                </p>
                <Input
                  type="date"
                  value={dueDates[`cf-${item.task_id}`] || toDateInput(item.due_date)}
                  onChange={(e) => setDueDates((prev) => ({ ...prev, [`cf-${item.task_id}`]: e.target.value }))}
                  error={!toDateInput(item.due_date) && !dueDates[`cf-${item.task_id}`] ? 'Required' : undefined}
                />
              </div>
            ))}
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
              return (
                <div key={key} className="grid sm:grid-cols-[1fr_auto_140px] gap-2 items-start">
                  <div>
                    <p className="text-sm text-text-primary">{item.title}</p>
                    {item.missingEffort && (
                      <p className="text-2xs text-accent-danger">Add time required in the list, e.g. #3h or (4hrs)</p>
                    )}
                  </div>
                  <p className="text-xs text-text-muted pt-2">{item.timeLabel || formatHoursLabel(item.estimatedHours)}</p>
                  <Input
                    type="date"
                    value={due}
                    onChange={(e) => setDueDates((prev) => ({ ...prev, [key]: e.target.value }))}
                    error={!due ? 'Required' : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-text-primary">Leave and public holidays</h3>
        {leave ? (
          <p className="text-sm text-text-muted">
            {leave.reporting.working_days} working days last/this period · {leave.planning.working_days} next week.
            Deadlines are not moved automatically.
          </p>
        ) : (
          <p className="text-sm text-text-muted">Loading leave context…</p>
        )}
        <DailyUpdateEditor
          value={leaveNotes}
          onChange={setLeaveNotes}
          users={mentionUsers}
          showExtras={false}
          compact
          placeholder="Anything else about time off this week or next? Use @name if needed."
        />
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
