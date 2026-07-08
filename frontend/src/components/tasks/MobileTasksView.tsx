import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FolderKanban, ChevronDown, Plus } from 'lucide-react';
import clsx from 'clsx';
import type { Task } from '../../types';
import { MobileTaskCard } from './MobileTaskCard';
import { EmptyState } from '../ui/Skeleton';
import { Button } from '../ui/Button';

const STORAGE_KEY = 'mobile-expanded-projects';

function buildGroups(tasks: Task[], groupBy: 'project' | 'status' | 'priority' | 'none'): ProjectGroup[] {
  if (groupBy === 'none') {
    return [{ name: 'All tasks', tasks, completed: 0, total: tasks.length, progress: 0 }];
  }
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    let key = 'Other';
    if (groupBy === 'status') key = t.status;
    else if (groupBy === 'priority') key = t.priority;
    else key = t.project_name || 'No project';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries())
    .map(([name, groupTasks]) => {
      const completed = groupTasks.filter((t) => t.status === 'completed').length;
      const total = groupTasks.length;
      return {
        name: groupBy === 'status' ? name.replace(/_/g, ' ') : name,
        tasks: groupTasks,
        completed,
        total,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

interface ProjectGroup {
  name: string;
  tasks: Task[];
  completed: number;
  total: number;
  progress: number;
}

interface MobileTasksViewProps {
  tasks: Task[];
  onTaskClick: (id: number) => void;
  onCreateTask: () => void;
  onDeleteTask?: (task: Task) => void;
  isLoading?: boolean;
  groupBy?: 'project' | 'status' | 'priority' | 'none';
}

export function MobileTasksView({ tasks, onTaskClick, onCreateTask, onDeleteTask, isLoading, groupBy = 'project' }: MobileTasksViewProps) {
  const groups = useMemo(() => buildGroups(tasks, groupBy), [tasks, groupBy]);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) return new Set(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
    return new Set<string>();
  });

  const didInit = useRef(false);

  // Expand first project only on first visit (no saved preference yet)
  useEffect(() => {
    if (didInit.current || groups.length === 0) return;
    didInit.current = true;
    if (localStorage.getItem(STORAGE_KEY) === null) {
      setExpanded(new Set([groups[0].name]));
    }
  }, [groups]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...expanded]));
    } catch { /* ignore */ }
  }, [expanded]);

  const toggle = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3 md:hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-dark-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="md:hidden py-8">
        <EmptyState
          title="No tasks yet"
          description="Create your first task or adjust your filters to see work here."
          action={
            <Button onClick={onCreateTask} className="mt-2 gap-1.5">
              <Plus className="h-4 w-4" />
              Create task
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 md:hidden">
      {groups.map((group) => {
        const isOpen = expanded.has(group.name);
        return (
          <section key={group.name} className="mobile-project-accordion rounded-2xl border border-dark-border bg-dark-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(group.name)}
              className="w-full flex items-center gap-3 px-4 py-4 min-h-[64px] text-left hover:bg-dark-hover transition-colors"
              aria-expanded={isOpen}
            >
              <div className="h-10 w-10 rounded-xl bg-accent-primary/10 flex items-center justify-center shrink-0">
                <FolderKanban className="h-5 w-5 text-accent-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{group.name}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {groupBy === 'project'
                    ? `${group.total} task${group.total !== 1 ? 's' : ''} · ${group.progress}% complete`
                    : `${group.total} task${group.total !== 1 ? 's' : ''}`}
                </p>
                {groupBy === 'project' && (
                <div className="mt-2 h-1.5 rounded-full bg-dark-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-primary transition-all duration-300"
                    style={{ width: `${group.progress}%` }}
                  />
                </div>
                )}
              </div>
              <ChevronDown
                className={clsx(
                  'h-5 w-5 text-text-muted shrink-0 transition-transform duration-200',
                  isOpen && 'rotate-180',
                )}
              />
            </button>

            <div
              className={clsx(
                'grid transition-[grid-template-rows] duration-200 ease-out',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className="px-3 pb-3 pt-0 space-y-2 border-t border-dark-border bg-surface-subtle/50">
                  {isOpen && group.tasks.map((task) => (
                    <MobileTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task.id)}
                      onDelete={onDeleteTask}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
