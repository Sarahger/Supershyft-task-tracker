import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { MessageSquare, Paperclip, ListChecks, Link2, Bug, Eye, FlaskConical, ChevronUp, ChevronDown, GripVertical, Trash2, } from 'lucide-react';
import clsx from 'clsx';
import { statusStyles } from '../ui/Badge';
import { AvatarGroup } from '../ui/Avatar';
import { STATUS_SHORT_LABELS, PRIORITY_LABELS, statusSelectOptions } from '../../types';
import { formatTimeTakenHours } from '../../lib/taskTiming';
const INLINE_SELECT_CLASS = 'chip cursor-pointer appearance-none pl-2 pr-7 max-w-full truncate text-xs leading-tight border border-transparent hover:border-dark-border focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--focus-ring)]';
function stopRowActivation(e) {
    e.stopPropagation();
}
/** Columns never shown in the list (assignee lives in title; priority is title bg). */
const HIDDEN_COLUMN_IDS = new Set(['assignees', 'priority', 'actual_hours', 'start_date', 'end_date']);
const DEFAULT_COLUMNS = [
    { id: 'title', label: 'Task name', width: 360, minWidth: 220, visible: true, sortable: true },
    { id: 'due_date', label: 'Due date', width: 100, minWidth: 80, visible: true, sortable: true },
    { id: 'estimated_hours', label: 'Time required', width: 100, minWidth: 80, visible: true },
    { id: 'status', label: 'Status', width: 96, minWidth: 80, visible: true, sortable: true },
    { id: 'indicators', label: '', width: 160, minWidth: 120, visible: true },
];
/** Soft priority tint behind the task name cell. */
const TITLE_PRIORITY_BG = {
    low: 'bg-emerald-500/15',
    medium: 'bg-sky-500/15',
    high: 'bg-amber-400/20',
    critical: 'bg-red-500/18',
};
function shortStatusLabel(status) {
    return STATUS_SHORT_LABELS[status] || status.replace(/_/g, ' ');
}
function InlineStatusSelect({ task, onStatusChange, editable, }) {
    if (!editable || !onStatusChange) {
        return (_jsx("span", { className: clsx('chip', statusStyles[task.status] || 'bg-surface-muted text-text-secondary'), title: task.status.replace(/_/g, ' '), children: shortStatusLabel(task.status) }));
    }
    return (_jsx("select", { value: task.status === 'ready_for_review' ? 'in_review' : task.status, onClick: stopRowActivation, onMouseDown: stopRowActivation, onChange: (e) => {
            stopRowActivation(e);
            onStatusChange(task.id, e.target.value);
        }, className: clsx(INLINE_SELECT_CLASS, statusStyles[task.status] || 'bg-surface-muted text-text-secondary'), "aria-label": `Status for ${task.title}`, title: shortStatusLabel(task.status), children: statusSelectOptions(task.status).map(({ value }) => (_jsx("option", { value: value, children: shortStatusLabel(value) }, value))) }));
}
function DueDate({ date, status }) {
    if (!date)
        return _jsx("span", { className: "text-text-muted text-sm", children: "\u2014" });
    const d = new Date(date);
    const overdue = isPast(d) && !isToday(d) && !['completed', 'cancelled'].includes(status);
    const today = isToday(d);
    return (_jsx("span", { className: clsx('text-sm tabular-nums', overdue ? 'priority-critical' : today ? 'text-accent-primary' : 'text-text-muted'), children: format(d, 'MMM d') }));
}
function RowIndicators({ task }) {
    const depCount = task.dependencies?.length ?? 0;
    const icons = [
        { show: (task.comment_count ?? 0) > 0, icon: _jsxs(_Fragment, { children: [_jsx(MessageSquare, { className: "h-3 w-3" }), _jsx("span", { children: task.comment_count })] }), title: 'Comments' },
        { show: (task.attachment_count ?? 0) > 0, icon: _jsxs(_Fragment, { children: [_jsx(Paperclip, { className: "h-3 w-3" }), _jsx("span", { children: task.attachment_count })] }), title: 'Attachments' },
        { show: !!task.checklist_progress, icon: _jsxs(_Fragment, { children: [_jsx(ListChecks, { className: "h-3 w-3" }), _jsx("span", { children: task.checklist_progress })] }), title: 'Checklist' },
        { show: depCount > 0, icon: _jsxs(_Fragment, { children: [_jsx(Link2, { className: "h-3 w-3" }), _jsx("span", { children: depCount })] }), title: 'Dependencies' },
        { show: !!task.severity || task.status === 'bugs_found', icon: _jsx(Bug, { className: "h-3 w-3" }), title: 'Bug' },
        { show: task.review_required, icon: _jsx(Eye, { className: "h-3 w-3" }), title: 'Review required' },
        { show: task.testing_required, icon: _jsx(FlaskConical, { className: "h-3 w-3" }), title: 'Testing required' },
    ];
    const visible = icons.filter((i) => i.show);
    if (!visible.length)
        return null;
    return (_jsx("div", { className: "flex items-center gap-2.5 text-text-muted", children: visible.map((item, i) => (_jsx("span", { className: "flex items-center gap-0.5 text-2xs opacity-60 hover:opacity-100 transition-opacity duration-hover", title: item.title, children: item.icon }, i))) }));
}
export function TaskDatabase({ tasks, onTaskClick, sortField, sortDir, onSort, selectedIds = new Set(), onSelectionChange, focusedIndex = -1, onStatusChange, onDeleteTask, editable = false, columns: columnsProp, onColumnsChange, }) {
    const [internalColumns, setInternalColumns] = useState(DEFAULT_COLUMNS);
    const columns = columnsProp ?? internalColumns;
    const setColumns = onColumnsChange ?? setInternalColumns;
    const [contextMenu, setContextMenu] = useState(null);
    const [resizing, setResizing] = useState(null);
    const tableRef = useRef(null);
    const visibleColumns = useMemo(() => columns.filter((c) => c.visible && !HIDDEN_COLUMN_IDS.has(c.id)), [columns]);
    const toggleSelect = (id, e) => {
        e.stopPropagation();
        if (!onSelectionChange)
            return;
        const next = new Set(selectedIds);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        onSelectionChange(next);
    };
    const allVisibleSelected = tasks.length > 0 && tasks.every((t) => selectedIds.has(t.id));
    const toggleSelectAll = () => {
        if (!onSelectionChange)
            return;
        const next = new Set(selectedIds);
        if (allVisibleSelected) {
            tasks.forEach((t) => next.delete(t.id));
        }
        else {
            tasks.forEach((t) => next.add(t.id));
        }
        onSelectionChange(next);
    };
    const handleContextMenu = (e, taskId) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, taskId });
    };
    useEffect(() => {
        const close = () => setContextMenu(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, []);
    const handleResizeMove = useCallback((e) => {
        if (!resizing)
            return;
        const delta = e.clientX - resizing.startX;
        setColumns((cols) => cols.map((c) => c.id === resizing.colId
            ? { ...c, width: Math.max(c.minWidth, resizing.startWidth + delta) }
            : c));
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
    const SortIcon = ({ field }) => {
        if (sortField !== field)
            return null;
        return sortDir === 'asc' ? _jsx(ChevronUp, { className: "h-3 w-3" }) : _jsx(ChevronDown, { className: "h-3 w-3" });
    };
    return (_jsxs("div", { ref: tableRef, className: "task-table relative rounded-xl overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("div", { style: { minWidth: totalWidth }, children: [_jsxs("div", { className: "task-table-header flex items-stretch sticky top-0 z-10", children: [_jsx("div", { className: "db-header-cell w-10 shrink-0 flex items-center justify-center", children: _jsx("input", { type: "checkbox", checked: allVisibleSelected, onChange: toggleSelectAll, className: "rounded border-dark-border bg-dark-card text-text-primary focus:ring-[var(--focus-ring)]" }) }), visibleColumns.map((col) => (_jsxs("div", { className: "db-header-cell relative flex items-center gap-1", style: { width: col.width }, children: [col.sortable && onSort ? (_jsxs("button", { onClick: () => onSort(col.id), className: "flex items-center gap-1 hover:text-text-secondary transition-colors duration-hover", children: [col.label, _jsx(SortIcon, { field: col.id })] })) : (col.label), col.id !== 'indicators' && (_jsx("div", { className: "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-surface-active flex items-center justify-center", onMouseDown: (e) => {
                                                e.preventDefault();
                                                setResizing({ colId: col.id, startX: e.clientX, startWidth: col.width });
                                            }, children: _jsx(GripVertical, { className: "h-3 w-3 opacity-0 hover:opacity-50" }) }))] }, col.id))), onDeleteTask && _jsx("div", { className: "db-header-cell w-11 shrink-0", "aria-hidden": true })] }), tasks.map((task, index) => {
                            const isSelected = selectedIds.has(task.id);
                            const isFocused = focusedIndex === index;
                            return (_jsxs("div", { onClick: () => onTaskClick(task.id), onContextMenu: (e) => handleContextMenu(e, task.id), className: clsx('db-row group', isSelected && 'db-row-selected', isFocused && 'db-row-focused'), children: [_jsx("div", { className: "db-cell w-10 shrink-0 justify-center", onClick: (e) => e.stopPropagation(), children: _jsx("input", { type: "checkbox", checked: isSelected, onChange: (e) => toggleSelect(task.id, e), className: "rounded border-dark-border bg-dark-card" }) }), visibleColumns.map((col) => (_jsxs("div", { className: clsx('db-cell overflow-hidden', col.id === 'title' && [
                                            'rounded-md my-0.5',
                                            TITLE_PRIORITY_BG[task.priority],
                                        ]), style: { width: col.width }, title: col.id === 'title'
                                            ? `Priority: ${PRIORITY_LABELS[task.priority] || task.priority}`
                                            : undefined, children: [col.id === 'title' && (_jsxs("div", { className: "min-w-0 flex items-center gap-2 w-full", children: [task.assignees?.length > 0 ? (_jsx(AvatarGroup, { users: task.assignees.map((a) => a.user).filter(Boolean), max: 2 })) : (_jsx("span", { className: "h-7 w-7 rounded-full bg-dark-muted shrink-0", "aria-hidden": true })), task.is_blocked && (_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" })), _jsx("div", { className: "min-w-0 flex-1", children: _jsx("p", { className: "text-sm font-medium text-text-primary truncate", children: task.title }) })] })), col.id === 'due_date' && _jsx(DueDate, { date: task.due_date, status: task.status }), col.id === 'estimated_hours' && (_jsx("span", { className: "text-sm text-text-muted tabular-nums", children: formatTimeTakenHours(task.estimated_hours) ?? '—' })), col.id === 'status' && (_jsx(InlineStatusSelect, { task: task, editable: editable, onStatusChange: onStatusChange })), col.id === 'indicators' && _jsx(RowIndicators, { task: task })] }, col.id))), onDeleteTask && (_jsx("div", { className: "db-cell w-11 shrink-0 justify-center", onClick: (e) => e.stopPropagation(), children: _jsx("button", { type: "button", onClick: () => onDeleteTask(task), className: "p-1.5 rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent-danger hover:bg-red-500/10 transition-all duration-hover", title: "Delete task", "aria-label": `Delete ${task.title}`, children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) }) }))] }, task.id));
                        })] }) }), contextMenu && (_jsxs("div", { className: "fixed z-50 min-w-[160px] rounded-xl dropdown-panel border border-dark-border py-1 animate-in fade-in duration-dropdown", style: { left: contextMenu.x, top: contextMenu.y }, children: [_jsx("button", { className: "w-full px-3 py-1.5 text-left text-sm text-text-primary hover:bg-dark-hover transition-colors duration-hover", onClick: () => { onTaskClick(contextMenu.taskId); setContextMenu(null); }, children: "Open task" }), _jsx("button", { className: "w-full px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-dark-hover transition-colors duration-hover", onClick: () => {
                            if (onSelectionChange)
                                onSelectionChange(new Set([contextMenu.taskId]));
                            setContextMenu(null);
                        }, children: "Select" }), onDeleteTask && (_jsx("button", { className: "w-full px-3 py-1.5 text-left text-sm text-accent-danger hover:bg-dark-hover transition-colors duration-hover", onClick: () => {
                            const task = tasks.find((t) => t.id === contextMenu.taskId);
                            if (task)
                                onDeleteTask(task);
                            setContextMenu(null);
                        }, children: "Delete" }))] }))] }));
}
export function useColumnVisibility() {
    const [columns, setColumns] = useState(DEFAULT_COLUMNS);
    const toggleColumn = (id) => {
        if (HIDDEN_COLUMN_IDS.has(id))
            return;
        setColumns((cols) => cols.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
    };
    return { columns, toggleColumn, setColumns };
}
export function TaskDatabaseSkeleton() {
    return (_jsx("div", { className: "rounded-lg border border-dark-border bg-dark-card overflow-hidden", children: Array.from({ length: 10 }).map((_, i) => (_jsx("div", { className: "h-11 border-b border-dark-border bg-surface-subtle animate-pulse" }, i))) }));
}
// Re-export simple wrapper for section-based pages
export { TaskDatabase as TaskTable, TaskDatabaseSkeleton as TaskTableSkeleton };
