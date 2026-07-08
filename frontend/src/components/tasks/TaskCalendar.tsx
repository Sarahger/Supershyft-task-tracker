import { useMemo, useState } from 'react';
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isPast,
  isSameDay,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { Task } from '../../types';
import { STATUS_LABELS } from '../../types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_VISIBLE_TASKS = 3;

const priorityAccent: Record<string, string> = {
  critical: 'border-l-2 calendar-accent-critical',
  high: 'border-l-2 calendar-accent-high',
  medium: 'border-l-2 calendar-accent-medium',
  low: 'border-l-2 calendar-accent-low',
};

interface TaskCalendarProps {
  tasks: Task[];
  undatedTasks?: Task[];
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
  onTaskClick: (id: number) => void;
  showProject?: boolean;
}

function parseTaskDueDate(task: Task): Date | null {
  if (!task.due_date) return null;
  const parsed = parseISO(task.due_date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function taskDueKey(task: Task) {
  const due = parseTaskDueDate(task);
  return due ? dateKey(due) : null;
}

function CalendarTaskChip({
  task,
  onClick,
  showProject,
}: {
  task: Task;
  onClick: () => void;
  showProject?: boolean;
}) {
  const overdue = (() => {
    const due = parseTaskDueDate(task);
    if (!due) return false;
    return isPast(due) && !isToday(due) && !['completed', 'cancelled'].includes(task.status);
  })();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={clsx(
        'w-full text-left rounded px-1.5 py-1 text-xs leading-snug truncate border-l-2 transition-colors hover:bg-dark-hover',
        overdue ? 'border-l-2 calendar-overdue' : priorityAccent[task.priority] || priorityAccent.low,
        'text-text-primary',
      )}
      title={`${task.title}${showProject && task.project_name ? ` · ${task.project_name}` : ''} · ${STATUS_LABELS[task.status] || task.status}`}
    >
      {task.title}
    </button>
  );
}

export function TaskCalendar({
  tasks,
  undatedTasks = [],
  currentMonth,
  onMonthChange,
  onTaskClick,
  showProject,
}: TaskCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = taskDueKey(task);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    for (const [, dayTasks] of map) {
      dayTasks.sort((a, b) => a.title.localeCompare(b.title));
    }
    return map;
  }, [tasks]);

  const undated = undatedTasks.length ? undatedTasks : tasks.filter((t) => !taskDueKey(t));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const datedCount = tasks.length;
  const selectedDayTasks = selectedDay ? tasksByDate.get(dateKey(selectedDay)) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            className="toolbar-btn p-1.5"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold text-text-primary min-w-[10rem] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className="toolbar-btn p-1.5"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              onMonthChange(startOfMonth(today));
              setSelectedDay(today);
            }}
            className="toolbar-btn text-sm"
          >
            Today
          </button>
          <span className="text-2xs text-text-muted">
            {datedCount} scheduled this view
            {undated.length > 0 ? ` · ${undated.length} unscheduled` : ''}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-dark-border bg-dark-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-dark-border bg-dark-muted">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-2xs font-medium uppercase tracking-wider text-text-muted"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-fr min-h-[480px]">
          {days.map((day) => {
            const key = dateKey(day);
            const dayTasks = tasksByDate.get(key) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const selected = selectedDay ? isSameDay(day, selectedDay) : false;
            const visible = dayTasks.slice(0, MAX_VISIBLE_TASKS);
            const hiddenCount = dayTasks.length - visible.length;

            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDay(day)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDay(day);
                  }
                }}
                className={clsx(
                  'min-h-[88px] border-b border-r border-dark-border p-1.5 flex flex-col gap-1 transition-colors cursor-pointer',
                  !inMonth && 'bg-surface-subtle',
                  inMonth && 'bg-dark-card',
                  today && 'ring-1 ring-inset ring-accent-primary/30 bg-accent-primary/5',
                  selected && 'bg-surface-highlight',
                  'hover:bg-dark-hover',
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={clsx(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums',
                      today && 'calendar-today-pill font-semibold',
                      !today && inMonth && 'text-text-primary',
                      !today && !inMonth && 'text-text-muted',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-2xs text-text-muted tabular-nums">{dayTasks.length}</span>
                  )}
                </div>

                <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto max-h-28">
                  {visible.map((task) => (
                    <CalendarTaskChip
                      key={task.id}
                      task={task}
                      showProject={showProject}
                      onClick={() => onTaskClick(task.id)}
                    />
                  ))}
                  {hiddenCount > 0 && (
                    <span className="text-2xs text-text-muted px-1">+{hiddenCount} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {tasks.length === 0 && (
        <p className="text-sm text-text-muted px-1">
          No tasks with due dates in this month. Try another month, clear filters, or add due dates to your tasks.
        </p>
      )}

      {(selectedDay || undated.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {selectedDay && (
            <div className="rounded-lg border border-dark-border bg-dark-card p-4">
              <h3 className="text-sm font-medium text-text-primary mb-3">
                {format(selectedDay, 'EEEE, MMMM d, yyyy')}
                <span className="text-text-muted font-normal ml-2">({selectedDayTasks.length})</span>
              </h3>
              {selectedDayTasks.length ? (
                <ul className="space-y-2">
                  {selectedDayTasks.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => onTaskClick(task.id)}
                        className="w-full text-left rounded-md border border-dark-border bg-surface-subtle px-3 py-2 hover:bg-dark-hover transition-colors"
                      >
                        <p className="text-sm font-medium text-text-primary">{task.title}</p>
                        <p className="text-2xs text-text-muted mt-0.5 capitalize">
                          {STATUS_LABELS[task.status] || task.status.replace(/_/g, ' ')}
                          {showProject && task.project_name ? ` · ${task.project_name}` : ''}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">No tasks due on this day.</p>
              )}
            </div>
          )}

          {undated.length > 0 && (
            <div className="rounded-lg border border-dark-border bg-dark-card p-4">
              <h3 className="text-sm font-medium text-text-primary mb-3">
                No due date
                <span className="text-text-muted font-normal ml-2">({undated.length})</span>
              </h3>
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {undated.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onTaskClick(task.id)}
                      className="w-full text-left rounded-md border border-dark-border bg-dark-muted/30 px-3 py-2 hover:bg-dark-hover transition-colors"
                    >
                      <p className="text-sm font-medium text-text-primary">{task.title}</p>
                      <p className="text-2xs text-text-muted mt-0.5 capitalize">
                        {STATUS_LABELS[task.status] || task.status.replace(/_/g, ' ')}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskCalendarSkeleton() {
  return (
    <div className="rounded-lg border border-dark-border bg-dark-card overflow-hidden animate-pulse">
      <div className="h-10 bg-dark-muted border-b border-dark-border" />
      <div className="grid grid-cols-7 min-h-[480px]">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[88px] border-b border-r border-dark-border bg-surface-subtle" />
        ))}
      </div>
    </div>
  );
}
