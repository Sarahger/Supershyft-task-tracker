import { useMemo } from 'react';
import {
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
  isPast,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { Task } from '../../types';
import { STATUS_LABELS } from '../../types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const priorityAccent: Record<string, string> = {
  critical: 'border-l-red-400 bg-red-500/10',
  high: 'border-l-amber-400 bg-amber-500/10',
  medium: 'border-l-blue-400 bg-blue-500/10',
  low: 'border-l-zinc-500 bg-white/[0.03]',
};

interface TaskWeekViewProps {
  tasks: Task[];
  undatedTasks?: Task[];
  currentWeek: Date;
  onWeekChange: (week: Date) => void;
  onTaskClick: (id: number) => void;
  showProject?: boolean;
}

function parseTaskDueDate(task: Task): Date | null {
  if (!task.due_date) return null;
  const parsed = parseISO(task.due_date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function WeekTaskCard({
  task,
  onClick,
  showProject,
}: {
  task: Task;
  onClick: () => void;
  showProject?: boolean;
}) {
  const due = parseTaskDueDate(task);
  const overdue =
    due && isPast(due) && !isToday(due) && !['completed', 'cancelled'].includes(task.status);

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full text-left rounded-md px-2 py-1.5 text-xs border-l-2 transition-colors hover:brightness-125',
        overdue ? 'border-l-red-400 bg-red-500/15 text-red-200' : priorityAccent[task.priority] || priorityAccent.low,
      )}
    >
      <p className="font-medium truncate text-text-primary">{task.title}</p>
      <p className="text-2xs text-text-muted mt-0.5 truncate">
        {STATUS_LABELS[task.status] || task.status}
        {showProject && task.project_name ? ` · ${task.project_name}` : ''}
      </p>
      {(task.estimated_hours != null || task.actual_hours != null) && (
        <p className="text-2xs text-text-muted mt-0.5 tabular-nums">
          {task.estimated_hours != null ? `${task.estimated_hours}h est` : ''}
          {task.estimated_hours != null && task.actual_hours != null ? ' · ' : ''}
          {task.actual_hours != null ? `${task.actual_hours}h done` : ''}
        </p>
      )}
    </button>
  );
}

export function TaskWeekView({
  tasks,
  undatedTasks = [],
  currentWeek,
  onWeekChange,
  onTaskClick,
  showProject,
}: TaskWeekViewProps) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const day of days) {
      map.set(format(day, 'yyyy-MM-dd'), []);
    }
    for (const task of tasks) {
      const due = parseTaskDueDate(task);
      if (!due) continue;
      const key = format(due, 'yyyy-MM-dd');
      if (map.has(key)) map.get(key)!.push(task);
    }
    return map;
  }, [tasks, days]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-1 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onWeekChange(subWeeks(currentWeek, 1))}
            className="toolbar-btn shrink-0"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-medium text-text-primary text-center truncate min-w-0">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </h2>
          <button
            type="button"
            onClick={() => onWeekChange(addWeeks(currentWeek, 1))}
            className="toolbar-btn shrink-0"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onWeekChange(new Date())}
            className="toolbar-btn text-xs"
          >
            This week
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {days.map((day, i) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDay.get(key) ?? [];
          const today = isToday(day);
          return (
            <div
              key={key}
              className={clsx(
                'rounded-lg border min-h-[10rem] flex flex-col',
                today ? 'border-blue-500/40 bg-blue-500/5' : 'border-dark-border bg-dark-card',
              )}
            >
              <div className={clsx('px-3 py-2 border-b border-dark-border', today && 'bg-blue-500/10')}>
                <p className="text-2xs uppercase tracking-wider text-text-muted">{WEEKDAYS[i]}</p>
                <p className={clsx('text-sm font-medium tabular-nums', today ? 'text-blue-300' : 'text-text-primary')}>
                  {format(day, 'MMM d')}
                </p>
              </div>
              <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-64">
                {dayTasks.length ? (
                  dayTasks.map((task) => (
                    <WeekTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task.id)}
                      showProject={showProject}
                    />
                  ))
                ) : (
                  <p className="text-2xs text-text-muted px-1 py-2">No tasks</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {undatedTasks.length > 0 && (
        <div className="rounded-lg border border-dark-border bg-dark-card p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3">
            No due date ({undatedTasks.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {undatedTasks.map((task) => (
              <WeekTaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
                showProject={showProject}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TaskWeekViewSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="h-48 rounded-lg bg-dark-muted/30 animate-pulse border border-dark-border" />
      ))}
    </div>
  );
}
