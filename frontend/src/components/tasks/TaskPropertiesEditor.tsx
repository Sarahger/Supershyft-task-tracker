import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { tasksApi, projectsApi, usersApi } from '../../services/endpoints';
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

interface TaskFormState {
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string;
  revised_due_date: string;
  revision_reason: string;
  project_id: string;
  reviewer_id: string;
  assignee_ids: number[];
  review_required: boolean;
  testing_required: boolean;
  time_required: string;
}

function taskToForm(task: Task): TaskFormState {
  const originalDue = toDateInput(task.original_due_date || task.due_date);
  const currentDue = toDateInput(task.due_date);
  const revised = originalDue && currentDue && originalDue !== currentDue ? currentDue : '';
  return {
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    status: task.status,
    due_date: originalDue,
    revised_due_date: revised,
    revision_reason: '',
    project_id: task.project_id ? String(task.project_id) : '',
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

function coreForm(form: TaskFormState) {
  const { revision_reason: _reason, revised_due_date: _revised, ...rest } = form;
  return rest;
}

function sameCore(a: TaskFormState, b: TaskFormState) {
  return JSON.stringify(coreForm(a)) === JSON.stringify(coreForm(b));
}

function pendingRevisedDue(form: TaskFormState, task: Task, dueLocked: boolean) {
  if (!dueLocked) return false;
  const currentDue = toDateInput(task.due_date);
  const nextRevised = form.revised_due_date.trim();
  return Boolean(nextRevised && nextRevised !== currentDue);
}

function revisionNeedsReason(form: TaskFormState, task: Task, dueLocked: boolean) {
  return pendingRevisedDue(form, task, dueLocked) && !form.revision_reason.trim();
}

function canAutosave(form: TaskFormState) {
  if (!form.title.trim()) return false;
  if (form.time_required.trim() && parseDurationInput(form.time_required) == null) return false;
  return true;
}

async function persistTaskProperties(taskId: number, snapshot: TaskFormState, currentTask: Task) {
  const locked = Boolean(currentTask.due_date);
  const currentDue = toDateInput(currentTask.due_date);
  const nextRevised = snapshot.revised_due_date.trim();
  const reason = snapshot.revision_reason.trim();
  if (locked && nextRevised && nextRevised !== currentDue && reason) {
    await tasksApi.reviseDeadline(taskId, {
      reason,
      new_due_date: new Date(`${nextRevised}T12:00:00`).toISOString(),
    });
  }
  const estimatedHours = parseDurationInput(snapshot.time_required);
  await tasksApi.update(taskId, {
    title: snapshot.title.trim(),
    description: snapshot.description.trim() || null,
    priority: snapshot.priority,
    status: snapshot.status,
    ...(locked
      ? {}
      : { due_date: snapshot.due_date ? new Date(`${snapshot.due_date}T12:00:00`).toISOString() : null }),
    project_id: snapshot.project_id ? Number(snapshot.project_id) : null,
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
  const dueLocked = Boolean(task.due_date);
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
    if (pendingRevisedDue(current, task, Boolean(task.due_date))) return;
    const next = taskToForm(task);
    if (sameForm(current, next)) return;
    setForm(next);
    setSavedForm(next);
  }, [task]);

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ page_size: 100 }).then((r) => r.data.data.items),
  });

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
  });

  const isDirty = useMemo(() => !sameForm(form, savedForm), [form, savedForm]);

  const saveMutation = useMutation({
    mutationFn: async (snapshot: TaskFormState) => {
      await persistTaskProperties(taskId, snapshot, taskRef.current);
      return snapshot;
    },
    onSuccess: (_data, snapshot) => {
      setSavedForm(snapshot);
      setTimeRequiredError('');
      if (!revisionNeedsReason(snapshot, taskRef.current, Boolean(taskRef.current.due_date))) {
        setRevisionError('');
      }
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
      const currentTask = taskRef.current;
      const incompleteRevision = revisionNeedsReason(latest, currentTask, Boolean(currentTask.due_date));
      if (incompleteRevision && sameCore(latest, snapshot)) return;
      saveMutation.mutate(latest);
    },
  });

  const mutateSave = saveMutation.mutate;

  const flushSave = (snapshot: TaskFormState = formRef.current) => {
    if (sameForm(snapshot, savedFormRef.current)) return;
    if (!canAutosave(snapshot)) return;
    const currentTask = taskRef.current;
    if (revisionNeedsReason(snapshot, currentTask, Boolean(currentTask.due_date)) && sameCore(snapshot, savedFormRef.current)) {
      return;
    }
    mutateSave(snapshot);
  };

  useEffect(() => {
    if (!isDirty) return;
    if (!canAutosave(form)) {
      if (form.time_required.trim() && parseDurationInput(form.time_required) == null) {
        setTimeRequiredError('Use a duration like 1h or 30m');
      }
      return;
    }
    const incompleteRevision = revisionNeedsReason(form, task, dueLocked);
    if (incompleteRevision) {
      setRevisionError('Add a reason for changing the due date');
      if (sameCore(form, savedForm)) return;
    } else {
      setRevisionError('');
    }
    const timer = window.setTimeout(() => {
      mutateSave(form);
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [form, isDirty, dueLocked, task, savedForm, mutateSave]);

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
      if (revisionNeedsReason(latest, currentTask, Boolean(currentTask.due_date)) && sameCore(latest, saved)) return;
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
          {dueLocked && (
            <p className="text-2xs text-text-muted mt-1">Locked after it is saved. Use revised due date to change it.</p>
          )}
        </div>
        {dueLocked && (
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Revised due date"
              type="date"
              value={form.revised_due_date}
              onChange={(e) => {
                setRevisionError('');
                setForm({ ...form, revised_due_date: e.target.value });
              }}
              onBlur={() => flushSave()}
            />
            <Input
              label="Reason for changing"
              value={form.revision_reason}
              onChange={(e) => {
                setRevisionError('');
                setForm({ ...form, revision_reason: e.target.value });
              }}
              onBlur={() => flushSave()}
              placeholder="Why is the due date changing?"
              error={revisionError || undefined}
            />
          </div>
        )}
        {(task.deadline_revisions && task.deadline_revisions.length > 0) && (
          <div className="sm:col-span-2 rounded-xl border border-dark-border px-3 py-2 space-y-1.5">
            <p className="text-xs font-medium text-text-secondary">Due date history</p>
            {(task.deadline_revisions ?? []).map((rev) => (
              <p key={rev.id} className="text-xs text-text-muted">
                {toDateInput(rev.previous_due_date)} → {toDateInput(rev.new_due_date)}
                {rev.reason ? ` · ${rev.reason}` : ''}
                {rev.changed_by ? ` · ${rev.changed_by.first_name}` : ''}
              </p>
            ))}
          </div>
        )}
        <Select
          label="Project"
          value={form.project_id}
          onChange={(e) => setForm({ ...form, project_id: e.target.value })}
          options={[
            { value: '', label: 'No project' },
            ...(projects ?? []).map((p: { id: number; name: string }) => ({ value: String(p.id), label: p.name })),
          ]}
        />
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
