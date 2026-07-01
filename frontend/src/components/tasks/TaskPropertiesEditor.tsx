import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { tasksApi, projectsApi, usersApi, miscApi, customFieldsApi } from '../../services/endpoints';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { toast } from '../ui/Toast';
import { STATUS_LABELS } from '../../types';
import type { Task } from '../../types';

interface TaskFormState {
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string;
  project_id: string;
  task_type_id: string;
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
    task_type_id: task.task_type?.id ? String(task.task_type.id) : '',
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

  const { data: taskTypes } = useQuery({
    queryKey: ['task-types'],
    queryFn: () => miscApi.taskTypes().then((r) => r.data.data),
  });

  const { data: customFields } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => customFieldsApi.list('task').then((r) => r.data.data),
  });

  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [savedCustomValues, setSavedCustomValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const vals = task.custom_field_values ?? {};
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(vals)) {
      if (v != null) normalized[k] = v;
    }
    setCustomValues(normalized);
    setSavedCustomValues(normalized);
  }, [task.custom_field_values, taskId]);

  const customDirty = useMemo(
    () => JSON.stringify(customValues) !== JSON.stringify(savedCustomValues),
    [customValues, savedCustomValues],
  );

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm) || customDirty,
    [form, savedForm, customDirty]
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
        task_type_id: form.task_type_id ? Number(form.task_type_id) : null,
        reviewer_id: form.reviewer_id ? Number(form.reviewer_id) : null,
        assignee_ids: form.assignee_ids,
        review_required: form.review_required,
        testing_required: form.testing_required,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        actual_hours: form.actual_hours ? Number(form.actual_hours) : null,
      });
      if (customDirty) {
        const values: Record<string, string | null> = {};
        for (const field of customFields ?? []) {
          values[field.field_key] = customValues[field.field_key]?.trim() || null;
        }
        await customFieldsApi.updateTaskValues(taskId, values);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      setSavedForm(form);
      setSavedCustomValues(customValues);
      toast.success('Task updated');
    },
    onError: () => toast.error('Failed to save task'),
  });

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

  const availableAssignees = assigneeOptions.filter(
    (u: UserOption) => !form.assignee_ids.includes(u.id),
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
          onChange={(e) => setForm({ ...form, status: e.target.value })}
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
        {taskTypes && (
          <Select
            label="Task type"
            value={form.task_type_id}
            onChange={(e) => setForm({ ...form, task_type_id: e.target.value })}
            options={[
              { value: '', label: 'None' },
              ...taskTypes.map((t: { id: number; name: string }) => ({ value: String(t.id), label: t.name })),
            ]}
          />
        )}
        <Select
          label="Reviewer"
          value={form.reviewer_id}
          onChange={(e) => setForm({ ...form, reviewer_id: e.target.value })}
          options={[
            { value: '', label: 'No reviewer' },
            ...reviewerOptions.map((u: { id: number; first_name: string; last_name: string }) => ({
              value: String(u.id),
              label: `${u.first_name} ${u.last_name}`,
            })),
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
                  'chip inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1',
                  'bg-blue-500/10 text-blue-200 border border-blue-500/25',
                )}
              >
                <Avatar name={name} size="sm" />
                <span className="text-sm text-text-primary max-w-[8rem] truncate">{name}</span>
                <button
                  type="button"
                  onClick={() => removeAssignee(u.id)}
                  className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
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
          <select
            value=""
            onChange={(e) => addAssignee(Number(e.target.value))}
            className="input mt-2 text-sm"
            aria-label="Add assignee"
          >
            <option value="">Add assignee…</option>
            {availableAssignees.map((u: UserOption) => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.review_required}
            onChange={(e) => setForm({ ...form, review_required: e.target.checked })}
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

      {customFields && customFields.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3">Custom fields</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customFields.map((field) => {
              const value = customValues[field.field_key] ?? '';
              if (field.field_type === 'select') {
                return (
                  <Select
                    key={field.id}
                    label={field.name}
                    value={value}
                    onChange={(e) =>
                      setCustomValues((prev) => ({ ...prev, [field.field_key]: e.target.value }))
                    }
                    options={[
                      { value: '', label: '—' },
                      ...field.options.map((o) => ({ value: o, label: o })),
                    ]}
                  />
                );
              }
              if (field.field_type === 'checkbox') {
                return (
                  <label key={field.id} className="flex items-center gap-2 cursor-pointer pt-6">
                    <input
                      type="checkbox"
                      checked={value === 'true'}
                      onChange={(e) =>
                        setCustomValues((prev) => ({
                          ...prev,
                          [field.field_key]: e.target.checked ? 'true' : '',
                        }))
                      }
                      className="rounded border-dark-border"
                    />
                    <span className="text-sm text-text-secondary">{field.name}</span>
                  </label>
                );
              }
              return (
                <Input
                  key={field.id}
                  label={field.name}
                  type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                  value={value}
                  onChange={(e) =>
                    setCustomValues((prev) => ({ ...prev, [field.field_key]: e.target.value }))
                  }
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
