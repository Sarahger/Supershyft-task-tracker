import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { toast } from '../ui/Toast';
import { tasksApi, projectsApi, usersApi } from '../../services/endpoints';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateTaskModal({ isOpen, onClose }: CreateTaskModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'unassigned',
    project_id: '',
    due_date: '',
    assignee_ids: [] as number[],
    review_required: false,
    testing_required: false,
  });
  const qc = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ page_size: 100 }).then((r) => r.data.data.items),
    enabled: isOpen,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
    enabled: isOpen,
  });

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      priority: 'medium',
      status: 'unassigned',
      project_id: '',
      due_date: '',
      assignee_ids: [],
      review_required: false,
      testing_required: false,
    });
    setShowAdvanced(false);
  };

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => tasksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Task created');
      onClose();
      resetForm();
    },
    onError: () => toast.error('Failed to create task'),
  });

  const toggleAssignee = (userId: number) => {
    setForm((prev) => ({
      ...prev,
      assignee_ids: prev.assignee_ids.includes(userId)
        ? prev.assignee_ids.filter((id) => id !== userId)
        : [...prev.assignee_ids, userId],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    mutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      priority: form.priority,
      status: form.status,
      project_id: form.project_id ? Number(form.project_id) : undefined,
      due_date: form.due_date ? new Date(`${form.due_date}T12:00:00`).toISOString() : undefined,
      assignee_ids: form.assignee_ids,
      review_required: form.review_required,
      testing_required: form.testing_required,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Task" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="What needs to be done?"
          autoFocus
          required
        />
        <Textarea
          label="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Add details..."
          rows={3}
        />
        <div className="grid grid-cols-2 gap-4">
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
          {projects && (
            <Select
              label="Project"
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              options={[{ value: '', label: 'No project' }, ...projects.map((p: { id: number; name: string }) => ({ value: String(p.id), label: p.name }))]}
            />
          )}
        </div>
        <Input
          label="Due date"
          type="date"
          value={form.due_date}
          onChange={(e) => setForm({ ...form, due_date: e.target.value })}
        />

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">Assignees</label>
          <div className="rounded-md border border-dark-border bg-dark-card max-h-40 overflow-y-auto divide-y divide-dark-border">
            {users?.length ? users.map((u: { id: number; first_name: string; last_name: string }) => {
              const selected = form.assignee_ids.includes(u.id);
              return (
                <label
                  key={u.id}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-dark-hover transition-colors',
                    selected && 'bg-white/[0.03]'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleAssignee(u.id)}
                    className="rounded border-dark-border"
                  />
                  <Avatar name={`${u.first_name} ${u.last_name}`} size="sm" />
                  <span className="text-sm text-text-primary">{u.first_name} {u.last_name}</span>
                </label>
              );
            }) : (
              <p className="px-3 py-4 text-sm text-text-muted">Loading users…</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          Advanced options
        </button>

        {showAdvanced && (
          <div className="space-y-3 pl-4 border-l-2 border-dark-border">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.review_required} onChange={(e) => setForm({ ...form, review_required: e.target.checked })} className="rounded" />
              Review required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.testing_required} onChange={(e) => setForm({ ...form, testing_required: e.target.checked })} className="rounded" />
              Testing required
            </label>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create Task</Button>
        </div>
      </form>
    </Modal>
  );
}
