import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { tasksApi, miscApi, usersApi } from '../../services/endpoints';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useTaskViewPreferences } from '../../contexts/TaskViewPreferencesContext';
import { TaskDatabase, TaskDatabaseSkeleton, useColumnVisibility, type SortField } from './TaskDatabase';
import { TaskToolbar, SavedFiltersBar, type GroupBy, type ViewMode } from './TaskToolbar';
import { MobileTaskToolbar } from './MobileTaskToolbar';
import { MobileTasksView } from './MobileTasksView';
import { FloatingActionButton } from '../layout/FloatingActionButton';
import { EmptyState } from '../ui/Skeleton';
import { DeleteTaskModal } from './DeleteTaskModal';
import { toast } from '../ui/Toast';
import { useDeleteTaskMutation } from '../../hooks/useDeleteTaskMutation';
import type { Task } from '../../types';
import clsx from 'clsx';
import api from '../../services/api';

const KanbanBoard = lazy(() => import('./KanbanBoard').then((m) => ({ default: m.KanbanBoard })));
const TaskCalendar = lazy(() => import('./TaskCalendar').then((m) => ({ default: m.TaskCalendar })));
const TaskWeekView = lazy(() => import('./TaskWeekView').then((m) => ({ default: m.TaskWeekView })));
const TaskCalendarSkeleton = lazy(() => import('./TaskCalendar').then((m) => ({ default: m.TaskCalendarSkeleton })));
const TaskWeekViewSkeleton = lazy(() => import('./TaskWeekView').then((m) => ({ default: m.TaskWeekViewSkeleton })));

const REFERENCE_STALE_MS = 5 * 60 * 1000;

export type QuickFilter = 'all' | 'overdue' | 'today' | 'blocked' | 'review' | 'completed';

interface TasksWorkspaceProps {
  title: string;
  subtitle?: string;
  queryKey: string[];
  fetchTasks?: () => Promise<Task[]>;
  listFilters?: Record<string, unknown>;
  showProject?: boolean;
  showViewSelector?: boolean;
  defaultView?: ViewMode;
  fullWidth?: boolean;
  showQuickFilters?: boolean;
}

function groupTasks(tasks: Task[], groupBy: GroupBy): { label: string; tasks: Task[] }[] {
  if (groupBy === 'none') return [{ label: '', tasks }];
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    let key = 'Other';
    if (groupBy === 'status') key = t.status;
    else if (groupBy === 'priority') key = t.priority;
    else if (groupBy === 'project') key = t.project_name || 'No project';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries()).map(([label, tasks]) => ({ label, tasks }));
}

