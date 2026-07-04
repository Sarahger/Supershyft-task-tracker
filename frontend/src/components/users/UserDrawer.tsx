import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, ClipboardList, Clock, TrendingUp } from 'lucide-react';
import { usersApi } from '../../services/endpoints';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { Drawer } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/Skeleton';
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
    <div className="rounded-lg border border-dark-border bg-dark-bg/40 p-4">
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

function performanceLabel(utilization: number | null) {
  if (utilization == null) return { text: 'No time data yet', tone: 'text-text-muted' };
  if (utilization <= 100) return { text: 'On or under estimate', tone: 'text-emerald-400' };
  if (utilization <= 120) return { text: 'Slightly over estimate', tone: 'text-amber-400' };
  return { text: 'Over estimate', tone: 'text-red-400' };
}

function UserProfileContent({ profile }: { profile: UserProfile }) {
  const { openTask } = useTaskDrawer();
  const stats = profile.task_stats;
  const perf = performanceLabel(stats.time_utilization_percent);

  return (
    <div className="px-6 pt-14 pb-8 space-y-6">
      <header>
        <div className="flex items-start gap-4">
          <Avatar name={`${profile.first_name} ${profile.last_name}`} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-text-primary tracking-tight">
              {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-sm text-text-muted mt-0.5 truncate">{profile.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="chip bg-dark-muted text-text-secondary capitalize">{profile.role}</span>
              <span className="chip bg-dark-muted text-text-secondary capitalize">
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
      </header>

      <section>
        <h2 className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-2">Task overview</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Assigned"
            value={stats.assigned_count}
            icon={ClipboardList}
            color="text-sky-400"
          />
          <StatCard
            label="Pending"
            value={stats.pending_count}
            icon={Clock}
            color="text-amber-400"
          />
          <StatCard
            label="Completed"
            value={stats.completed_count}
            hint={`${stats.cancelled_count} cancelled`}
            icon={CheckCircle2}
            color="text-emerald-400"
          />
        </div>
      </section>

      <section className="rounded-lg border border-dark-border p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-medium text-text-primary">Time performance</h2>
            <p className="text-xs text-text-muted mt-0.5">Time taken vs time required</p>
          </div>
          <TrendingUp className="h-4 w-4 text-text-muted shrink-0" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-md border border-dark-border bg-dark-bg/40 p-3">
            <p className="text-2xs uppercase tracking-wider text-text-muted">Required</p>
            <p className="text-lg font-semibold text-text-primary mt-0.5 tabular-nums">{stats.total_estimated_hours}h</p>
          </div>
          <div className="rounded-md border border-dark-border bg-dark-bg/40 p-3">
            <p className="text-2xs uppercase tracking-wider text-text-muted">Taken</p>
            <p className="text-lg font-semibold text-text-primary mt-0.5 tabular-nums">{stats.total_actual_hours}h</p>
          </div>
          <div className="rounded-md border border-dark-border bg-dark-bg/40 p-3">
            <p className="text-2xs uppercase tracking-wider text-text-muted">Utilization</p>
            <p className={clsx('text-lg font-semibold mt-0.5 tabular-nums', perf.tone)}>
              {stats.time_utilization_percent != null ? `${stats.time_utilization_percent}%` : '—'}
            </p>
            <p className={clsx('text-2xs mt-0.5', perf.tone)}>{perf.text}</p>
          </div>
          <div className="rounded-md border border-dark-border bg-dark-bg/40 p-3">
            <p className="text-2xs uppercase tracking-wider text-text-muted">On track</p>
            <p className="text-lg font-semibold text-text-primary mt-0.5 tabular-nums">
              {stats.on_track_count}/{stats.tasks_with_time_data || 0}
            </p>
            <p className="text-2xs text-text-muted mt-0.5">{stats.over_budget_count} over</p>
          </div>
        </div>

        {stats.time_utilization_percent != null && (
          <div className="h-1.5 rounded-full bg-dark-muted overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full',
                stats.time_utilization_percent <= 100
                  ? 'bg-emerald-500'
                  : stats.time_utilization_percent <= 120
                    ? 'bg-amber-500'
                    : 'bg-red-500',
              )}
              style={{ width: `${Math.min(stats.time_utilization_percent, 150) / 150 * 100}%` }}
            />
          </div>
        )}

        {profile.pending_reviews_count > 0 && (
          <p className="text-xs text-text-secondary mt-3">
            Reviewing {profile.pending_reviews_count} task{profile.pending_reviews_count === 1 ? '' : 's'} now
          </p>
        )}
      </section>

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
                        <span className="chip bg-dark-muted text-text-secondary text-2xs capitalize">
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
                            taskUtil <= 100 ? 'text-emerald-400' : taskUtil <= 120 ? 'text-amber-400' : 'text-red-400',
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
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.get(userId!).then((r) => r.data.data),
    enabled: !!userId,
  });

  return (
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
      {profile && !isLoading && <UserProfileContent profile={profile} />}
    </Drawer>
  );
}
