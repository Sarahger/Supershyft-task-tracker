import { useMemo, useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import type { Task } from '../../types';
import { AvatarGroup } from '../ui/Avatar';
import { formatTimeTakenHours } from '../../lib/taskTiming';

interface CompletedTasksListProps {
  tasks: Task[];
  onTaskClick: (id: number) => void;
}

function completionDate(task: Task): Date | null {
  const raw = task.completed_at || task.deleted_at || task.updated_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function groupTasksByMonth(tasks: Task[]): { key: string; label: string; tasks: Task[] }[] {
  const map = new Map<string, { label: string; sortKey: number; tasks: Task[] }>();

  for (const task of tasks) {
    const d = completionDate(task);
    const key = d ? format(d, 'yyyy-MM') : 'unknown';
    const label = d ? format(d, 'MMMM yyyy') : 'No date';
    const sortKey = d ? d.getFullYear() * 100 + (d.getMonth() + 1) : 0;
    const existing = map.get(key);
    if (existing) {
      existing.tasks.push(task);
    } else {
      map.set(key, { label, sortKey, tasks: [task] });
    }
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1].sortKey - a[1].sortKey)
    .map(([key, group]) => ({
      key,
      label: group.label,
      tasks: group.tasks.sort((a, b) => {
        const da = completionDate(a)?.getTime() ?? 0;
        const db = completionDate(b)?.getTime() ?? 0;
        return db - da;
      }),
    }));
}

function DueDateCell({ date, status }: { date?: string; status: string }) {
  if (!date) return <span className="text-text-muted text-sm">—</span>;
  const d = new Date(date);
  const overdue = isPast(d) && !isToday(d) && !['completed', 'cancelled'].includes(status);
  return (
    <span className={clsx('text-sm tabular-nums', overdue ? 'priority-critical' : 'text-text-muted')}>
      {format(d, 'MMM d, yyyy')}
    </span>
  );
}

function AssigneesCell({ task }: { task: Task }) {
  const users = task.assignees?.map((a) => a.user!).filter(Boolean) ?? [];
  if (!users.length) {
    return <span className="text-sm text-text-muted">—</span>;
  }
  return (
    <div className="flex items-center gap-2 min-w-0">
      <AvatarGroup users={users} max={3} />
      <span className="text-sm text-text-secondary truncate">
        {users.map((u) => `${u.first_name} ${u.last_name}`).join(', ')}
      </span>
    </div>
  );
}

function CompletedRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const time = formatTimeTakenHours(task.estimated_hours);
  const users = task.assignees?.map((a) => a.user!).filter(Boolean) ?? [];

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-3.5 rounded-lg border border-dark-border bg-dark-card hover:bg-dark-hover transition-colors"
    >
      <p className="text-sm font-medium text-text-primary leading-snug">{task.title}</p>
      <div className="flex items-center gap-2 mt-2.5 min-w-0">
        {users.length > 0 ? (
          <>
            <AvatarGroup users={users} max={3} />
            <span className="text-xs text-text-secondary truncate">
              {users.map((u) => `${u.first_name} ${u.last_name}`).join(', ')}
            </span>
          </>
        ) : (
          <span className="text-xs text-text-muted">Unassigned</span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
        <span className="tabular-nums">{time ?? '—'}</span>
        <span aria-hidden>·</span>
        <DueDateCell date={task.due_date} status={task.status} />
      </div>
    </button>
  );
}

function MonthSection({
  label,
  count,
  defaultOpen,
  children,
}: {
  label: string;
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mb-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 mb-3 px-1 text-left group"
        aria-expanded={open}
      >
        <ChevronDown
          className={clsx(
            'h-3.5 w-3.5 text-text-muted shrink-0 transition-transform duration-200',
            !open && '-rotate-90',
          )}
        />
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted group-hover:text-text-secondary transition-colors">
          {label} · {count}
        </h2>
      </button>
      {open && children}
    </section>
  );
}

export function CompletedTasksList({ tasks, onTaskClick }: CompletedTasksListProps) {
  const months = useMemo(() => groupTasksByMonth(tasks), [tasks]);

  if (!tasks.length) {
    return (
      <p className="text-sm text-text-muted py-8 text-center">
        No completed tasks yet.
      </p>
    );
  }

  return (
    <div>
      {months.map((month, index) => (
        <MonthSection
          key={month.key}
          label={month.label}
          count={month.tasks.length}
          defaultOpen={index === 0}
        >
          <div className="hidden md:block rounded-xl border border-dark-border overflow-hidden">
            <div className="task-table-header flex items-stretch text-xs font-medium uppercase tracking-wider text-text-muted">
              <div className="db-header-cell flex-[2] min-w-[220px]">Task name</div>
              <div className="db-header-cell flex-1 min-w-[180px]">Assignees</div>
              <div className="db-header-cell w-28 shrink-0">Time</div>
              <div className="db-header-cell w-36 shrink-0">Due date</div>
            </div>
            {month.tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onTaskClick(task.id)}
                className="db-row w-full text-left"
              >
                <div className="db-cell flex-[2] min-w-[220px]">
                  <p className="text-sm font-medium text-text-primary leading-snug line-clamp-2">
                    {task.title}
                  </p>
                </div>
                <div className="db-cell flex-1 min-w-[180px]">
                  <AssigneesCell task={task} />
                </div>
                <div className="db-cell w-28 shrink-0">
                  <span className="text-sm text-text-muted tabular-nums">
                    {formatTimeTakenHours(task.estimated_hours) ?? '—'}
                  </span>
                </div>
                <div className="db-cell w-36 shrink-0">
                  <DueDateCell date={task.due_date} status={task.status} />
                </div>
              </button>
            ))}
          </div>

          <div className="md:hidden space-y-2">
            {month.tasks.map((task) => (
              <CompletedRow key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
            ))}
          </div>
        </MonthSection>
      ))}
    </div>
  );
}
