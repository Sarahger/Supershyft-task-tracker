import { useState, useRef, useEffect } from 'react';
import {
  Search, Filter, ArrowUpDown, Layers, LayoutList, Plus, Columns3,
  ChevronDown, X, Bookmark, CalendarDays, CalendarRange,
} from 'lucide-react';
import clsx from 'clsx';
import { STATUS_LABELS } from '../../types';
import { useTaskViewPreferences } from '../../contexts/TaskViewPreferencesContext';
import type { ColumnId } from './TaskDatabase';
import { Button } from '../ui/Button';

export type ViewMode = 'table' | 'kanban' | 'calendar' | 'weekly';
export type GroupBy = 'none' | 'status' | 'priority' | 'project';

const VIEW_BUTTONS: { mode: ViewMode; icon: typeof LayoutList; title: string }[] = [
  { mode: 'table', icon: LayoutList, title: 'List' },
  { mode: 'kanban', icon: Columns3, title: 'Board' },
  { mode: 'calendar', icon: CalendarDays, title: 'Calendar' },
  { mode: 'weekly', icon: CalendarRange, title: 'Week' },
];

interface AssigneeOption {
  id: number;
  first_name: string;
  last_name: string;
}

interface TaskToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (v: string) => void;
  assigneeFilter?: string;
  onAssigneeFilterChange?: (v: string) => void;
  assigneeOptions?: AssigneeOption[];
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSortFieldChange: (v: string) => void;
  onSortDirToggle: () => void;
  groupBy: GroupBy;
  onGroupByChange: (v: GroupBy) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  onNewTask?: () => void;
  totalCount?: number;
  visibleColumns?: { id: ColumnId; label: string; visible: boolean }[];
  onToggleColumn?: (id: ColumnId) => void;
  selectedCount?: number;
  onBulkStatusChange?: (status: string) => void;
  onClearSelection?: () => void;
  showViewSelector?: boolean;
}

