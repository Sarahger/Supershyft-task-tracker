import { useState } from 'react';
import {
  Search, SlidersHorizontal, ArrowUpDown, Layers, LayoutList, Columns3,
  CalendarDays, CalendarRange,
} from 'lucide-react';
import clsx from 'clsx';
import { STATUS_LABELS } from '../../types';
import { useTaskViewPreferences } from '../../contexts/TaskViewPreferencesContext';
import { BottomSheet } from '../ui/BottomSheet';
import type { GroupBy, ViewMode } from './TaskToolbar';

interface AssigneeOption {
  id: number;
  first_name: string;
  last_name: string;
}

interface MobileTaskToolbarProps {
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
  showViewSelector?: boolean;
  quickFilter: string;
  onQuickFilterChange: (v: string) => void;
  quickFilterOptions: { id: string; label: string }[];
}

const sortOptions = [
  { v: 'updated_at', l: 'Last updated' },
  { v: 'title', l: 'Name' },
  { v: 'due_date', l: 'Due date' },
  { v: 'priority', l: 'Priority' },
  { v: 'status', l: 'Status' },
];

const viewOptions: { v: ViewMode; l: string; icon: typeof LayoutList }[] = [
  { v: 'table', l: 'List', icon: LayoutList },
  { v: 'kanban', l: 'Board', icon: Columns3 },
  { v: 'calendar', l: 'Calendar', icon: CalendarDays },
  { v: 'weekly', l: 'Week', icon: CalendarRange },
];

export function MobileTaskToolbar({
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
  showViewSelector = true,
  quickFilter,
  onQuickFilterChange,
  quickFilterOptions,
}: MobileTaskToolbarProps) {
  const { enabledViewModes } = useTaskViewPreferences();
  const visibleViewOptions = viewOptions.filter((opt) => enabledViewModes.includes(opt.v));
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeFilters = [statusFilter, priorityFilter, assigneeFilter].filter(Boolean).length;

  return (
    <div className="md:hidden space-y-3 mb-4">
      {/* Sticky search + filter */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-dark-bg/95 backdrop-blur-sm border-b border-dark-border/50">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
            <input
              className="input pl-10 py-2.5 text-sm w-full h-11 rounded-xl"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search tasks"
            />
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={clsx(
              'relative shrink-0 flex items-center justify-center h-11 w-11 rounded-xl border border-dark-border bg-dark-card',
              'text-text-secondary hover:bg-dark-hover transition-colors',
              activeFilters > 0 && 'border-accent-primary/40 text-text-primary',
            )}
            aria-label="Filter and sort"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent-primary text-[10px] text-white flex items-center justify-center font-medium">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Horizontal scrollable filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {quickFilterOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onQuickFilterChange(opt.id)}
            className={clsx(
              'shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition-colors min-h-[36px]',
              quickFilter === opt.id
                ? 'bg-accent-primary text-white'
                : 'bg-dark-card border border-dark-border text-text-secondary hover:bg-dark-hover',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="Filter & sort">
        {/* View */}
        {showViewSelector && visibleViewOptions.length > 1 && (
          <section className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <LayoutList className="h-4 w-4 text-text-muted" />
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">View</h3>
            </div>
            <div className={clsx(
              'grid gap-2',
              visibleViewOptions.length === 2 && 'grid-cols-2',
              visibleViewOptions.length === 3 && 'grid-cols-3',
              visibleViewOptions.length >= 4 && 'grid-cols-4',
            )}>
              {visibleViewOptions.map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => onViewModeChange(opt.v)}
                  className={clsx(
                    'flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium min-h-[72px] transition-colors',
                    viewMode === opt.v
                      ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                      : 'border-dark-border bg-surface-subtle text-text-secondary hover:bg-dark-hover',
                  )}
                >
                  <opt.icon className="h-4 w-4" />
                  {opt.l}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Sort */}
        <section className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpDown className="h-4 w-4 text-text-muted" />
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">Sort</h3>
          </div>
          <div className="space-y-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => onSortFieldChange(opt.v)}
                className={clsx(
                  'w-full text-left px-3 py-3 rounded-xl text-sm min-h-[44px] transition-colors',
                  sortField === opt.v ? 'bg-dark-hover text-text-primary font-medium' : 'text-text-secondary hover:bg-dark-hover',
                )}
              >
                {opt.l}
              </button>
            ))}
            <button
              type="button"
              onClick={onSortDirToggle}
              className="w-full text-left px-3 py-3 rounded-xl text-sm text-text-secondary hover:bg-dark-hover min-h-[44px]"
            >
              {sortDir === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </button>
          </div>
        </section>

        {/* Group */}
        <section className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-text-muted" />
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">Group by</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['none', 'status', 'priority', 'project'] as GroupBy[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onGroupByChange(g)}
                className={clsx(
                  'px-3 py-3 rounded-xl text-sm capitalize min-h-[44px] border transition-colors',
                  groupBy === g
                    ? 'border-accent-primary bg-accent-primary/10 text-text-primary font-medium'
                    : 'border-dark-border bg-surface-subtle text-text-secondary hover:bg-dark-hover',
                )}
              >
                {g === 'none' ? 'None' : g}
              </button>
            ))}
          </div>
        </section>

        {/* Filters */}
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3">Filters</h3>
          <label className="text-2xs text-text-muted uppercase tracking-wider mb-1 block">Status</label>
          <select
            className="input py-2.5 text-sm mb-4 w-full min-h-[44px]"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="text-2xs text-text-muted uppercase tracking-wider mb-1 block">Priority</label>
          <select
            className="input py-2.5 text-sm mb-4 w-full min-h-[44px]"
            value={priorityFilter}
            onChange={(e) => onPriorityFilterChange(e.target.value)}
          >
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          {onAssigneeFilterChange && assigneeOptions.length > 0 && (
            <>
              <label className="text-2xs text-text-muted uppercase tracking-wider mb-1 block">Assignee</label>
              <select
                className="input py-2.5 text-sm w-full min-h-[44px]"
                value={assigneeFilter}
                onChange={(e) => onAssigneeFilterChange(e.target.value)}
              >
                <option value="">All assignees</option>
                {assigneeOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
            </>
          )}
        </section>

        <button
          type="button"
          onClick={() => setSheetOpen(false)}
          className="mt-4 w-full py-3 rounded-xl bg-accent-primary text-white text-sm font-medium min-h-[48px] hover:opacity-90 transition-opacity"
        >
          Apply
        </button>
      </BottomSheet>
    </div>
  );
}
