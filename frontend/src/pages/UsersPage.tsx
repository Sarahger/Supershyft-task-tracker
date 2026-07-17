import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { usersApi, departmentsApi } from '../services/endpoints';
import { useUserDrawer } from '../contexts/UserDrawerContext';
import { UserFormModal, emptyUserForm, userToForm, type UserFormState } from '../components/users/UserFormModal';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import {
  canAccessManagerFeatures,
  canDeleteUser,
  canEditUser,
  canManageUsers,
} from '../lib/roles';
import { USER_STATUSES, USER_STATUS_LABELS } from '../types';
import { resolveUserDepartmentIds } from '../lib/userForm';

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

import type { User } from '../types';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { openUser } = useUserDrawer();
  const queryClient = useQueryClient();
  const isAdmin = currentUser?.role === 'administrator';
  const canManageStatus = canAccessManagerFeatures(currentUser);
  const canAddOrRemoveUsers = canManageUsers(currentUser);
  const roleOptions = isAdmin
    ? [
        { value: 'employee', label: 'Employee' },
        { value: 'manager', label: 'Manager' },
        { value: 'administrator', label: 'Administrator' },
      ]
    : [
        { value: 'employee', label: 'Employee' },
        { value: 'manager', label: 'Manager' },
      ];

  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createForm, setCreateForm] = useState<UserFormState>(emptyUserForm);
  const [editForm, setEditForm] = useState<UserFormState>(emptyUserForm);
  const [newDeptInput, setNewDeptInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
    enabled: showCreate || !!editingUser,
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: string }) =>
      usersApi.update(userId, { status }),
    onSuccess: (_res, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      toast.success(`Status updated to ${USER_STATUS_LABELS[status] || status}`);
    },
    onError: () => toast.error('Could not update user status'),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const department_ids = await resolveUserDepartmentIds(createForm, departments);
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
      setCreateForm(emptyUserForm());
      setNewDeptInput('');
      toast.success('User created');
    },
    onError: () => toast.error('Could not create user'),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const department_ids = await resolveUserDepartmentIds(editForm, departments);
      return usersApi.update(editingUser.id, {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        status: editForm.status,
        job_title: editForm.job_title.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        department_ids,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      if (editingUser) queryClient.invalidateQueries({ queryKey: ['user', editingUser.id] });
      setEditingUser(null);
      setEditForm(emptyUserForm());
      setNewDeptInput('');
      toast.success('User updated');
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      toast.error(axiosErr.response?.data?.detail || 'Could not update user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => usersApi.remove(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      toast.success('User deleted permanently');
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      toast.error(axiosErr.response?.data?.detail || 'Could not delete user');
    },
  });

  const handleStatusChange = (userId: number, status: string) => {
    const target = data?.find((u) => u.id === userId);
    if (!target || target.status === status) return;
    statusMutation.mutate({ userId, status });
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditForm(userToForm(user));
    setNewDeptInput('');
  };

  const handleDelete = (user: User) => {
    const message =
      `Permanently delete ${user.first_name} ${user.last_name}?\n\n` +
      'This removes their account from the database. ' +
      'If they created tasks or comments, deletion may be blocked — use status "inactive" instead.';
    if (!window.confirm(message)) return;
    deleteMutation.mutate(user.id);
  };

  const closeCreateModal = () => {
    setShowCreate(false);
    setCreateForm(emptyUserForm());
    setNewDeptInput('');
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditForm(emptyUserForm());
    setNewDeptInput('');
  };

  if (isLoading) return <div className="animate-pulse h-64 bg-dark-muted rounded-lg" />;

  return (
    <div className="max-w-workspace mx-auto pb-12">
      <div className="flex items-start justify-between gap-4 mb-6">
        <PageHeader
          title="Users"
          subtitle={`${data?.length ?? 0} people · click a row for details`}
        />
        {canAddOrRemoveUsers && (
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
                {canAddOrRemoveUsers && (
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
                      <Avatar name={`${u.first_name} ${u.last_name}`} src={u.profile_picture} size="sm" />
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
                  {canAddOrRemoveUsers && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canEditUser(currentUser, u) && (
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="toolbar-btn text-text-muted hover:text-text-primary"
                            title="Edit user"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDeleteUser(currentUser, u) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            disabled={deleteMutation.isPending}
                            className="toolbar-btn text-text-muted hover:text-red-400"
                            title="Delete user permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserFormModal
        isOpen={showCreate}
        title="Add user"
        submitLabel="Create user"
        form={createForm}
        setForm={setCreateForm}
        roleOptions={roleOptions}
        departments={departments}
        newDeptInput={newDeptInput}
        setNewDeptInput={setNewDeptInput}
        onClose={closeCreateModal}
        onSubmit={() => createMutation.mutate()}
        isSubmitting={createMutation.isPending}
      />

      <UserFormModal
        isOpen={!!editingUser}
        title={editingUser ? `Edit ${editingUser.first_name} ${editingUser.last_name}` : 'Edit user'}
        submitLabel="Save changes"
        form={editForm}
        setForm={setEditForm}
        roleOptions={roleOptions}
        departments={departments}
        newDeptInput={newDeptInput}
        setNewDeptInput={setNewDeptInput}
        onClose={closeEditModal}
        onSubmit={() => updateMutation.mutate()}
        isSubmitting={updateMutation.isPending}
        showStatus
      />
    </div>
  );
}
