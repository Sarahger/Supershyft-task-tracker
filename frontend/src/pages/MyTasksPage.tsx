import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isPast, isToday, isThisWeek } from 'date-fns';
import { Plus, X } from 'lucide-react';
import { tasksApi } from '../services/endpoints';
import { useTaskDrawer } from '../contexts/TaskDrawerContext';
import { useAuth } from '../contexts/AuthContext';
import { canDeleteTasks } from '../lib/roles';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useDeleteTaskMutation } from '../hooks/useDeleteTaskMutation';
import { TaskDatabase, TaskDatabaseSkeleton } from '../components/tasks/TaskDatabase';
import { MobileTaskCard } from '../components/tasks/MobileTaskCard';
import { DeleteTaskModal } from '../components/tasks/DeleteTaskModal';
import { FloatingActionButton } from '../components/layout/FloatingActionButton';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { STATUS_LABELS, type Task } from '../types';

function TaskList({
  tasks,
  onTaskClick,
  onDeleteTask,
  selectedIds,
  onSelectionChange,
}: {
  tasks: Task[];
  onTaskClick: (id: number) => void;
  onDeleteTask?: (task: Task) => void;
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
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
          />
        ))}
      </div>
    );
  }
  return (
    <TaskDatabase
      tasks={tasks}
      onTaskClick={onTaskClick}
      onDeleteTask={onDeleteTask}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      showProject
    />
  );
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
  const { openTask, closeTask, selectedTaskId, openCreate } = useTaskDrawer();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const allowDelete = canDeleteTasks(user);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const deleteMutation = useDeleteTaskMutation((taskId) => {
    setDeleteTarget(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    if (selectedTaskId === taskId) closeTask();
  });

  const requestDeleteTask = (task: Task) => {
    setDeleteTarget({ id: task.id, title: task.title });
  };

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => tasksApi.my().then((r) => r.data.data),
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: string }) => {
      await Promise.all(ids.map((id) => tasksApi.updateStatus(id, status)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedIds(new Set());
      toast.success('Tasks updated');
    },
    onError: () => toast.error('Could not update selected tasks'),
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

  const listProps = {
    onTaskClick: openTask,
    onDeleteTask: allowDelete ? requestDeleteTask : undefined,
    selectedIds,
    onSelectionChange: setSelectedIds,
  };

  return (
    <div className="w-full pb-12">
      <header className="mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">My Tasks</h1>
          <p className="text-sm text-text-muted mt-0.5">{openCount} open</p>
        </div>
        <Button
          onClick={openCreate}
          size="sm"
          className="h-9 px-2.5 py-0 shrink-0 gap-1.5"
          aria-label="New task"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New task</span>
        </Button>
      </header>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 mb-4 rounded-md bg-surface-subtle border border-dark-border max-md:hidden">
          <span className="text-sm text-text-secondary">{selectedIds.size} selected</span>
          <select
            className="input py-1 text-xs w-auto"
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              bulkMutation.mutate({ ids: Array.from(selectedIds), status: e.target.value });
              e.target.value = '';
            }}
          >
            <option value="" disabled>Change status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="toolbar-btn ml-auto text-text-muted"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}

      {!tasks?.length ? (
        <EmptyState
          title="Nothing assigned yet"
          description="Create a task or wait for one to be assigned to you."
          action={
            <Button onClick={openCreate} className="mt-2 gap-1.5">
              <Plus className="h-4 w-4" />
              New task
            </Button>
          }
        />
      ) : (
        <>
          {groups.overdue.length > 0 && <Section title="Overdue" count={groups.overdue.length}><TaskList tasks={groups.overdue} {...listProps} /></Section>}
          {groups.blocked.length > 0 && <Section title="Blocked" count={groups.blocked.length}><TaskList tasks={groups.blocked} {...listProps} /></Section>}
          {groups.review.length > 0 && <Section title="Waiting for review" count={groups.review.length}><TaskList tasks={groups.review} {...listProps} /></Section>}
          {groups.today.length > 0 && <Section title="Due today" count={groups.today.length}><TaskList tasks={groups.today} {...listProps} /></Section>}
          {groups.thisWeek.length > 0 && <Section title="This week" count={groups.thisWeek.length}><TaskList tasks={groups.thisWeek} {...listProps} /></Section>}
          {groups.later.length > 0 && <Section title="Upcoming" count={groups.later.length}><TaskList tasks={groups.later} {...listProps} /></Section>}
          {groups.completed.length > 0 && <Section title="Completed" count={groups.completed.length}><TaskList tasks={groups.completed} {...listProps} /></Section>}
        </>
      )}

      {isMobile && <FloatingActionButton onClick={openCreate} />}

      {allowDelete && (
      <DeleteTaskModal
        isOpen={deleteTarget != null}
        taskTitle={deleteTarget?.title}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(reason) => {
          if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id, reason });
        }}
        isPending={deleteMutation.isPending}
      />
      )}
    </div>
  );
}
