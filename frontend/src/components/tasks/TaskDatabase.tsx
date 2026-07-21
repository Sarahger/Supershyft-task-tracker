import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { format, isPast, isToday } from 'date-fns';
import {
  MessageSquare, Paperclip, ListChecks, Link2, Bug, Eye, FlaskConical,
  ChevronUp, ChevronDown, GripVertical, Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import type { Task } from '../../types';
import { statusStyles, priorityStyles } from '../ui/Badge';
import { AvatarGroup } from '../ui/Avatar';
import { STATUS_LABELS, PRIORITY_LABELS } from '../../types';

const INLINE_SELECT_CLASS =
  'chip cursor-pointer appearance-none pl-2 pr-7 max-w-full truncate text-xs leading-tight border border-transparent hover:border-dark-border focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]';

function stopRowActivation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

interface TaskDatabaseProps {
  tasks: Task[];
  onTaskClick: (id: number) => void;
  showProject?: boolean;
  sortField?: SortField;
  sortDir?: SortDir;
  onSort?: (field: SortField) => void;
  selectedIds?: Set<number>;
  onSelectionChange?: (ids: Set<number>) => void;
  focusedIndex?: number;
  onFocusIndexChange?: (index: number) => void;
  onStatusChange?: (id: number, status: string) => void;
  onPriorityChange?: (id: number, priority: string) => void;
  onDeleteTask?: (task: Task) => void;
  editable?: boolean;
  columns?: ColumnDef[];
  onColumnsChange?: React.Dispatch<React.SetStateAction<ColumnDef[]>>;
}

export type ColumnId = 'title' | 'assignees' | 'priority' | 'due_date' | 'status' | 'estimated_hours' | 'actual_hours' | 'indicators';

export interface ColumnDef {
  id: ColumnId;
  label: string;
  width: number;
  minWidth: number;
  visible: boolean;
  sortable?: boolean;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'title', label: 'Task name', width: 320, minWidth: 200, visible: true, sortable: true },
  { id: 'assignees', label: 'Assignee', width: 130, minWidth: 100, visible: true },
  { id: 'due_date', label: 'Due date', width: 110, minWidth: 90, visible: true, sortable: true },
  { id: 'status', label: 'Status', width: 150, minWidth: 120, visible: true, sortable: true },
  { id: 'priority', label: 'Priority', width: 120, minWidth: 100, visible: true, sortable: true },
  { id: 'estimated_hours', label: 'Time req', width: 90, minWidth: 70, visible: false },
  { id: 'actual_hours', label: 'Time taken', width: 90, minWidth: 70, visible: false },
  { id: 'indicators', label: '', width: 160, minWidth: 120, visible: true },
];

export type SortField = 'title' | 'priority' | 'due_date' | 'status' | 'updated_at';
export type SortDir = 'asc' | 'desc';

