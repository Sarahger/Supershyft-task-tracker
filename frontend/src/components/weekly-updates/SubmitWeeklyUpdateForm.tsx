import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  estimated_hours?: number | null;
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

type CompletedRow = {
  key: string;
  task_id?: number | null;
  title: string;
  completion_date?: string | null;
  estimated_hours?: number | null;
  source: 'suggested' | 'manual';
  is_delayed?: boolean;
  is_carried_forward?: boolean;
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const DUE_DATE_EDIT_MS = 24 * 60 * 60 * 1000;

function isDueDateLocked(item?: { due_date_locked?: boolean; created_at?: string | null } | null) {
  if (!item) return false;
  if (typeof item.due_date_locked === 'boolean') return item.due_date_locked;
  if (!item.created_at) return false;
  return Date.now() >= new Date(item.created_at).getTime() + DUE_DATE_EDIT_MS;
}

export function SubmitWeeklyUpdateForm({
  periodStart,
  existing,
  onClose,
}: {
  periodStart: string;
  existing?: {
    completions: WeeklyCompletion[];
    commitments: WeeklyCommitment[];
    current_week_tasks?: WeeklyCommitment[];
  };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [currentPlanText, setCurrentPlanText] = useState('1. ');
  const [dueDates, setDueDates] = useState<Record<string, string>>({});
  const [revisionReasons, setRevisionReasons] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

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

  const currentWeekTasks = carry?.current_week_tasks ?? [
    ...(carry?.items ?? []),
    ...((carry?.working_week_ended ? [] : carry?.due_this_week) ?? []),
  ];
  const carried = currentWeekTasks.filter(
    (item) => item.is_carried_forward || item.commitment_type === 'carried_forward',
  );
  const dueCurrentWeek = currentWeekTasks.filter(
    (item) => !(item.is_carried_forward || item.commitment_type === 'carried_forward'),
  );
  const structuredTaskIds = new Set(
    currentWeekTasks.map((item) => item.task_id).filter((id): id is number => id != null),
  );
  const structuredTitles = new Set(
    currentWeekTasks.map((item) => item.title.trim().toLowerCase()),
  );

  useEffect(() => {
    if (initialized) return;
    if (suggestions === undefined || carry === undefined) return;

    // Restore typed current-week commitments that are not already in the live bucket.
    const planLines: string[] = [];
    const dates: Record<string, string> = {};
    const liveCurrent = carry?.current_week_tasks ?? [
      ...(carry?.items ?? []),
      ...((carry?.working_week_ended ? [] : carry?.due_this_week) ?? []),
    ];
    const skipIds = new Set(
      liveCurrent.map((item) => item.task_id).filter((id): id is number => id != null),
    );
    const skipTitles = new Set(
      liveCurrent.map((item) => item.title.trim().toLowerCase()),
    );
    // Prefer current_week_tasks — on editable reports `commitments` still mirrors next-week rows.
    (existing?.current_week_tasks ?? [])
      .filter((c) => {
        if (c.commitment_type === 'carried_forward') return false;
        if (c.task_id && skipIds.has(c.task_id)) return false;
        if (skipTitles.has(c.title.trim().toLowerCase())) return false;
        return true;
      })
      .forEach((item, i) => {
        const hours = item.estimated_hours != null ? ` (${formatHoursLabel(item.estimated_hours)})` : '';
        planLines.push(`${i + 1}. ${item.title}${hours}`);
        if (item.due_date) dates[`cw-new:${item.title.trim().toLowerCase()}`] = toDateInput(item.due_date);
      });
    setCurrentPlanText(planLines.join('\n') || '1. ');
    setDueDates(dates);
    setInitialized(true);
  }, [initialized, suggestions, carry, existing]);

  const completedTasks = useMemo((): CompletedRow[] => {
    const rows: CompletedRow[] = [];
    const seenIds = new Set<number>();
    for (const item of existing?.completions ?? []) {
      if (item.task_id) {
        if (seenIds.has(item.task_id)) continue;
        seenIds.add(item.task_id);
        rows.push({
          key: `done-${item.task_id}`,
          task_id: item.task_id,
          title: item.title,
          completion_date: item.completion_date,
          estimated_hours: item.estimated_hours,
          source: item.source === 'manual' ? 'manual' : 'suggested',
          is_delayed: item.is_delayed,
          is_carried_forward: item.is_carried_forward,
        });
      } else if (item.title) {
        rows.push({
          key: `manual-${item.title}-${rows.length}`,
          task_id: null,
          title: item.title,
          completion_date: item.completion_date,
          estimated_hours: item.estimated_hours,
          source: 'manual',
          is_delayed: item.is_delayed,
          is_carried_forward: item.is_carried_forward,
        });
      }
    }
    for (const item of suggestions?.items ?? []) {
      if (!item.task_id || seenIds.has(item.task_id)) continue;
      seenIds.add(item.task_id);
      rows.push({
        key: `done-${item.task_id}`,
        task_id: item.task_id,
        title: item.title,
        completion_date: item.completion_date,
        estimated_hours: item.estimated_hours,
        source: 'suggested',
        is_delayed: item.is_delayed,
        is_carried_forward: item.is_carried_forward,
      });
    }
    return rows;
  }, [existing, suggestions]);

  const parsedCurrentPlan = useMemo(
    () => parseWeeklyPlanList(currentPlanText, { periodStart, weekScope: 'current' }),
    [currentPlanText, periodStart],
  );
  const openPlanItems = useMemo(
    () => parsedCurrentPlan.items.filter((item) => !item.alreadyCompleted),
    [parsedCurrentPlan],
  );
  const completedPlanItems = useMemo(
    () => parsedCurrentPlan.items.filter((item) => item.alreadyCompleted),
    [parsedCurrentPlan],
  );
  const completedViaPlanIds = useMemo(() => {
    const ids = new Set<number>();
    for (const item of completedPlanItems) {
      const titleKey = item.title.trim().toLowerCase();
      const weekMatch = currentWeekTasks.find((t) => t.title.trim().toLowerCase() === titleKey);
      if (weekMatch?.task_id) {
        ids.add(weekMatch.task_id);
        continue;
      }
      const trackerMatch = (myTasks ?? []).find((t: Task) => t.title.trim().toLowerCase() === titleKey);
      if (trackerMatch?.id) ids.add(trackerMatch.id);
    }
    return ids;
  }, [completedPlanItems, currentWeekTasks, myTasks]);

  const mutation = useMutation({
    mutationFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const completions: CompletionDraft[] = [];
      const seen = new Set<number>();

      // View-only completed list — always include everything already shown.
      for (const task of completedTasks) {
        if (task.task_id) {
          if (seen.has(task.task_id)) continue;
          seen.add(task.task_id);
        }
        completions.push({
          key: task.key,
          task_id: task.task_id ?? null,
          title: task.title,
          completion_date: task.completion_date || today,
          estimated_hours: task.estimated_hours,
          source: task.source,
          included: true,
        });
      }

      // Weekly-task lines marked *completed → completed list with today's date.
      for (const item of completedPlanItems) {
        if (!item.title.trim()) continue;
        const titleKey = item.title.trim().toLowerCase();
        const weekMatch = currentWeekTasks.find((t) => t.title.trim().toLowerCase() === titleKey);
        const trackerMatch = (myTasks ?? []).find((t: Task) => t.title.trim().toLowerCase() === titleKey);
        const existingMatch = completedTasks.find((t) => t.title.trim().toLowerCase() === titleKey);
        const matchId = weekMatch?.task_id ?? trackerMatch?.id ?? existingMatch?.task_id ?? null;

        if (matchId && seen.has(matchId)) continue;

        if (!matchId) {
          if (item.missingEffort || item.estimatedHours == null) {
            throw new Error(`Add time taken for “${item.title}”, e.g. #3h`);
          }
        }

        const hours =
          item.estimatedHours
          ?? weekMatch?.estimated_hours
          ?? trackerMatch?.estimated_hours
          ?? existingMatch?.estimated_hours
          ?? null;

        completions.push({
          key: newKey(),
          task_id: matchId,
          title: weekMatch?.title ?? trackerMatch?.title ?? item.title,
          completion_date: item.completionDate || today,
          estimated_hours: hours,
          source: matchId ? 'suggested' : 'manual',
          included: true,
        });
        if (matchId) seen.add(matchId);
      }

      const trackerDraft = (
        item: WeeklyCommitment,
        kind: 'carried_forward' | 'existing',
        prefix: 'cf' | 'cw',
      ): CommitmentDraft | null => {
        if (item.task_id && completedViaPlanIds.has(item.task_id)) return null;
        const key = `${prefix}-${item.task_id}`;
        const currentDue = toDateInput(item.due_date);
        const nextDue = dueDates[key] || currentDue;
        return {
          key,
          task_id: item.task_id,
          title: item.title,
          description: item.description ?? '',
          estimated_hours: item.estimated_hours != null ? String(item.estimated_hours) : '',
          due_date: nextDue,
          commitment_type: kind,
          revision_reason: nextDue && currentDue && nextDue !== currentDue ? (revisionReasons[key] || '') : '',
          is_overdue: item.is_overdue,
          original_due_date: item.original_due_date,
        };
      };
      const typedDraft = (
        item: { title: string; estimatedHours: number | null; dueDate: string | null },
      ): CommitmentDraft | null => {
        const match = (myTasks ?? []).find((t: Task) => t.title.trim().toLowerCase() === item.title.trim().toLowerCase());
        if (match && structuredTaskIds.has(match.id)) return null;
        if (match && completedViaPlanIds.has(match.id)) return null;
        if (structuredTitles.has(item.title.trim().toLowerCase())) return null;
        const key = `cw-new:${item.title.trim().toLowerCase()}`;
        const nextDue = dueDates[key] || item.dueDate || '';
        const currentDue = match ? toDateInput(match.due_date) : '';
        return {
          key: `cw-new-${item.title}`,
          task_id: match?.id ?? null,
          title: item.title,
          description: '',
          estimated_hours: item.estimatedHours != null ? String(item.estimatedHours) : '',
          due_date: nextDue,
          commitment_type: (match ? 'existing' : 'new') as 'existing' | 'new',
          revision_reason: match && currentDue && nextDue && nextDue !== currentDue ? (revisionReasons[key] || '') : '',
        };
      };

      const plan: CommitmentDraft[] = [
        ...carried.map((item) => trackerDraft(item, 'carried_forward', 'cf')),
        ...dueCurrentWeek.map((item) => trackerDraft(item, 'existing', 'cw')),
        ...openPlanItems
          .map((item) => typedDraft(item))
          .filter((item): item is CommitmentDraft => item != null),
      ].filter((item): item is CommitmentDraft => item != null);

      for (const item of plan) {
        if (!item.title.trim()) continue;
        if (!item.due_date) throw new Error(`Add a due date for “${item.title}”`);
        const hours = Number(item.estimated_hours);
        if (!hours || hours <= 0) throw new Error(`Add time required for “${item.title}”`);
        const source = item.commitment_type === 'carried_forward'
          ? carried.find((c) => c.task_id === item.task_id)
          : dueCurrentWeek.find((c) => c.task_id === item.task_id)
            ?? (myTasks ?? []).find((t: Task) => t.id === item.task_id)
            ?? existing?.commitments.find((c) => c.task_id === item.task_id || c.title.trim().toLowerCase() === item.title.trim().toLowerCase());
        const previousDue = item.commitment_type === 'carried_forward'
          ? toDateInput(carried.find((c) => c.task_id === item.task_id)?.due_date)
          : toDateInput(
            dueCurrentWeek.find((c) => c.task_id === item.task_id)?.due_date
              ?? (myTasks ?? []).find((t: Task) => t.id === item.task_id)?.due_date
              ?? existing?.commitments.find((c) => c.title.trim().toLowerCase() === item.title.trim().toLowerCase())?.due_date,
          );
        if (previousDue && item.due_date !== previousDue && isDueDateLocked(source) && !item.revision_reason.trim()) {
          throw new Error(`Add a reason for changing the due date of “${item.title}”`);
        }
      }

      const mentionSource = [currentPlanText, ...completions.map((c) => c.title), ...plan.map((c) => c.title)].join('\n');

      return weeklyUpdatesApi.upsert({
        period_start: periodStart,
        mentioned_user_ids: extractMentionedUserIds(mentionSource, mentionUsers),
        completions: completions.map((c) => ({
          task_id: c.task_id ?? null,
          title: c.title.trim(),
          completion_date: c.completion_date || null,
          estimated_hours: c.estimated_hours ?? null,
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
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
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

  const visibleCarried = carried.filter((item) => !(item.task_id && completedViaPlanIds.has(item.task_id)));
  const visibleDueCurrent = dueCurrentWeek.filter((item) => !(item.task_id && completedViaPlanIds.has(item.task_id)));

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-text-primary">Write weekly update</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Week of {carry?.period_start && carry?.period_end
              ? `${format(parseISO(carry.period_start), 'd MMM')} – ${format(parseISO(carry.period_end), 'd MMM yyyy')}`
              : format(parseISO(periodStart), 'd MMM yyyy')} · Type @ to tag someone
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-text-muted hover:text-text-secondary">
          Cancel
        </button>
      </header>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">Weekly Tasks</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Incomplete tasks due this working week, including carried-forward work. Add new ones below — they are saved in the Task Tracker. Add <span className="text-text-secondary">*completed</span> on a line to move it to Completed Tasks (uses today&apos;s date). Yellow means carried forward from an earlier week.
          </p>
        </div>
        <div className="rounded-xl border border-dark-border px-3 py-2 space-y-2">
          {visibleCarried.length === 0 && visibleDueCurrent.length === 0 ? (
            <p className="text-sm text-text-muted">No tasks yet</p>
          ) : null}
          {visibleCarried.length > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-medium text-amber-400">Carried forward</p>
              <p className="text-2xs text-text-muted">
                <span className="text-amber-400">Yellow</span> = carried forward
              </p>
            </div>
          )}
          {visibleCarried.map((item) => {
            const key = `cf-${item.task_id}`;
            const currentDue = toDateInput(item.due_date);
            const nextDue = dueDates[key] || currentDue;
            const dateChanged = Boolean(nextDue && currentDue && nextDue !== currentDue);
            const locked = isDueDateLocked(item);
            const needsRevision = dateChanged && locked;
            return (
              <div key={`cf-${item.task_id ?? item.title}`} className="space-y-2">
                <div className="grid sm:grid-cols-[1fr_140px] gap-2 items-center">
                  <p className="text-sm text-amber-400">
                    {item.title}
                    {item.is_overdue && <span className="ml-2 text-2xs text-accent-danger">Overdue</span>}
                  </p>
                  <Input
                    label={needsRevision ? 'Revised due date' : undefined}
                    type="date"
                    value={nextDue}
                    onChange={(e) => setDueDates((prev) => ({ ...prev, [key]: e.target.value }))}
                    error={!nextDue ? 'Required' : undefined}
                  />
                </div>
                {needsRevision && (
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
          {visibleDueCurrent.length > 0 && (
            <p className="text-xs font-medium text-text-secondary pt-1">Due this week</p>
          )}
          {visibleDueCurrent.map((item) => {
            const key = `cw-${item.task_id}`;
            const currentDue = toDateInput(item.due_date);
            const nextDue = dueDates[key] || currentDue;
            const dateChanged = Boolean(nextDue && currentDue && nextDue !== currentDue);
            const locked = isDueDateLocked(item);
            const needsRevision = dateChanged && locked;
            return (
              <div key={`cw-${item.task_id ?? item.title}`} className="space-y-2">
                <div className="grid sm:grid-cols-[1fr_auto_140px] gap-2 items-center">
                  <p className="text-sm text-text-primary">{item.title}</p>
                  <p className="text-xs text-text-muted">
                    {item.estimated_hours != null ? formatHoursLabel(item.estimated_hours) : 'Add time required'}
                  </p>
                  <Input
                    label={needsRevision ? 'Revised due date' : undefined}
                    type="date"
                    value={nextDue}
                    onChange={(e) => setDueDates((prev) => ({ ...prev, [key]: e.target.value }))}
                    error={!nextDue ? 'Required' : undefined}
                  />
                </div>
                {item.estimated_hours == null && (
                  <p className="text-2xs text-accent-danger">Add time required on this task</p>
                )}
                {needsRevision && (
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
        <DailyUpdateEditor
          value={currentPlanText}
          onChange={setCurrentPlanText}
          users={mentionUsers}
          showExtras={false}
          numberedList
          placeholder={'Finish onboarding flow /friday #3h\nShip docs #2h *completed'}
        />
        {completedPlanItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-secondary">
              {completedPlanItems.length} item{completedPlanItems.length === 1 ? '' : 's'} marked *completed — will move to Completed Tasks with today&apos;s date.
            </p>
            {completedPlanItems.map((item) => (
              <div key={item.rawLine} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-text-primary">{item.title}</p>
                  {item.missingEffort && (
                    <p className="text-2xs text-accent-danger">Add time taken, e.g. #3h or #3hr</p>
                  )}
                </div>
                <p className="shrink-0 text-xs tabular-nums text-text-muted pt-0.5">
                  {[item.timeLabel, item.completionDate ? format(parseISO(item.completionDate), 'd MMM') : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            ))}
          </div>
        )}
        {openPlanItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-secondary">Review due dates</p>
            {openPlanItems.map((item) => {
              const key = `cw-new:${item.title.trim().toLowerCase()}`;
              const due = dueDates[key] || item.dueDate || '';
              const match = (myTasks ?? []).find((t: Task) => t.title.trim().toLowerCase() === item.title.trim().toLowerCase());
              const existingItem = existing?.commitments.find((c) => c.title.trim().toLowerCase() === item.title.trim().toLowerCase());
              const currentDue = toDateInput(match?.due_date || existingItem?.due_date);
              const dateChanged = Boolean((match || existingItem) && currentDue && due && due !== currentDue);
              const locked = isDueDateLocked(match ?? existingItem);
              const needsRevision = dateChanged && locked;
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
                      label={needsRevision ? 'Revised due date' : undefined}
                      type="date"
                      value={due}
                      onChange={(e) => setDueDates((prev) => ({ ...prev, [key]: e.target.value }))}
                      error={!due ? 'Required' : undefined}
                    />
                  </div>
                  {needsRevision && (
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

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">Completed Tasks</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Tasks completed this week (view only). Mark new completions in Weekly Tasks with <span className="text-text-secondary">*completed</span>.
          </p>
        </div>
        {completedTasks.length > 0 ? (
          <ol className="space-y-1">
            {completedTasks.map((task, i) => {
              const timeLabel = task.estimated_hours != null ? formatHoursLabel(task.estimated_hours) : null;
              const doneLabel = task.completion_date
                ? format(parseISO(task.completion_date), 'd MMM')
                : null;
              const delayed = Boolean(task.is_delayed || task.is_carried_forward);
              return (
                <li key={task.key} className="flex items-start gap-2">
                  <span className="text-text-muted select-none shrink-0 w-4 text-right text-sm pt-0.5">{i + 1}.</span>
                  <div className="min-w-0 flex-1 flex items-start justify-between gap-4">
                    <p className="text-[15px] leading-relaxed text-text-primary">
                      {task.title}
                    </p>
                    {timeLabel || doneLabel ? (
                      <p className="shrink-0 text-xs tabular-nums pt-1 text-right text-text-muted">
                        {timeLabel}
                        {timeLabel && doneLabel ? ' · ' : null}
                        {doneLabel ? (
                          <>
                            <span className={delayed ? 'text-amber-400' : undefined}>Completed</span> {doneLabel}
                          </>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-text-muted">No tasks yet</p>
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
