import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Plus, UserMinus, X } from 'lucide-react';
import { usersApi, departmentsApi } from '../services/endpoints';
import { useUserDrawer } from '../contexts/UserDrawerContext';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { canAccessManagerFeatures } from '../lib/roles';
import { USER_STATUSES, USER_STATUS_LABELS } from '../types';
import type { User } from '../types';

const STATUS_CHIP: Record<string, string> = {
  active: 'status-chip-active',
  on_leave: 'status-chip-leave',
  inactive: 'status-chip-inactive',
};

function UserStatusControl({
  user,
  canEdit,
  onChange,
  isPending,
}: {
  user: User;
  canEdit: boolean;
  onChange: (userId: number, status: string) => void;
  isPending: boolean;
}) {
  const chipClass = STATUS_CHIP[user.status] || 'bg-dark-muted text-text-muted border-dark-border';

  if (!canEdit) {
    return (
      <span className={clsx(chipClass)}>
        {USER_STATUS_LABELS[user.status] || user.status.replace(/_/g, ' ')}
      </span>
    );
  }

  return (
    <select
      value={user.status}
      disabled={isPending}
      onChange={(e) => onChange(user.id, e.target.value)}
      className={clsx(
        'chip border cursor-pointer appearance-none pr-7 max-w-full truncate',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        chipClass,
      )}
      aria-label={`Status for ${user.first_name} ${user.last_name}`}
    >
      {USER_STATUSES.map((status) => (
        <option key={status} value={status}>
          {USER_STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  );
}

const emptyCreateForm = {
  first_name: '',
  last_name: '',
  email: '',
  role: 'employee',
  job_title: '',
  department_ids: [] as number[],
  new_department_names: [] as string[],
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { openUser } = useUserDrawer();
  const queryClient = useQueryClient();
  const isAdmin = currentUser?.role === 'administrator';
  const canManageStatus = canAccessManagerFeatures(currentUser);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [newDeptInput, setNewDeptInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
    enabled: showCreate,
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: string }) =>
      usersApi.update(userId, { status }),
    onSuccess: (_res, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      toast.success(`Status updated to ${USER_STATUS_LABELS[status] || status}`);
    },
    onError: () => {
      toast.error('Could not update user status');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const department_ids = [...createForm.department_ids];

      for (const name of createForm.new_department_names) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        const existing = departments?.find((d) => d.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) {
          if (!department_ids.includes(existing.id)) department_ids.push(existing.id);
        } else {
          const created = await departmentsApi.create({ name: trimmed });
          department_ids.push(created.data.data.id);
        }
      }

      return usersApi.create({
        first_name: createForm.first_name.trim(),
        last_name: createForm.last_name.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        job_title: createForm.job_title.trim() || undefined,
        department_ids: department_ids.length ? department_ids : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      setNewDeptInput('');
      toast.success('User created');
    },
    onError: () => toast.error('Could not create user'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: number) => usersApi.deactivate(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      toast.success('User deactivated');
    },
    onError: () => toast.error('Could not deactivate user'),
  });

  const handleStatusChange = (userId: number, status: string) => {
    const target = data?.find((u) => u.id === userId);
    if (!target || target.status === status) return;
    statusMutation.mutate({ userId, status });
  };

  const handleDeactivate = (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error('You cannot deactivate your own account');
      return;
    }
    if (!window.confirm(`Deactivate ${user.first_name} ${user.last_name}? They will no longer be able to sign in.`)) {
      return;
    }
    deactivateMutation.mutate(user.id);
  };

  const selectedDepartments = createForm.department_ids
    .map((id) => departments?.find((d) => d.id === id))
    .filter(Boolean) as { id: number; name: string }[];

  const availableDepartments = (departments ?? []).filter(
    (d) => !createForm.department_ids.includes(d.id),
  );

  const addExistingDepartment = (deptId: number) => {
    if (!deptId || createForm.department_ids.includes(deptId)) return;
    setCreateForm((prev) => ({
      ...prev,
      department_ids: [...prev.department_ids, deptId],
    }));
  };

  const removeDepartment = (deptId: number) => {
    setCreateForm((prev) => ({
      ...prev,
      department_ids: prev.department_ids.filter((id) => id !== deptId),
    }));
  };

  const addNewDepartmentName = () => {
    const name = newDeptInput.trim();
    if (!name) return;
    const existing = departments?.find((d) => d.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      addExistingDepartment(existing.id);
    } else if (
      !createForm.new_department_names.some((n) => n.toLowerCase() === name.toLowerCase())
    ) {
      setCreateForm((prev) => ({
        ...prev,
        new_department_names: [...prev.new_department_names, name],
      }));
    }
    setNewDeptInput('');
  };

  const removeNewDepartmentName = (name: string) => {
    setCreateForm((prev) => ({
      ...prev,
      new_department_names: prev.new_department_names.filter((n) => n !== name),
    }));
  };

  const closeCreateModal = () => {
    setShowCreate(false);
    setCreateForm(emptyCreateForm);
    setNewDeptInput('');
  };

  if (isLoading) return <div className="animate-pulse h-64 bg-dark-muted rounded-lg" />;

  return (
    <div className="max-w-workspace mx-auto pb-12">
      <div className="flex items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Users"
          subtitle={
            canManageStatus
              ? `${data?.length ?? 0} people · click a row for details`
              : `${data?.length ?? 0} people · click a row for details`
          }
        />
        {isAdmin && (
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 shrink-0">
            <Plus className="h-3.5 w-3.5" /> Add user
          </Button>
        )}
      </div>

      {!data?.length ? (
        <EmptyState title="No users found" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="text-left px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider">Departments</th>
                <th className="text-left px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider">Job Title</th>
                {isAdmin && (
                  <th className="text-right px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => openUser(u.id)}
                  className="border-b border-dark-border hover:bg-dark-hover transition-colors duration-hover cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${u.first_name} ${u.last_name}`} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-text-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="chip bg-dark-muted text-text-secondary capitalize">{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {u.departments?.map((d) => d.name).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <UserStatusControl
                      user={u}
                      canEdit={canManageStatus}
                      onChange={handleStatusChange}
                      isPending={statusMutation.isPending && statusMutation.variables?.userId === u.id}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{u.job_title || '—'}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {u.status !== 'inactive' && u.id !== currentUser?.id && (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(u)}
                          disabled={deactivateMutation.isPending}
                          className="toolbar-btn text-text-muted hover:text-red-400 gap-1"
                          title="Deactivate user"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={closeCreateModal} title="Add user">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First name"
              value={createForm.first_name}
              onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
            />
            <Input
              label="Last name"
              value={createForm.last_name}
              onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
          />
          <p className="text-xs text-text-muted -mt-2">
            New users sign in with a one-time email code — no password needed.
          </p>
          <Select
            label="Role"
            value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
            options={[
              { value: 'employee', label: 'Employee' },
              { value: 'manager', label: 'Manager' },
              { value: 'administrator', label: 'Administrator' },
            ]}
          />
          <Input
            label="Job title"
            value={createForm.job_title}
            onChange={(e) => setCreateForm({ ...createForm, job_title: e.target.value })}
          />

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Departments</label>
            <div className="flex flex-wrap gap-2 min-h-[2rem] mb-2">
              {selectedDepartments.map((d) => (
                <span
                  key={`existing-${d.id}`}
                  className="dept-chip-existing"
                >
                  <span className="text-sm text-text-primary">{d.name}</span>
                  <button
                    type="button"
                    onClick={() => removeDepartment(d.id)}
                    className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-surface-active transition-colors"
                    aria-label={`Remove ${d.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              {createForm.new_department_names.map((name) => (
                <span
                  key={`new-${name}`}
                  className="dept-chip-new"
                >
                  <span className="text-sm text-text-primary">{name}</span>
                  <span className="dept-chip-new-label">new</span>
                  <button
                    type="button"
                    onClick={() => removeNewDepartmentName(name)}
                    className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-surface-active transition-colors"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              {!selectedDepartments.length && !createForm.new_department_names.length && (
                <p className="text-sm text-text-muted py-1">No departments selected</p>
              )}
            </div>
            {availableDepartments.length > 0 && (
              <select
                value=""
                onChange={(e) => addExistingDepartment(Number(e.target.value))}
                className="input text-sm mb-2"
                aria-label="Add existing department"
              >
                <option value="">Add existing department…</option>
                {availableDepartments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <Input
                value={newDeptInput}
                onChange={(e) => setNewDeptInput(e.target.value)}
                placeholder="Or type a new department name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addNewDepartmentName();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addNewDepartmentName}
                disabled={!newDeptInput.trim()}
                className="shrink-0 mt-auto"
              >
                Add
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeCreateModal}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={
                !createForm.first_name.trim() ||
                !createForm.last_name.trim() ||
                !createForm.email.trim()
              }
            >
              Create user
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