function InlineStatusSelect({
  task,
  onStatusChange,
  editable,
}: {
  task: Task;
  onStatusChange?: (id: number, status: string) => void;
  editable?: boolean;
}) {
  if (!editable || !onStatusChange) {
    return (
      <span className={clsx('chip', statusStyles[task.status] || 'bg-surface-muted text-text-secondary')}>
        {STATUS_LABELS[task.status] || task.status}
      </span>
    );
  }
  return (
    <select
      value={task.status}
      onClick={stopRowActivation}
      onMouseDown={stopRowActivation}
      onChange={(e) => {
        stopRowActivation(e);
        onStatusChange(task.id, e.target.value);
      }}
      className={clsx(INLINE_SELECT_CLASS, statusStyles[task.status] || 'bg-surface-muted text-text-secondary')}
      aria-label={`Status for ${task.title}`}
    >
      {Object.entries(STATUS_LABELS).map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

function InlinePrioritySelect({
  task,
  onPriorityChange,
  editable,
}: {
  task: Task;
  onPriorityChange?: (id: number, priority: string) => void;
  editable?: boolean;
}) {
  if (!editable || !onPriorityChange) {
    return (
      <span className={clsx('chip bg-transparent px-0', priorityStyles[task.priority] || 'text-text-secondary')}>
        {PRIORITY_LABELS[task.priority] || task.priority}
      </span>
    );
  }
  return (
    <select
      value={task.priority}
      onClick={stopRowActivation}
      onMouseDown={stopRowActivation}
      onChange={(e) => {
        stopRowActivation(e);
        onPriorityChange(task.id, e.target.value);
      }}
      className={clsx(INLINE_SELECT_CLASS, priorityStyles[task.priority] || 'text-text-secondary', 'bg-surface-muted')}
      aria-label={`Priority for ${task.title}`}
    >
      {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

function DueDate({ date, status }: { date?: string; status: string }) {
  if (!date) return <span className="text-text-muted text-sm">—</span>;
  const d = new Date(date);
  const overdue = isPast(d) && !isToday(d) && !['completed', 'cancelled'].includes(status);
  const today = isToday(d);
  return (
    <span className={clsx('text-sm tabular-nums', overdue ? 'priority-critical' : today ? 'text-accent-primary' : 'text-text-muted')}>
      {format(d, 'MMM d')}
    </span>
  );
}

function RowIndicators({ task }: { task: Task }) {
  const depCount = task.dependencies?.length ?? 0;
  const icons: { show: boolean; icon: React.ReactNode; title: string }[] = [
    { show: (task.comment_count ?? 0) > 0, icon: <><MessageSquare className="h-3 w-3" /><span>{task.comment_count}</span></>, title: 'Comments' },
    { show: (task.attachment_count ?? 0) > 0, icon: <><Paperclip className="h-3 w-3" /><span>{task.attachment_count}</span></>, title: 'Attachments' },
    { show: !!task.checklist_progress, icon: <><ListChecks className="h-3 w-3" /><span>{task.checklist_progress}</span></>, title: 'Checklist' },
    { show: depCount > 0, icon: <><Link2 className="h-3 w-3" /><span>{depCount}</span></>, title: 'Dependencies' },
    { show: !!task.severity || task.status === 'bugs_found', icon: <Bug className="h-3 w-3" />, title: 'Bug' },
    { show: task.review_required, icon: <Eye className="h-3 w-3" />, title: 'Review required' },
    { show: task.testing_required, icon: <FlaskConical className="h-3 w-3" />, title: 'Testing required' },
  ];
  const visible = icons.filter((i) => i.show);
  if (!visible.length) return null;
  return (
    <div className="flex items-center gap-2.5 text-text-muted">
      {visible.map((item, i) => (
        <span key={i} className="flex items-center gap-0.5 text-2xs opacity-60 hover:opacity-100 transition-opacity duration-hover" title={item.title}>
          {item.icon}
        </span>
      ))}
    </div>
  );
}

export function TaskDatabase({
  tasks,
  onTaskClick,
  showProject = false,
  sortField,
  sortDir,
  onSort,
  selectedIds = new Set(),
  onSelectionChange,
  focusedIndex = -1,
  onFocusIndexChange,
  onStatusChange,
  onPriorityChange,
  onDeleteTask,
  editable = false,
  columns: columnsProp,
  onColumnsChange,
}: TaskDatabaseProps) {
  const [internalColumns, setInternalColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const columns = columnsProp ?? internalColumns;
  const setColumns = onColumnsChange ?? setInternalColumns;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: number } | null>(null);
  const [resizing, setResizing] = useState<{ colId: ColumnId; startX: number; startWidth: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const visibleColumns = columns.filter((c) => c.visible);

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const allVisibleSelected = tasks.length > 0 && tasks.every((t) => selectedIds.has(t.id));

  const toggleSelectAll = () => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (allVisibleSelected) {
      tasks.forEach((t) => next.delete(t.id));
    } else {
      tasks.forEach((t) => next.add(t.id));
    }
    onSelectionChange(next);
  };

  const handleContextMenu = (e: React.MouseEvent, taskId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, taskId });
  };

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return;
    const delta = e.clientX - resizing.startX;
    setColumns((cols) =>
      cols.map((c) =>
        c.id === resizing.colId
          ? { ...c, width: Math.max(c.minWidth, resizing.startWidth + delta) }
          : c
      )
    );
  }, [resizing]);

  const handleResizeEnd = useCallback(() => setResizing(null), []);

  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);

  const totalWidth = visibleColumns.reduce((s, c) => s + c.width, 0) + 40 + (onDeleteTask ? 44 : 0);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <div ref={tableRef} className="task-table relative rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth }}>
          {/* Header */}
          <div className="task-table-header flex items-stretch sticky top-0 z-10">
            <div className="db-header-cell w-10 shrink-0 flex items-center justify-center">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                className="rounded border-dark-border bg-dark-card text-text-primary focus:ring-[var(--focus-ring)]"
              />
            </div>
            {visibleColumns.map((col) => (
              <div
                key={col.id}
                className="db-header-cell relative flex items-center gap-1"
                style={{ width: col.width }}
              >
                {col.sortable && onSort ? (
                  <button
                    onClick={() => onSort(col.id as SortField)}
                    className="flex items-center gap-1 hover:text-text-secondary transition-colors duration-hover"
                  >
                    {col.label}
                    <SortIcon field={col.id as SortField} />
                  </button>
                ) : (
                  col.label
                )}
                {col.id !== 'indicators' && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-surface-active flex items-center justify-center"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setResizing({ colId: col.id, startX: e.clientX, startWidth: col.width });
                    }}
                  >
                    <GripVertical className="h-3 w-3 opacity-0 hover:opacity-50" />
                  </div>
                )}
              </div>
            ))}
            {onDeleteTask && <div className="db-header-cell w-11 shrink-0" aria-hidden />}
          </div>

          {/* Rows */}
          {tasks.map((task, index) => {
            const isSelected = selectedIds.has(task.id);
            const isFocused = focusedIndex === index;
            return (
              <div
                key={task.id}
                onClick={() => onTaskClick(task.id)}
                onContextMenu={(e) => handleContextMenu(e, task.id)}
                onMouseEnter={() => onFocusIndexChange?.(index)}
                className={clsx(
                  'db-row group',
                  isSelected && 'db-row-selected',
                  isFocused && 'db-row-focused'
                )}
              >
                <div className="db-cell w-10 shrink-0 justify-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => toggleSelect(task.id, e as unknown as React.MouseEvent)}
                    className="rounded border-dark-border bg-dark-card"
                  />
                </div>
                {visibleColumns.map((col) => (
                  <div
                    key={col.id}
                    className="db-cell overflow-hidden"
                    style={{ width: col.width }}
                  >
                    {col.id === 'title' && (
                      <div className="min-w-0 flex items-center gap-2">
                        {task.is_blocked && <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
                          {showProject && task.project_name && (
                            <p className="text-2xs text-text-muted truncate mt-0.5">{task.project_name}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {col.id === 'assignees' && (
                      task.assignees?.length > 0 ? (
                        <AvatarGroup users={task.assignees.map((a) => a.user!).filter(Boolean)} max={2} />
                      ) : (
                        <span className="text-2xs text-text-muted">—</span>
                      )
                    )}
                    {col.id === 'priority' && (
                      <InlinePrioritySelect
                        task={task}
                        editable={editable}
                        onPriorityChange={onPriorityChange}
                      />
                    )}
                    {col.id === 'due_date' && <DueDate date={task.due_date} status={task.status} />}
                    {col.id === 'status' && (
                      <InlineStatusSelect
                        task={task}
                        editable={editable}
                        onStatusChange={onStatusChange}
                      />
                    )}
                    {col.id === 'estimated_hours' && (
                      <span className="text-sm text-text-muted tabular-nums">
                        {task.estimated_hours != null ? `${task.estimated_hours}h` : '—'}
                      </span>
                    )}
                    {col.id === 'actual_hours' && (
                      <span className="text-sm text-text-muted tabular-nums">
                        {task.actual_hours != null ? `${task.actual_hours}h` : '—'}
                      </span>
                    )}
                    {col.id === 'indicators' && <RowIndicators task={task} />}
                  </div>
                ))}
                {onDeleteTask && (
                  <div
                    className="db-cell w-11 shrink-0 justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onDeleteTask(task)}
                      className="p-1.5 rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent-danger hover:bg-red-500/10 transition-all duration-hover"
                      title="Delete task"
                      aria-label={`Delete ${task.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-xl dropdown-panel border border-dark-border py-1 animate-in fade-in duration-dropdown"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-dark-hover transition-colors duration-hover"
            onClick={() => { onTaskClick(contextMenu.taskId); setContextMenu(null); }}
          >
            Open task
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-dark-hover transition-colors duration-hover"
            onClick={() => {
              if (onSelectionChange) onSelectionChange(new Set([contextMenu.taskId]));
              setContextMenu(null);
            }}
          >
            Select
          </button>
          {onDeleteTask && (
            <button
              className="w-full px-3 py-1.5 text-left text-sm text-accent-danger hover:bg-dark-hover transition-colors duration-hover"
              onClick={() => {
                const task = tasks.find((t) => t.id === contextMenu.taskId);
                if (task) onDeleteTask(task);
                setContextMenu(null);
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function useColumnVisibility() {
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const toggleColumn = (id: ColumnId) => {
    setColumns((cols) => cols.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  };
  return { columns, toggleColumn, setColumns };
}

export function TaskDatabaseSkeleton() {
  return (
    <div className="rounded-lg border border-dark-border bg-dark-card overflow-hidden">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-11 border-b border-dark-border bg-surface-subtle animate-pulse" />
      ))}
    </div>
  );
}

// Re-export simple wrapper for section-based pages
export { TaskDatabase as TaskTable, TaskDatabaseSkeleton as TaskTableSkeleton };
