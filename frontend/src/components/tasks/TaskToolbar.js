import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { Search, Filter, ArrowUpDown, LayoutList, Plus, Columns3, X, Bookmark, CalendarDays, CalendarRange, } from 'lucide-react';
import clsx from 'clsx';
import { SELECTABLE_STATUS_OPTIONS } from '../../types';
import { useTaskViewPreferences } from '../../contexts/TaskViewPreferencesContext';
import { Button } from '../ui/Button';
const VIEW_BUTTONS = [
    { mode: 'table', icon: LayoutList, title: 'List' },
    { mode: 'kanban', icon: Columns3, title: 'Board' },
    { mode: 'calendar', icon: CalendarDays, title: 'Calendar' },
    { mode: 'weekly', icon: CalendarRange, title: 'Week' },
];
export function TaskToolbar({ search, onSearchChange, statusFilter, onStatusFilterChange, priorityFilter, onPriorityFilterChange, assigneeFilter = '', onAssigneeFilterChange, assigneeOptions = [], sortField, sortDir, onSortFieldChange, onSortDirToggle, viewMode, onViewModeChange, onNewTask, totalCount, selectedCount = 0, onBulkStatusChange, onClearSelection, showViewSelector = true, }) {
    const { enabledViewModes } = useTaskViewPreferences();
    const [showFilter, setShowFilter] = useState(false);
    const [showSort, setShowSort] = useState(false);
    const filterRef = useRef(null);
    const anyMenuOpen = showFilter || showSort;
    const closeMenus = () => {
        setShowFilter(false);
        setShowSort(false);
    };
    useEffect(() => {
        if (!anyMenuOpen)
            return;
        const onPointerDown = (e) => {
            const target = e.target;
            if (filterRef.current && target && !filterRef.current.contains(target)) {
                closeMenus();
            }
        };
        const onKeyDown = (e) => {
            if (e.key === 'Escape')
                closeMenus();
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
    return (_jsxs("div", { className: "space-y-3 mb-4", children: [selectedCount > 0 && (_jsxs("div", { className: "flex items-center gap-3 px-3 py-2 rounded-md bg-surface-subtle border border-dark-border animate-in fade-in duration-status", children: [_jsxs("span", { className: "text-sm text-text-secondary", children: [selectedCount, " selected"] }), _jsxs("select", { className: "input py-1 text-xs w-auto", onChange: (e) => { if (e.target.value && onBulkStatusChange) {
                            onBulkStatusChange(e.target.value);
                            e.target.value = '';
                        } }, defaultValue: "", children: [_jsx("option", { value: "", disabled: true, children: "Change status" }), SELECTABLE_STATUS_OPTIONS.map(({ value, label }) => (_jsx("option", { value: value, children: label }, value)))] }), _jsxs("button", { onClick: onClearSelection, className: "toolbar-btn ml-auto text-text-muted", children: [_jsx(X, { className: "h-3.5 w-3.5" }), " Clear"] })] })), _jsxs("div", { className: "flex flex-col gap-2 sm:gap-3", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsxs("div", { className: "relative flex-1 min-w-0 sm:max-w-xs", children: [_jsx(Search, { className: "absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" }), _jsx("input", { className: "input pl-8 py-1.5 text-sm w-full h-9", placeholder: "Search tasks...", value: search, onChange: (e) => onSearchChange(e.target.value) })] }), totalCount !== undefined && (_jsxs("span", { className: "text-2xs text-text-muted hidden md:inline shrink-0", children: [totalCount, " tasks"] })), onNewTask && (_jsxs(Button, { onClick: onNewTask, size: "sm", className: "h-9 px-2.5 py-0 shrink-0 sm:ml-auto", "aria-label": "New task", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), _jsx("span", { className: "hidden sm:inline", children: "New task" })] }))] }), anyMenuOpen && (_jsx("div", { className: "fixed inset-0 z-20", "aria-hidden": true, onMouseDown: closeMenus })), _jsxs("div", { ref: filterRef, className: clsx('flex items-center gap-1 min-w-0 w-full', anyMenuOpen && 'relative z-30'), children: [_jsxs("div", { className: "flex items-center gap-1 min-w-0 flex-1", children: [_jsxs("div", { className: "relative shrink-0", children: [_jsxs("button", { onClick: () => { setShowFilter(!showFilter); setShowSort(false); }, className: clsx('toolbar-btn', activeFilters > 0 && 'text-text-primary bg-dark-hover'), title: "Filter", children: [_jsx(Filter, { className: "h-3.5 w-3.5" }), _jsx("span", { className: "hidden sm:inline", children: "Filter" }), activeFilters > 0 && _jsx("span", { className: "text-2xs bg-surface-active px-1 rounded", children: activeFilters })] }), showFilter && (_jsxs("div", { className: "absolute top-full left-0 mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-xl dropdown-panel border border-dark-border p-3 z-30", children: [_jsx("label", { className: "text-2xs text-text-muted uppercase tracking-wider mb-1 block", children: "Status" }), _jsxs("select", { className: "input py-1 text-sm mb-3", value: statusFilter, onChange: (e) => onStatusFilterChange(e.target.value), children: [_jsx("option", { value: "", children: "All" }), SELECTABLE_STATUS_OPTIONS.map(({ value, label }) => (_jsx("option", { value: value, children: label }, value)))] }), _jsx("label", { className: "text-2xs text-text-muted uppercase tracking-wider mb-1 block", children: "Priority" }), _jsxs("select", { className: "input py-1 text-sm mb-3", value: priorityFilter, onChange: (e) => onPriorityFilterChange(e.target.value), children: [_jsx("option", { value: "", children: "All" }), _jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "high", children: "High" }), _jsx("option", { value: "critical", children: "Critical" })] }), onAssigneeFilterChange && assigneeOptions.length > 0 && (_jsxs(_Fragment, { children: [_jsx("label", { className: "text-2xs text-text-muted uppercase tracking-wider mb-1 block", children: "Assignee" }), _jsxs("select", { className: "input py-1 text-sm", value: assigneeFilter, onChange: (e) => onAssigneeFilterChange(e.target.value), children: [_jsx("option", { value: "", children: "All" }), assigneeOptions.map((u) => (_jsxs("option", { value: u.id, children: [u.first_name, " ", u.last_name] }, u.id)))] })] }))] }))] }), _jsxs("div", { className: "relative shrink-0", children: [_jsxs("button", { onClick: () => { setShowSort(!showSort); setShowFilter(false); }, className: "toolbar-btn", title: "Sort", children: [_jsx(ArrowUpDown, { className: "h-3.5 w-3.5" }), _jsx("span", { className: "hidden sm:inline", children: "Sort" })] }), showSort && (_jsxs("div", { className: "absolute top-full left-0 mt-1 w-48 max-w-[calc(100vw-2rem)] rounded-xl dropdown-panel border border-dark-border p-2 z-30", children: [[
                                                        { v: 'updated_at', l: 'Last updated' },
                                                        { v: 'title', l: 'Name' },
                                                        { v: 'due_date', l: 'Due date' },
                                                        { v: 'priority', l: 'Priority' },
                                                        { v: 'status', l: 'Status' },
                                                    ].map((o) => (_jsx("button", { onClick: () => onSortFieldChange(o.v), className: clsx('w-full text-left px-2 py-1.5 text-sm rounded hover:bg-dark-hover', sortField === o.v && 'text-text-primary bg-dark-hover'), children: o.l }, o.v))), _jsx("div", { className: "border-t border-dark-border mt-1 pt-1", children: _jsx("button", { onClick: onSortDirToggle, className: "w-full text-left px-2 py-1.5 text-sm text-text-secondary hover:bg-dark-hover rounded", children: sortDir === 'asc' ? '↑ Ascending' : '↓ Descending' }) })] }))] })] }), showViewSelector && (_jsx("div", { className: "flex items-center rounded-lg border border-dark-border bg-dark-card p-0.5 shrink-0 ml-auto", children: VIEW_BUTTONS.filter((btn) => enabledViewModes.includes(btn.mode)).map((btn) => (_jsx("button", { onClick: () => { onViewModeChange(btn.mode); closeMenus(); }, className: clsx('px-2 py-1 rounded text-2xs transition-all duration-hover', viewMode === btn.mode ? 'bg-dark-hover text-text-primary' : 'text-text-muted hover:text-text-secondary'), title: btn.title, children: _jsx(btn.icon, { className: "h-3.5 w-3.5" }) }, btn.mode))) }))] })] })] }));
}
export function SavedFiltersBar({ filters, onApply }) {
    if (!filters.length)
        return null;
    return (_jsxs("div", { className: "flex items-center gap-2 mb-3 flex-wrap", children: [_jsx(Bookmark, { className: "h-3.5 w-3.5 text-text-muted" }), filters.map((f) => (_jsx("button", { onClick: () => onApply(f.filter_json), className: "chip bg-surface-muted text-text-secondary hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover", children: f.name }, f.id)))] }));
}
