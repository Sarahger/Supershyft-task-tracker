import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isPast, isToday, isThisWeek } from 'date-fns';
import { tasksApi } from '../services/endpoints';
import { useTaskDrawer } from '../contexts/TaskDrawerContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDeleteTaskMutation } from '../hooks/useDeleteTaskMutation';
import { TaskDatabase, TaskDatabaseSkeleton } from '../components/tasks/TaskDatabase';
import { MobileTaskCard } from '../components/tasks/MobileTaskCard';
import { DeleteTaskModal } from '../components/tasks/DeleteTaskModal';
import { EmptyState } from '../components/ui/Skeleton';
import type { Task } from '../types';

function TaskList({
  tasks,
  onTaskClick,
  onDeleteTask,
}: {
  tasks: Task[];
  onTaskClick: (id: number) => void;
  onDeleteTask: (task: Task) => void;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <div className="space-y-2 md:hidden">
        {tasks.map((task) => (
          <MobileTaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task.id)}
            onDelete={onDeleteTask}
          />
        ))}
      </div>
    );
  }
  return <TaskDatabase tasks={tasks} onTaskClick={onTaskClick} onDeleteTask={onDeleteTask} showProject />;
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3 px-1">
        {title}{count !== undefined ? ` · ${count}` : ''}
      </h2>
      {children}
    </section>
  );
}

export default function MyTasksPage() {
  const { openTask, closeTask, selectedTaskId } = useTaskDrawer();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const deleteMutation = useDeleteTaskMutation((taskId) => {
    setDeleteTarget(null);
    if (selectedTaskId === taskId) closeTask();
  });

  const requestDeleteTask = (task: Task) => {
    setDeleteTarget({ id: task.id, title: task.title });
  };

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => tasksApi.my().then((r) => r.data.data),
  });

  const groups = useMemo(() => {
    const overdue: Task[] = [];
    const today: Task[] = [];
    const thisWeek: Task[] = [];
    const blocked: Task[] = [];
    const review: Task[] = [];
    const completed: Task[] = [];
    const later: Task[] = [];

    for (const t of tasks || []) {
      if (t.status === 'completed') { completed.push(t); continue; }
      if (t.status === 'blocked') { blocked.push(t); continue; }
      if (['ready_for_review', 'in_review'].includes(t.status)) { review.push(t); continue; }
      if (t.due_date) {
        const d = new Date(t.due_date);
        if (isPast(d) && !isToday(d)) overdue.push(t);
        else if (isToday(d)) today.push(t);
        else if (isThisWeek(d)) thisWeek.push(t);
        else later.push(t);
      } else later.push(t);
    }
    return { overdue, today, thisWeek, blocked, review, completed, later };
  }, [tasks]);

  if (isLoading) return <TaskDatabaseSkeleton />;

  const openCount = (tasks || []).filter((t) => !['completed', 'cancelled'].includes(t.status)).length;

  return (
    <div className="w-full pb-12">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-text-primary">My Tasks</h1>
        <p className="text-sm text-text-muted mt-0.5">{openCount} open</p>
      </header>

      {!tasks?.length ? (
        <EmptyState title="Nothing assigned yet" description="Tasks assigned to you will show up here." />
      ) : (
        <>
          {groups.overdue.length > 0 && <Section title="Overdue" count={groups.overdue.length}><TaskList tasks={groups.overdue} onTaskClick={openTask} onDeleteTask={requestDeleteTask} /></Section>}
          {groups.blocked.length > 0 && <Section title="Blocked" count={groups.blocked.length}><TaskList tasks={groups.blocked} onTaskClick={openTask} onDeleteTask={requestDeleteTask} /></Section>}
          {groups.review.length > 0 && <Section title="Waiting for review" count={groups.review.length}><TaskList tasks={groups.review} onTaskClick={openTask} onDeleteTask={requestDeleteTask} /></Section>}
          {groups.today.length > 0 && <Section title="Due today" count={groups.today.length}><TaskList tasks={groups.today} onTaskClick={openTask} onDeleteTask={requestDeleteTask} /></Section>}
          {groups.thisWeek.length > 0 && <Section title="This week" count={groups.thisWeek.length}><TaskList tasks={groups.thisWeek} onTaskClick={openTask} onDeleteTask={requestDeleteTask} /></Section>}
          {groups.later.length > 0 && <Section title="Upcoming" count={groups.later.length}><TaskList tasks={groups.later} onTaskClick={openTask} onDeleteTask={requestDeleteTask} /></Section>}
          {groups.completed.length > 0 && <Section title="Completed" count={groups.completed.length}><TaskList tasks={groups.completed} onTaskClick={openTask} onDeleteTask={requestDeleteTask} /></Section>}
        </>
      )}

      <DeleteTaskModal
        isOpen={deleteTarget != null}
        taskTitle={deleteTarget?.title}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(reason) => {
          if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id, reason });
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