export function TasksWorkspace({
  title,
  subtitle,
  queryKey,
  fetchTasks,
  listFilters,
  showProject = false,
  showViewSelector = true,
  defaultView = 'table',
  fullWidth = false,
  showQuickFilters = false,
}: TasksWorkspaceProps) {
  const { openTask, openCreate, closeTask, selectedTaskId } = useTaskDrawer();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { normalizeView, hasOptionalViews } = useTaskViewPreferences();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<GroupBy>(() => (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'project' : 'none'));
  const [viewMode, setViewMode] = useState<ViewMode>(() => normalizeView(defaultView));
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [calendarWeek, setCalendarWeek] = useState(() => new Date());
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const { columns, toggleColumn, setColumns } = useColumnVisibility();

  const deleteMutation = useDeleteTaskMutation((taskId) => {
    setDeleteTarget(null);
    if (selectedTaskId === taskId) closeTask();
    qc.invalidateQueries({ queryKey });
  });

  useEffect(() => {
    setViewMode((current) => normalizeView(current));
  }, [normalizeView]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(normalizeView(mode));
  };

  const showViews = showViewSelector && hasOptionalViews;

  const requestDeleteTask = (task: Task) => {
    setDeleteTarget({ id: task.id, title: task.title });
  };

  const calendarWindow = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    return {
      due_after: startOfWeek(monthStart, { weekStartsOn: 1 }).toISOString(),
      due_before: endOfWeek(monthEnd, { weekStartsOn: 1 }).toISOString(),
    };
  }, [calendarMonth]);

  const weekWindow = useMemo(() => {
    const weekStart = startOfWeek(calendarWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(calendarWeek, { weekStartsOn: 1 });
    return {
      due_after: weekStart.toISOString(),
      due_before: weekEnd.toISOString(),
    };
  }, [calendarWeek]);

  const sharedListFilters = useMemo(() => ({
    search: search || undefined,
    status: quickFilter === 'completed' ? 'completed' : (statusFilter || undefined),
    priority: priorityFilter || undefined,
    assignee_id: assigneeFilter ? Number(assigneeFilter) : undefined,
    overdue: quickFilter === 'overdue' ? true : undefined,
    blocked: quickFilter === 'blocked' ? true : undefined,
    awaiting_review: quickFilter === 'review' ? true : undefined,
  }), [search, statusFilter, priorityFilter, assigneeFilter, quickFilter]);

  const filters = useMemo(() => {
    if (viewMode === 'calendar') {
      return {
        ...sharedListFilters,
        page: 1,
        page_size: 500,
        has_due_date: true,
        due_after: calendarWindow.due_after,
        due_before: calendarWindow.due_before,
        sort_by: 'due_date',
        sort_order: 'asc',
      };
    }
    if (viewMode === 'weekly') {
      return {
        ...sharedListFilters,
        page: 1,
        page_size: 500,
        has_due_date: true,
        due_after: weekWindow.due_after,
        due_before: weekWindow.due_before,
        sort_by: 'due_date',
        sort_order: 'asc',
      };
    }
    return {
      ...sharedListFilters,
      page,
      page_size: 50,
      sort_by: sortField,
      sort_order: sortDir,
    };
  }, [sharedListFilters, viewMode, calendarWindow, weekWindow, page, sortField, sortDir]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...queryKey, filters, listFilters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (queryKey[0] === 'my-tasks' && fetchTasks) {
        const tasks = await fetchTasks();
        let filtered = tasks;
        if (search) filtered = filtered.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
        if (statusFilter) filtered = filtered.filter((t) => t.status === statusFilter);
        if (priorityFilter) filtered = filtered.filter((t) => t.priority === priorityFilter);
        if (assigneeFilter) {
          const uid = Number(assigneeFilter);
          filtered = filtered.filter((t) => t.assignees?.some((a) => a.user_id === uid));
        }
        return { items: filtered, total: filtered.length, total_pages: 1, page: 1 };
      }
      const res = await tasksApi.list({ ...filters, ...listFilters });
      return res.data.data;
    },
  });

  const { data: undatedCalendarTasks } = useQuery({
    queryKey: [...queryKey, 'calendar-undated', sharedListFilters, listFilters],
    queryFn: () =>
      tasksApi.list({
        ...sharedListFilters,
        ...listFilters,
        page: 1,
        page_size: 100,
        has_due_date: false,
        sort_by: 'updated_at',
        sort_order: 'desc',
      }).then((r) => r.data.data.items),
    enabled: (viewMode === 'calendar' || viewMode === 'weekly') && queryKey[0] !== 'my-tasks',
    staleTime: REFERENCE_STALE_MS,
  });

  const { data: usersList } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
    staleTime: REFERENCE_STALE_MS,
  });

  const { data: savedFilters } = useQuery({
    queryKey: ['saved-filters'],
    queryFn: () => api.get('/saved-filters').then((r) => r.data.data),
    retry: false,
    staleTime: REFERENCE_STALE_MS,
  });

  const { data: taskTypes } = useQuery({
    queryKey: ['task-types'],
    queryFn: () => miscApi.taskTypes().then((r) => r.data.data as { id: number; name: string }[]),
    staleTime: REFERENCE_STALE_MS,
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: string }) => {
      await Promise.all(ids.map((id) => tasksApi.updateStatus(id, status)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setSelectedIds(new Set());
      toast.success('Tasks updated');
    },
  });

  const tasks = data?.items || [];
  const displayTasks = useMemo(() => {
    if (quickFilter === 'today') {
      return tasks.filter((t) => t.due_date && isToday(new Date(t.due_date)));
    }
    if (quickFilter === 'completed') {
      return tasks.filter((t) => t.status === 'completed');
    }
    return tasks;
  }, [tasks, quickFilter]);
  const groups = groupTasks(displayTasks, groupBy);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => tasksApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const priorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: number; priority: string }) =>
      tasksApi.update(id, { priority }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('Priority updated');
    },
    onError: () => toast.error('Failed to update priority'),
  });

  const taskTypeMutation = useMutation({
    mutationFn: ({ id, taskTypeId }: { id: number; taskTypeId: number | null }) =>
      tasksApi.update(id, { task_type_id: taskTypeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('Task type updated');
    },
    onError: () => toast.error('Failed to update task type'),
  });

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, tasks.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0 && tasks[focusedIndex]) {
        openTask(tasks[focusedIndex].id);
      } else if (e.key === ' ' && focusedIndex >= 0 && tasks[focusedIndex]) {
        e.preventDefault();
        setSelectedIds((prev) => {
          const next = new Set(prev);
          const id = tasks[focusedIndex].id;
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [tasks, focusedIndex, openTask]);

  const applySavedFilter = (json: string) => {
    try {
      const f = JSON.parse(json);
      if (f.status) setStatusFilter(f.status);
      if (f.priority) setPriorityFilter(f.priority);
      if (f.assignee_id) setAssigneeFilter(String(f.assignee_id));
      if (f.search) setSearch(f.search);
      setPage(1);
    } catch { /* ignore */ }
  };

  const quickFilterOptions: { id: QuickFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'today', label: 'Today' },
    { id: 'blocked', label: 'Blocked' },
    { id: 'review', label: 'Review' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div className={clsx('flex flex-col min-h-0 pb-8', fullWidth ? 'w-full max-w-none' : 'max-w-workspace mx-auto', isMobile && 'pb-24')}>
      <div className={clsx('mb-5', isMobile && 'mb-3')}>
        {title && (
          <>
            <h1 className={clsx('font-semibold text-text-primary tracking-tight', isMobile ? 'text-lg' : 'text-xl')}>{title}</h1>
            {subtitle && !isMobile && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
          </>
        )}
      </div>

      {/* Desktop quick filters */}
      {showQuickFilters && !isMobile && (
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto flex-nowrap pb-0.5 -mx-1 px-1">
          {quickFilterOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { setQuickFilter(opt.id); setPage(1); }}
              className={clsx(
                'px-2.5 py-1 rounded-md text-sm transition-colors duration-hover shrink-0 whitespace-nowrap',
                quickFilter === opt.id
                  ? 'bg-surface-highlight text-text-primary'
                  : 'text-text-muted hover:bg-dark-hover hover:text-text-secondary'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Mobile toolbar */}
      {isMobile && (
        <MobileTaskToolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          statusFilter={statusFilter}
          onStatusFilterChange={(v) => { setStatusFilter(v); setPage(1); }}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={(v) => { setPriorityFilter(v); setPage(1); }}
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={(v) => { setAssigneeFilter(v); setPage(1); }}
          assigneeOptions={usersList ?? []}
          sortField={sortField}
          sortDir={sortDir}
          onSortFieldChange={(v) => setSortField(v as SortField)}
          onSortDirToggle={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          showViewSelector={showViews}
          quickFilter={quickFilter}
          onQuickFilterChange={(v) => { setQuickFilter(v as QuickFilter); setPage(1); }}
          quickFilterOptions={quickFilterOptions}
        />
      )}

      {/* Desktop toolbar */}
      <div className="max-md:hidden">
      <TaskToolbar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => { setStatusFilter(v); setPage(1); }}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={(v) => { setPriorityFilter(v); setPage(1); }}
        assigneeFilter={assigneeFilter}
        onAssigneeFilterChange={(v) => { setAssigneeFilter(v); setPage(1); }}
        assigneeOptions={usersList ?? []}
        sortField={sortField}
        sortDir={sortDir}
        onSortFieldChange={(v) => setSortField(v as SortField)}
        onSortDirToggle={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onNewTask={openCreate}
        totalCount={data?.total}
        visibleColumns={columns}
        onToggleColumn={toggleColumn}
        selectedCount={selectedIds.size}
        onBulkStatusChange={(status) => bulkMutation.mutate({ ids: Array.from(selectedIds), status })}
        onClearSelection={() => setSelectedIds(new Set())}
        showViewSelector={showViews}
      />
      </div>

      {savedFilters?.length > 0 && !isMobile && (
        <SavedFiltersBar filters={savedFilters} onApply={applySavedFilter} />
      )}

      {isLoading ? (
        <div className="space-y-3">
          <p className="text-sm text-text-muted max-md:hidden">Loading tasks…</p>
          {isMobile ? (
            <MobileTasksView tasks={[]} onTaskClick={() => {}} onCreateTask={openCreate} isLoading />
          ) : viewMode === 'calendar' ? (
            <Suspense fallback={<TaskDatabaseSkeleton />}><TaskCalendarSkeleton /></Suspense>
          ) : viewMode === 'weekly' ? (
            <Suspense fallback={<TaskDatabaseSkeleton />}><TaskWeekViewSkeleton /></Suspense>
          ) : (
            <TaskDatabaseSkeleton />
          )}
        </div>
      ) : isError ? (
        <EmptyState
          title="Could not load tasks"
          description={
            !(error as { response?: unknown })?.response
              ? 'The backend is not reachable. Start it with: cd backend && .\\venv\\Scripts\\uvicorn app.main:app --reload --port 8000'
              : 'Something went wrong loading tasks. Check that you are signed in and the API is running.'
          }
          action={
            <button onClick={() => refetch()} className="toolbar-btn mt-2 border border-dark-border">
              Retry
            </button>
          }
        />
      ) : !displayTasks.length && viewMode !== 'calendar' && viewMode !== 'weekly' && !isMobile ? (
        <EmptyState title="No tasks" description="Create a task or adjust your filters." />
      ) : viewMode === 'kanban' ? (
        <div className={clsx(isMobile && 'overflow-x-auto -mx-4 px-4')}>
        <Suspense fallback={<TaskDatabaseSkeleton />}>
          <KanbanBoard tasks={displayTasks} queryKey={queryKey} />
        </Suspense>
        </div>
      ) : viewMode === 'calendar' ? (
        <Suspense fallback={<TaskDatabaseSkeleton />}>
          <TaskCalendar
            tasks={displayTasks}
            undatedTasks={undatedCalendarTasks ?? []}
            currentMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
            onTaskClick={openTask}
            showProject={showProject}
          />
        </Suspense>
      ) : viewMode === 'weekly' ? (
        <Suspense fallback={<TaskDatabaseSkeleton />}>
          <TaskWeekView
            tasks={displayTasks}
            undatedTasks={undatedCalendarTasks ?? []}
            currentWeek={calendarWeek}
            onWeekChange={setCalendarWeek}
            onTaskClick={openTask}
            showProject={showProject}
          />
        </Suspense>
      ) : isMobile ? (
        <MobileTasksView
          tasks={displayTasks}
          onTaskClick={openTask}
          onCreateTask={openCreate}
          isLoading={isLoading}
          groupBy={groupBy}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label || 'all'}>
              {group.label && (
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 px-1 capitalize">
                  {group.label.replace(/_/g, ' ')}
                </h3>
              )}
              <TaskDatabase
                tasks={group.tasks}
                onTaskClick={openTask}
                showProject={showProject}
                columns={columns}
                onColumnsChange={setColumns}
                sortField={sortField}
                sortDir={sortDir}
                onSort={(field) => {
                  if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
                  else { setSortField(field); setSortDir('asc'); }
                }}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                focusedIndex={focusedIndex}
                onFocusIndexChange={setFocusedIndex}
                editable
                taskTypes={taskTypes ?? []}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                onPriorityChange={(id, priority) => priorityMutation.mutate({ id, priority })}
                onTaskTypeChange={(id, taskTypeId) => taskTypeMutation.mutate({ id, taskTypeId })}
                onDeleteTask={requestDeleteTask}
              />
            </div>
          ))}

          {data && data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4 text-sm text-text-muted">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="toolbar-btn disabled:opacity-30">Previous</button>
              <span>{page} / {data.total_pages}</span>
              <button disabled={page >= data.total_pages} onClick={() => setPage(page + 1)} className="toolbar-btn disabled:opacity-30">Next</button>
            </div>
          )}
        </div>
      )}

      {isMobile && <FloatingActionButton onClick={openCreate} />}

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
