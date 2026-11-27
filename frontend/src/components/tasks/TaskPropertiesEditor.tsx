import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { tasksApi, usersApi } from '../../services/endpoints';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { toast } from '../ui/Toast';
import { AssigneeMentionInput } from './AssigneeMentionInput';
import { statusSelectOptions } from '../../types';
import type { Task } from '../../types';
import { formatTimeTakenHours, parseDurationInput } from '../../lib/taskTiming';
import { toDateInput } from '../../lib/weeklyPlanParse';

const AUTOSAVE_MS = 500;
const DUE_DATE_EDIT_MS = 24 * 60 * 60 * 1000;

function isTaskDueDateLocked(task: Task) {
  if (typeof task.due_date_locked === 'boolean') return task.due_date_locked;
  if (!task.created_at) return Boolean(task.due_date);
  return Date.now() >= new Date(task.created_at).getTime() + DUE_DATE_EDIT_MS;
}

interface TaskFormState {
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string;
  reviewer_id: string;
  assignee_ids: number[];
  review_required: boolean;
  testing_required: boolean;
  time_required: string;
}

function taskToForm(task: Task): TaskFormState {
  const locked = isTaskDueDateLocked(task);
  const originalDue = toDateInput(task.original_due_date || task.due_date);
  const currentDue = toDateInput(task.due_date);
  return {
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    status: task.status,
    due_date: locked ? originalDue : currentDue,
    reviewer_id: task.reviewer_id ? String(task.reviewer_id) : '',
    assignee_ids: task.assignees?.map((a) => a.user_id) ?? [],
    review_required: task.review_required,
    testing_required: task.testing_required,
    time_required: formatTimeTakenHours(task.estimated_hours) ?? '',
  };
}

function sameForm(a: TaskFormState, b: TaskFormState) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function canAutosave(form: TaskFormState) {
  if (!form.title.trim()) return false;
  if (form.time_required.trim() && parseDurationInput(form.time_required) == null) return false;
  return true;
}

async function persistTaskProperties(
  taskId: number,
  snapshot: TaskFormState,
  currentTask: Task,
) {
  const locked = isTaskDueDateLocked(currentTask);
  const estimatedHours = parseDurationInput(snapshot.time_required);
  await tasksApi.update(taskId, {
    title: snapshot.title.trim(),
    description: snapshot.description.trim() || null,
    priority: snapshot.priority,
    status: snapshot.status,
    ...(locked
      ? {}
      : { due_date: snapshot.due_date ? new Date(`${snapshot.due_date}T12:00:00`).toISOString() : null }),
    reviewer_id: snapshot.reviewer_id ? Number(snapshot.reviewer_id) : null,
    assignee_ids: snapshot.assignee_ids,
    review_required: snapshot.review_required,
    testing_required: snapshot.testing_required,
    estimated_hours: estimatedHours,
  });
}

interface TaskPropertiesEditorProps {
  task: Task;
  taskId: number;
}

