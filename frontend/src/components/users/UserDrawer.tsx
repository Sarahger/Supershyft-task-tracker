import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { format } from 'date-fns';
import { CalendarCheck, CheckCircle2, ClipboardList, Clock, Pencil, Trash2 } from 'lucide-react';
import { attendanceApi, departmentsApi, usersApi } from '../../services/endpoints';
import { useAuth } from '../../contexts/AuthContext';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { canDeleteUser, canEditUser } from '../../lib/roles';
import { resolveUserDepartmentIds } from '../../lib/userForm';
import { Drawer } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/Skeleton';
import { toast } from '../ui/Toast';
import { UserFormModal, emptyUserForm, userToForm, type UserFormState } from './UserFormModal';
import { STATUS_LABELS, USER_STATUS_LABELS, type UserProfile } from '../../types';

interface UserDrawerProps {
  userId: number | null;
  onClose: () => void;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof ClipboardList;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-dark-border bg-surface-subtle p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={clsx('text-2xl font-semibold tabular-nums', color)}>{value}</p>
          <p className="text-xs text-text-primary mt-1 font-medium">{label}</p>
          {hint && <p className="text-2xs text-text-muted mt-0.5">{hint}</p>}
        </div>
        <Icon className={clsx('h-4 w-4 shrink-0 opacity-70', color)} />
      </div>
    </div>
  );
}

