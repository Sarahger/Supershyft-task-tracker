import { useEffect, useMemo, useState } from 'react';
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
import { STATUS_LABELS } from '../../types';
import type { Task } from '../../types';

interface TaskFormState {
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string;
  project_id: string;
  reviewer_id: string;
  assignee_ids: number[];
  review_required: boolean;
  testing_required: boolean;
  estimated_hours: string;
  actual_hours: string;
}

function toDateInputValue(date?: string | null) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function taskToForm(task: Task): TaskFormState {
  return {
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    status: task.status,
    due_date: toDateInputValue(task.due_date),
    project_id: task.project_id ? String(task.project_id) : '',
    reviewer_id: task.reviewer_id ? String(task.reviewer_id) : '',
    assignee_ids: task.assignees?.map((a) => a.user_id) ?? [],
    review_required: task.review_required,
    testing_required: task.testing_required,
    estimated_hours: task.estimated_hours != null ? String(task.estimated_hours) : '',
    actual_hours: task.actual_hours != null ? String(task.actual_hours) : '',
  };
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

  useEffect(() => {
    const next = taskToForm(task);
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

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      await tasksApi.update(taskId, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date ? new Date(`${form.due_date}T12:00:00`).toISOString() : null,
        project_id: form.project_id ? Number(form.project_id) : null,
        reviewer_id: form.reviewer_id ? Number(form.reviewer_id) : null,
        assignee_ids: form.assignee_ids,
        review_required: form.review_required,
        testing_required: form.testing_required,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        actual_hours: form.actual_hours ? Number(form.actual_hours) : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      setSavedForm(form);
      toast.success('Task updated');
    },
    onError: () => toast.error('Failed to save task'),
  });

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
        {isDirty && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setForm(savedForm)}
              className="text-xs text-text-muted hover:text-text-secondary"
            >
              Discard
            </button>
            <Button size="sm" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              Save changes
            </Button>
          </div>
        )}
      </div>

      <Input
        label="Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />

      <Textarea
        label="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        rows={3}
        placeholder="Add details..."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Status"
          value={form.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
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
          label="Due date"
          type="date"
          value={form.due_date}
          onChange={(e) => setForm({ ...form, due_date: e.target.value })}
        />
        <Input
          label="Time required (hours)"
          type="number"
          min="0"
          step="0.25"
          value={form.estimated_hours}
          onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
          placeholder="e.g. 4"
        />
        <Input
          label="Time taken (hours)"
          type="number"
          min="0"
          step="0.25"
          value={form.actual_hours}
          onChange={(e) => setForm({ ...form, actual_hours: e.target.value })}
          placeholder="e.g. 3.5"
        />
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