export function TaskPropertiesEditor({ task, taskId }: TaskPropertiesEditorProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<TaskFormState>(() => taskToForm(task));
  const [savedForm, setSavedForm] = useState<TaskFormState>(() => taskToForm(task));
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReasonInput, setBlockReasonInput] = useState('');
  const [timeRequiredError, setTimeRequiredError] = useState('');
  const [revisionError, setRevisionError] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  // Completely separate from autosaved form — typing here never triggers a save.
  const [revisedDueDate, setRevisedDueDate] = useState(() => toDateInput(task.due_date));
  const [revisionReason, setRevisionReason] = useState('');
  const revisionDraftTouched = useRef(false);
  const dueLocked = isTaskDueDateLocked(task);
  const formRef = useRef(form);
  const savedFormRef = useRef(savedForm);
  const taskRef = useRef(task);
  formRef.current = form;
  savedFormRef.current = savedForm;
  taskRef.current = task;

  useEffect(() => {
    const current = formRef.current;
    const saved = savedFormRef.current;
    if (!sameForm(current, saved)) return;
    const next = taskToForm(task);
    if (sameForm(current, next)) return;
    setForm(next);
    setSavedForm(next);
  }, [task]);

  // Keep the revised-due field showing the latest saved due date unless the user is editing it.
  useEffect(() => {
    revisionDraftTouched.current = false;
    setRevisedDueDate(toDateInput(task.due_date));
    setRevisionReason('');
    setRevisionError('');
  }, [task.id]);

  useEffect(() => {
    if (revisionDraftTouched.current) return;
    setRevisedDueDate(toDateInput(task.due_date));
  }, [task.due_date]);

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
  });

  const isDirty = useMemo(() => !sameForm(form, savedForm), [form, savedForm]);
  const revisionPending = Boolean(
    dueLocked
    && revisedDueDate.trim()
    && revisedDueDate.trim() !== toDateInput(task.due_date),
  );
  const canSaveRevision = revisionPending && Boolean(revisionReason.trim());

  const saveMutation = useMutation({
    mutationFn: async (snapshot: TaskFormState) => {
      await persistTaskProperties(taskId, snapshot, taskRef.current);
      return snapshot;
    },
    onSuccess: (_data, snapshot) => {
      setSavedForm(snapshot);
      setTimeRequiredError('');
      setJustSaved(true);
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['weekly-updates'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as Error)?.message
        || (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data?.detail
        || (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to save task';
      toast.error(typeof message === 'string' ? message : 'Failed to save task');
    },
    onSettled: (_data, _error, snapshot) => {
      const latest = formRef.current;
      if (sameForm(latest, snapshot)) return;
      if (!canAutosave(latest)) return;
      saveMutation.mutate(latest);
    },
  });

  const revisionMutation = useMutation({
    mutationFn: async ({ due, reason }: { due: string; reason: string }) => {
      await tasksApi.reviseDeadline(taskId, {
        reason,
        new_due_date: new Date(`${due}T12:00:00`).toISOString(),
      });
      return { due, reason };
    },
    onSuccess: (_data, vars) => {
      revisionDraftTouched.current = false;
      setRevisedDueDate(vars.due);
      setRevisionReason('');
      setRevisionError('');
      toast.success('Due date updated');
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['weekly-updates'] });
    },
    onError: (err: unknown) => {
      const message =
        (err as Error)?.message
        || (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data?.detail
        || (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to update due date';
      toast.error(typeof message === 'string' ? message : 'Failed to update due date');
    },
  });

  const mutateSave = saveMutation.mutate;

  const flushSave = (snapshot: TaskFormState = formRef.current) => {
    if (sameForm(snapshot, savedFormRef.current)) return;
    if (!canAutosave(snapshot)) return;
    mutateSave(snapshot);
  };

  const saveDeadlineRevision = () => {
    const due = revisedDueDate.trim();
    const reason = revisionReason.trim();
    if (!due) {
      setRevisionError('Pick a revised due date');
      return;
    }
    if (due === toDateInput(taskRef.current.due_date)) {
      setRevisionError('Choose a new due date that is different from the current one');
      return;
    }
    if (!reason) {
      setRevisionError('Add a reason for changing the due date');
      return;
    }
    setRevisionError('');
    revisionMutation.mutate({ due, reason });
  };

  useEffect(() => {
    if (!isDirty) return;
    if (!canAutosave(form)) {
      if (form.time_required.trim() && parseDurationInput(form.time_required) == null) {
        setTimeRequiredError('Use a duration like 1h or 30m');
      }
      return;
    }
    const timer = window.setTimeout(() => {
      mutateSave(form);
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [form, isDirty, mutateSave]);

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => setJustSaved(false), 1600);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  useEffect(() => {
    return () => {
      const latest = formRef.current;
      const saved = savedFormRef.current;
      const currentTask = taskRef.current;
      if (sameForm(latest, saved)) return;
      if (!canAutosave(latest)) return;
      void persistTaskProperties(taskId, latest, currentTask).catch(() => undefined);
    };
  }, [taskId]);

  const blockMutation = useMutation({
    mutationFn: (reason: string) => tasksApi.block(taskId, reason),
    onSuccess: () => {
      const next = { ...form, status: 'blocked' };
      setForm(next);
      setSavedForm(next);
      setShowBlockModal(false);
      setBlockReasonInput('');
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Task blocked');
    },
    onError: () => toast.error('Failed to block task'),
  });

  const handleStatusChange = (nextStatus: string) => {
    if (nextStatus === 'blocked' && savedForm.status !== 'blocked') {
      setShowBlockModal(true);
      return;
    }
    setForm({ ...form, status: nextStatus });
  };

  const removeAssignee = (userId: number) => {
    setForm((prev) => ({
      ...prev,
      assignee_ids: prev.assignee_ids.filter((id) => id !== userId),
      reviewer_id: prev.reviewer_id === String(userId) ? '' : prev.reviewer_id,
    }));
  };

  const addAssignee = (userId: number) => {
    if (!userId || form.assignee_ids.includes(userId)) return;
    setForm((prev) => ({
      ...prev,
      assignee_ids: [...prev.assignee_ids, userId],
    }));
  };

  const setReviewer = (userId: number) => {
    setForm((prev) => ({ ...prev, reviewer_id: String(userId) }));
  };

  const removeReviewer = () => {
    setForm((prev) => ({ ...prev, reviewer_id: '' }));
  };

  const assigneeOptions = users ?? [];
  const reviewerOptions = assigneeOptions.filter((u: { id: number }) => !form.assignee_ids.includes(u.id));

  type UserOption = { id: number; first_name: string; last_name: string };
  const assigneeUsers = useMemo(() => {
    return form.assignee_ids
      .map((id) => {
        const fromList = assigneeOptions.find((u: UserOption) => u.id === id);
        if (fromList) return fromList;
        const fromTask = task.assignees?.find((a) => a.user_id === id)?.user;
        if (fromTask) return { id, first_name: fromTask.first_name, last_name: fromTask.last_name };
        return null;
      })
      .filter(Boolean) as UserOption[];
  }, [form.assignee_ids, assigneeOptions, task.assignees]);

  const reviewerUser = useMemo(() => {
    if (!form.reviewer_id) return null;
    const id = Number(form.reviewer_id);
    const fromList = assigneeOptions.find((u: UserOption) => u.id === id);
    if (fromList) return fromList;
    if (task.reviewer) return { id, first_name: task.reviewer.first_name, last_name: task.reviewer.last_name };
    return null;
  }, [form.reviewer_id, assigneeOptions, task.reviewer]);

  const availableAssignees = assigneeOptions.filter(
    (u: UserOption) => !form.assignee_ids.includes(u.id),
  );

  const availableReviewers = reviewerOptions.filter(
    (u: UserOption) => String(u.id) !== form.reviewer_id,
  );

  return (
    <div className="space-y-4 pb-6 border-b border-dark-border">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Properties</p>
        <p className="text-2xs text-text-muted tabular-nums h-4">
          {saveMutation.isPending ? 'Saving…' : justSaved ? 'Saved' : ''}
        </p>
      </div>

      <Input
        label="Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        onBlur={() => flushSave()}
      />

      <Textarea
        label="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        onBlur={() => flushSave()}
        rows={3}
        placeholder="Add details..."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Status"
          value={form.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          options={statusSelectOptions(form.status)}
        />
        <Select
          label="Priority"
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'critical', label: 'Critical' },
          ]}
        />
        <Input
          label="Time required"
          value={form.time_required}
          onChange={(e) => {
            setTimeRequiredError('');
            setForm({ ...form, time_required: e.target.value });
          }}
          onBlur={() => flushSave()}
          placeholder="e.g. 1h or 30m"
          error={timeRequiredError || undefined}
        />
        <div>
          <Input
            label="Due date"
            type="date"
            value={form.due_date}
            disabled={dueLocked}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            onBlur={() => flushSave()}
          />
          <p className="text-2xs text-text-muted mt-1">
            {dueLocked
              ? 'Locked 24 hours after the task was created. Use revised due date to change it.'
              : 'You can change this for 24 hours after the task is created.'}
          </p>
        </div>
        {dueLocked && (
          <div className="sm:col-span-2 rounded-xl border border-dark-border bg-dark-elevated/40 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-secondary">Change due date</p>
                <p className="text-2xs text-text-muted mt-0.5">
                  Nothing is saved until you click Update due date.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                loading={revisionMutation.isPending}
                disabled={!canSaveRevision || revisionMutation.isPending}
                onClick={saveDeadlineRevision}
              >
                Update due date
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Revised due date"
                type="date"
                value={revisedDueDate}
                onChange={(e) => {
                  revisionDraftTouched.current = true;
                  setRevisionError('');
                  setRevisedDueDate(e.target.value);
                }}
              />
              <Input
                label="Reason for changing"
                value={revisionReason}
                onChange={(e) => {
                  revisionDraftTouched.current = true;
                  setRevisionError('');
                  setRevisionReason(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (canSaveRevision) saveDeadlineRevision();
                  }
                }}
                placeholder="Why is the due date changing?"
                error={revisionError || undefined}
              />
            </div>
          </div>
        )}
        {(task.deadline_revisions && task.deadline_revisions.length > 0) && (
          <div className="sm:col-span-2 rounded-xl border border-dark-border px-3 py-2 space-y-1.5">
            <p className="text-xs font-medium text-text-secondary">Due date history</p>
            {[...(task.deadline_revisions ?? [])]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((rev) => (
              <p key={rev.id} className="text-xs text-text-muted">
                {toDateInput(rev.previous_due_date)} → {toDateInput(rev.new_due_date)}
                {rev.reason ? ` · ${rev.reason}` : ''}
                {rev.changed_by ? ` · ${rev.changed_by.first_name}` : ''}
              </p>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">Assignees</label>
        <div className="flex flex-wrap gap-2 min-h-[2rem]">
          {assigneeUsers.length ? assigneeUsers.map((u) => {
            const name = `${u.first_name} ${u.last_name}`;
            return (
              <span
                key={u.id}
                className={clsx(
                  'chip badge-todo inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 border border-dark-border',
                )}
              >
                <Avatar name={name} size="sm" />
                <span className="text-sm text-text-primary max-w-[8rem] truncate">{name}</span>
                <button
                  type="button"
                  onClick={() => removeAssignee(u.id)}
                  className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-surface-active transition-colors"
                  aria-label={`Remove ${name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            );
          }) : (
            <p className="text-sm text-text-muted py-1">No assignees yet</p>
          )}
        </div>
        {availableAssignees.length > 0 && (
          <AssigneeMentionInput
            users={availableAssignees}
            onSelect={addAssignee}
            className="mt-2"
          />
        )}
      </div>

      <Modal
        isOpen={showBlockModal}
        onClose={() => {
          setShowBlockModal(false);
          setBlockReasonInput('');
        }}
        title="Block task"
        size="sm"
      >
        <p className="text-sm text-text-secondary mb-3">Please provide a reason for blocking this task.</p>
        <Textarea
          value={blockReasonInput}
          onChange={(e) => setBlockReasonInput(e.target.value)}
          placeholder="Why is this blocked?"
          rows={3}
          className="text-sm mb-4"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setShowBlockModal(false);
              setBlockReasonInput('');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => blockMutation.mutate(blockReasonInput.trim())}
            disabled={!blockReasonInput.trim() || blockMutation.isPending}
            loading={blockMutation.isPending}
          >
            Block task
          </Button>
        </div>
      </Modal>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.review_required}
            onChange={(e) => {
              const checked = e.target.checked;
              setForm({
                ...form,
                review_required: checked,
                reviewer_id: checked ? form.reviewer_id : '',
              });
            }}
            className="rounded border-dark-border"
          />
          <span className="text-text-secondary">Review required</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.testing_required}
            onChange={(e) => setForm({ ...form, testing_required: e.target.checked })}
            className="rounded border-dark-border"
          />
          <span className="text-text-secondary">Testing required</span>
        </label>
      </div>

      {form.review_required && (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">Reviewer</label>
          {reviewerUser ? (
            <div className="flex flex-wrap gap-2">
              <span
                className={clsx(
                  'chip badge-todo inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 border border-dark-border',
                )}
              >
                <Avatar name={`${reviewerUser.first_name} ${reviewerUser.last_name}`} size="sm" />
                <span className="text-sm text-text-primary max-w-[8rem] truncate">
                  {reviewerUser.first_name} {reviewerUser.last_name}
                </span>
                <button
                  type="button"
                  onClick={removeReviewer}
                  className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-surface-active transition-colors"
                  aria-label={`Remove reviewer ${reviewerUser.first_name} ${reviewerUser.last_name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          ) : availableReviewers.length > 0 ? (
            <AssigneeMentionInput
              users={availableReviewers}
              onSelect={setReviewer}
              placeholder="Type @name to assign reviewer…"
            />
          ) : (
            <p className="text-sm text-text-muted">
              Add a team member who is not already an assignee, or remove an assignee to pick them as reviewer.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