export function TaskToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  assigneeFilter = '',
  onAssigneeFilterChange,
  assigneeOptions = [],
  sortField,
  sortDir,
  onSortFieldChange,
  onSortDirToggle,
  groupBy,
  onGroupByChange,
  viewMode,
  onViewModeChange,
  onNewTask,
  totalCount,
  visibleColumns,
  onToggleColumn,
  selectedCount = 0,
  onBulkStatusChange,
  onClearSelection,
  showViewSelector = true,
}: TaskToolbarProps) {
  const { enabledViewModes } = useTaskViewPreferences();
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const anyMenuOpen = showFilter || showSort || showGroup || showColumns;

  const closeMenus = () => {
    setShowFilter(false);
    setShowSort(false);
    setShowGroup(false);
    setShowColumns(false);
  };

  useEffect(() => {
    if (!anyMenuOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (filterRef.current && target && !filterRef.current.contains(target)) {
        closeMenus();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenus();
    };

    // Capture phase so menus still close even if a child stops bubbling
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [anyMenuOpen]);

  const activeFilters = [statusFilter, priorityFilter, assigneeFilter].filter(Boolean).length;

  return (
    <div className="space-y-3 mb-4">
      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-surface-subtle border border-dark-border animate-in fade-in duration-status">
          <span className="text-sm text-text-secondary">{selectedCount} selected</span>
          <select
            className="input py-1 text-xs w-auto"
            onChange={(e) => { if (e.target.value && onBulkStatusChange) { onBulkStatusChange(e.target.value); e.target.value = ''; } }}
            defaultValue=""
          >
            <option value="" disabled>Change status</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button onClick={onClearSelection} className="toolbar-btn ml-auto text-text-muted">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:gap-3">
        {/* Search + new task */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-1 min-w-0 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
            <input
              className="input pl-8 py-1.5 text-sm w-full h-9"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          {totalCount !== undefined && (
            <span className="text-2xs text-text-muted hidden md:inline shrink-0">{totalCount} tasks</span>
          )}

          {onNewTask && (
          <Button
            onClick={onNewTask}
            size="sm"
            className="h-9 px-2.5 py-0 shrink-0 sm:ml-auto"
            aria-label="New task"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New task</span>
          </Button>
          )}
        </div>

        {/* Filters, sort, group, columns + view switcher */}
        {anyMenuOpen && (
          <div
            className="fixed inset-0 z-20"
            aria-hidden
            onMouseDown={closeMenus}
          />
        )}
        <div
          ref={filterRef}
          className={clsx('flex items-center gap-1 min-w-0 w-full', anyMenuOpen && 'relative z-30')}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
          {/* Filter */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setShowFilter(!showFilter); setShowSort(false); setShowGroup(false); setShowColumns(false); }}
              className={clsx('toolbar-btn', activeFilters > 0 && 'text-text-primary bg-dark-hover')}
              title="Filter"
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilters > 0 && <span className="text-2xs bg-surface-active px-1 rounded">{activeFilters}</span>}
            </button>
            {showFilter && (
              <div className="absolute top-full left-0 mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-xl dropdown-panel border border-dark-border p-3 z-30">
                <label className="text-2xs text-text-muted uppercase tracking-wider mb-1 block">Status</label>
                <select className="input py-1 text-sm mb-3" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
                  <option value="">All</option>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <label className="text-2xs text-text-muted uppercase tracking-wider mb-1 block">Priority</label>
                <select className="input py-1 text-sm mb-3" value={priorityFilter} onChange={(e) => onPriorityFilterChange(e.target.value)}>
                  <option value="">All</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                {onAssigneeFilterChange && assigneeOptions.length > 0 && (
                  <>
                    <label className="text-2xs text-text-muted uppercase tracking-wider mb-1 block">Assignee</label>
                    <select className="input py-1 text-sm" value={assigneeFilter} onChange={(e) => onAssigneeFilterChange(e.target.value)}>
                      <option value="">All</option>
                      {assigneeOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sort */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setShowSort(!showSort); setShowFilter(false); setShowGroup(false); setShowColumns(false); }}
              className="toolbar-btn"
              title="Sort"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sort</span>
            </button>
            {showSort && (
              <div className="absolute top-full left-0 mt-1 w-48 max-w-[calc(100vw-2rem)] rounded-xl dropdown-panel border border-dark-border p-2 z-30">
                {[
                  { v: 'updated_at', l: 'Last updated' },
                  { v: 'title', l: 'Name' },
                  { v: 'due_date', l: 'Due date' },
                  { v: 'priority', l: 'Priority' },
                  { v: 'status', l: 'Status' },
                ].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => onSortFieldChange(o.v)}
                    className={clsx('w-full text-left px-2 py-1.5 text-sm rounded hover:bg-dark-hover', sortField === o.v && 'text-text-primary bg-dark-hover')}
                  >
                    {o.l}
                  </button>
                ))}
                <div className="border-t border-dark-border mt-1 pt-1">
                  <button onClick={onSortDirToggle} className="w-full text-left px-2 py-1.5 text-sm text-text-secondary hover:bg-dark-hover rounded">
                    {sortDir === 'asc' ? '↑ Ascending' : '↓ Descending'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Group */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setShowGroup(!showGroup); setShowFilter(false); setShowSort(false); setShowColumns(false); }}
              className="toolbar-btn"
              title="Group"
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Group</span>
              {groupBy !== 'none' && <span className="text-2xs hidden sm:inline">· {groupBy}</span>}
            </button>
            {showGroup && (
              <div className="absolute top-full left-0 mt-1 w-40 max-w-[calc(100vw-2rem)] rounded-xl dropdown-panel border border-dark-border p-2 z-30">
                {(['none', 'status', 'priority', 'project'] as GroupBy[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => { onGroupByChange(g); setShowGroup(false); }}
                    className={clsx('w-full text-left px-2 py-1.5 text-sm rounded hover:bg-dark-hover capitalize', groupBy === g && 'bg-dark-hover text-text-primary')}
                  >
                    {g === 'none' ? 'None' : g}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Columns */}
          {visibleColumns && onToggleColumn && (
            <div className="relative shrink-0">
              <button
                onClick={() => { setShowColumns(!showColumns); setShowFilter(false); setShowSort(false); setShowGroup(false); }}
                className="toolbar-btn"
                title="Columns"
              >
                <Columns3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Columns</span>
              </button>
              {showColumns && (
                <div className="absolute top-full left-0 mt-1 w-44 max-w-[calc(100vw-2rem)] rounded-xl dropdown-panel border border-dark-border p-2 z-30">
                  {visibleColumns.filter((c) => c.id !== 'indicators').map((col) => (
                    <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-dark-hover rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => onToggleColumn(col.id)}
                        className="rounded border-dark-border"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>

          {/* View selector — always visible on the right */}
          {showViewSelector && (
            <div className="flex items-center rounded-lg border border-dark-border bg-dark-card p-0.5 shrink-0 ml-auto">
              {VIEW_BUTTONS.filter((btn) => enabledViewModes.includes(btn.mode)).map((btn) => (
                <button
                  key={btn.mode}
                  onClick={() => { onViewModeChange(btn.mode); closeMenus(); }}
                  className={clsx('px-2 py-1 rounded text-2xs transition-all duration-hover', viewMode === btn.mode ? 'bg-dark-hover text-text-primary' : 'text-text-muted hover:text-text-secondary')}
                  title={btn.title}
                >
                  <btn.icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SavedFiltersBar({ filters, onApply }: { filters: { id: number; name: string; filter_json: string }[]; onApply: (json: string) => void }) {
  if (!filters.length) return null;
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <Bookmark className="h-3.5 w-3.5 text-text-muted" />
      {filters.map((f) => (
        <button
          key={f.id}
          onClick={() => onApply(f.filter_json)}
          className="chip bg-surface-muted text-text-secondary hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover"
        >
          {f.name}
        </button>
      ))}
    </div>
  );
}