function UserAttendanceSection({ userId }: { userId: number }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['attendance', 'user', userId, year, month],
    queryFn: () =>
      attendanceApi.userDetail(userId, { year, month }).then((r) => r.data.data),
  });

  const summary = data?.summary;

  const cards = summary
    ? [
        { key: 'wfo', label: 'WFO', value: summary.wfo_count, color: 'metric-emerald' },
        { key: 'wfh', label: 'WFH', value: summary.wfh_count, color: 'metric-sky' },
        { key: 'leave', label: 'Leave', value: summary.leave_count, color: 'metric-amber' },
        { key: 'half', label: 'Half day', value: summary.half_day_count ?? 0, color: 'metric-violet' },
        { key: 'camp', label: 'Camp/Meeting', value: summary.camp_count ?? 0, color: 'metric-orange' },
        {
          key: 'pct',
          label: 'Attendance %',
          value: `${summary.attendance_percent}%`,
          color: 'metric-emerald',
          hint: `${summary.present_count}/${summary.working_days} working days`,
        },
      ]
    : [];

  return (
    <section className="rounded-lg border border-dark-border p-4" data-testid="user-attendance-section">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-medium text-text-primary">Attendance</h2>
          <p className="text-xs text-text-muted mt-0.5">{format(now, 'MMMM yyyy')}</p>
        </div>
        <CalendarCheck className="h-4 w-4 text-text-muted shrink-0" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-md bg-dark-muted" />
          ))}
        </div>
      ) : isError || !summary ? (
        <p className="text-sm text-text-muted">Could not load attendance for this user.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <div key={c.key} className="rounded-md border border-dark-border bg-surface-subtle p-3">
              <p className="text-2xs uppercase tracking-wider text-text-muted">{c.label}</p>
              <p className={clsx('text-lg font-semibold mt-0.5 tabular-nums', c.color)}>{c.value}</p>
              {'hint' in c && c.hint ? (
                <p className="text-2xs text-text-muted mt-0.5">{c.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function UserProfileContent({
  profile,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  isDeleting,
}: {
  profile: UserProfile;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { openTask } = useTaskDrawer();
  const stats = profile.task_stats;

  return (
    <div className="px-6 pt-14 pb-8 space-y-6">
      <header>
        <div className="flex items-start gap-4">
          <Avatar name={`${profile.first_name} ${profile.last_name}`} src={profile.profile_picture} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-text-primary tracking-tight">
              {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-sm text-text-muted mt-0.5 truncate">{profile.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="chip bg-surface-muted text-text-secondary capitalize">{profile.role}</span>
              <span className="chip bg-surface-muted text-text-secondary capitalize">
                {USER_STATUS_LABELS[profile.status] || profile.status.replace(/_/g, ' ')}
              </span>
            </div>
            {profile.job_title && (
              <p className="text-sm text-text-secondary mt-2">{profile.job_title}</p>
            )}
            {profile.departments?.length > 0 && (
              <p className="text-xs text-text-muted mt-1">
                {profile.departments.map((d) => d.name).join(' · ')}
              </p>
            )}
          </div>
        </div>
        {(canEdit || canDelete) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={onEdit} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Edit user
              </Button>
            )}
            {canDelete && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onDelete}
                disabled={isDeleting}
                className="gap-1.5 text-accent-danger hover:text-accent-danger hover:bg-red-500/10 border-red-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete user
              </Button>
            )}
          </div>
        )}
      </header>

      <section>
        <h2 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-2">Task overview</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Assigned"
            value={stats.assigned_count}
            icon={ClipboardList}
            color="metric-sky"
          />
          <StatCard
            label="Pending"
            value={stats.pending_count}
            icon={Clock}
            color="metric-amber"
          />
          <StatCard
            label="Completed"
            value={stats.completed_count}
            hint={`${stats.cancelled_count} cancelled`}
            icon={CheckCircle2}
            color="metric-emerald"
          />
        </div>
      </section>

      <UserAttendanceSection userId={profile.id} />

      {profile.pending_reviews_count > 0 && (
        <p className="text-xs text-text-secondary -mt-3">
          Reviewing {profile.pending_reviews_count} task{profile.pending_reviews_count === 1 ? '' : 's'} now
        </p>
      )}

      <section>
        <h2 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-2">
          Assigned tasks · {profile.assigned_tasks.length}
        </h2>
        {!profile.assigned_tasks.length ? (
          <EmptyState title="No assigned tasks" description="No active assignments." />
        ) : (
          <div className="rounded-lg border border-dark-border overflow-hidden divide-y divide-dark-border">
            {profile.assigned_tasks.map((task) => {
              const taskUtil =
                task.estimated_hours && task.actual_hours && task.estimated_hours > 0
                  ? Math.round((task.actual_hours / task.estimated_hours) * 100)
                  : null;
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => openTask(task.id)}
                  className="w-full text-left px-4 py-3 hover:bg-dark-hover transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="chip bg-surface-muted text-text-secondary text-2xs capitalize">
                          {STATUS_LABELS[task.status] || task.status.replace(/_/g, ' ')}
                        </span>
                        {task.project_name && (
                          <span className="text-2xs text-text-muted truncate">{task.project_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-2xs tabular-nums">
                      <p className="text-text-muted">
                        {task.estimated_hours != null ? `${task.estimated_hours}h` : '—'}
                        {' / '}
                        {task.actual_hours != null ? `${task.actual_hours}h` : '—'}
                      </p>
                      {taskUtil != null && (
                        <p
                          className={clsx(
                            'mt-0.5',
                            taskUtil <= 100 ? 'metric-emerald' : taskUtil <= 120 ? 'metric-amber' : 'metric-red',
                          )}
                        >
                          {taskUtil}%
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export function UserDrawer({ userId, onClose }: UserDrawerProps) {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = currentUser?.role === 'administrator';
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<UserFormState>(emptyUserForm());
  const [newDeptInput, setNewDeptInput] = useState('');

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

  useEffect(() => {
    setShowEdit(false);
    setEditForm(emptyUserForm());
    setNewDeptInput('');
  }, [userId]);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.get(userId!).then((r) => r.data.data),
    enabled: !!userId,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
    enabled: showEdit,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      const department_ids = await resolveUserDepartmentIds(editForm, departments);
      return usersApi.update(profile.id, {
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
      queryClient.invalidateQueries({ queryKey: ['users-meetings-invite'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      if (profile) queryClient.invalidateQueries({ queryKey: ['user', profile.id] });
      setShowEdit(false);
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
    mutationFn: (targetUserId: number) => usersApi.remove(targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      queryClient.invalidateQueries({ queryKey: ['users-meetings-invite'] });
      toast.success('User deleted permanently');
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      toast.error(axiosErr.response?.data?.detail || 'Could not delete user');
    },
  });

  const openEdit = () => {
    if (!profile) return;
    setEditForm(userToForm(profile));
    setNewDeptInput('');
    setShowEdit(true);
  };

  const closeEdit = () => {
    setShowEdit(false);
    setEditForm(emptyUserForm());
    setNewDeptInput('');
  };

  const handleDelete = () => {
    if (!profile) return;
    const message =
      `Permanently delete ${profile.first_name} ${profile.last_name}?\n\n` +
      'This removes their account from the database. ' +
      'If they created tasks or comments, deletion may be blocked — use status "inactive" instead.';
    if (!window.confirm(message)) return;
    deleteMutation.mutate(profile.id);
  };

  const canEdit = profile ? canEditUser(currentUser, profile) : false;
  const canDelete = profile ? canDeleteUser(currentUser, profile) : false;

  return (
    <>
      <Drawer isOpen={!!userId} onClose={onClose}>
        {isLoading && (
          <div className="px-6 pt-14 pb-8 space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {isError && !isLoading && (
          <div className="px-6 pt-14 pb-8">
            <EmptyState title="User not found" description="This person may have been removed." />
          </div>
        )}
        {profile && !isLoading && (
          <UserProfileContent
            profile={profile}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={openEdit}
            onDelete={handleDelete}
            isDeleting={deleteMutation.isPending}
          />
        )}
      </Drawer>

      <UserFormModal
        isOpen={showEdit}
        title={profile ? `Edit ${profile.first_name} ${profile.last_name}` : 'Edit user'}
        submitLabel="Save changes"
        form={editForm}
        setForm={setEditForm}
        roleOptions={roleOptions}
        departments={departments}
        newDeptInput={newDeptInput}
        setNewDeptInput={setNewDeptInput}
        onClose={closeEdit}
        onSubmit={() => updateMutation.mutate()}
        isSubmitting={updateMutation.isPending}
        showStatus
      />
    </>
  );
}
