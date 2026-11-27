import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronDown, LayoutList, Plus } from 'lucide-react';
import clsx from 'clsx';
import { MobileTaskCard } from './MobileTaskCard';
import { EmptyState } from '../ui/Skeleton';
import { Button } from '../ui/Button';
import { groupTasksByDueSections } from './TaskCard';
const STORAGE_KEY = 'mobile-expanded-groups';
function buildGroups(tasks, groupBy) {
    if (groupBy === 'none') {
        return [{ name: 'All tasks', tasks, completed: 0, total: tasks.length, progress: 0 }];
    }
    if (groupBy === 'status') {
        return groupTasksByDueSections(tasks).map((s) => {
            const completed = s.tasks.filter((t) => t.status === 'completed').length;
            const total = s.tasks.length;
            return {
                name: s.label,
                tasks: s.tasks,
                completed,
                total,
                progress: total > 0 ? Math.round((completed / total) * 100) : 0,
            };
        });
    }
    const map = new Map();
    for (const t of tasks) {
        const key = groupBy === 'priority' ? t.priority : 'Other';
        if (!map.has(key))
            map.set(key, []);
        map.get(key).push(t);
    }
    return Array.from(map.entries())
        .map(([name, groupTasks]) => {
        const completed = groupTasks.filter((t) => t.status === 'completed').length;
        const total = groupTasks.length;
        return {
            name,
            tasks: groupTasks,
            completed,
            total,
            progress: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
    })
        .sort((a, b) => b.total - a.total);
}
export function MobileTasksView({ tasks, onTaskClick, onCreateTask, isLoading, groupBy = 'status' }) {
    const groups = useMemo(() => buildGroups(tasks, groupBy), [tasks, groupBy]);
    const [expanded, setExpanded] = useState(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw !== null)
                return new Set(JSON.parse(raw));
        }
        catch { /* ignore */ }
        return new Set();
    });
    const didInit = useRef(false);
    // Expand the first group only on first visit (no saved preference yet)
    useEffect(() => {
        if (didInit.current || groups.length === 0)
            return;
        didInit.current = true;
        if (localStorage.getItem(STORAGE_KEY) === null) {
            setExpanded(new Set([groups[0].name]));
        }
    }, [groups]);
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...expanded]));
        }
        catch { /* ignore */ }
    }, [expanded]);
    const toggle = useCallback((name) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(name))
                next.delete(name);
            else
                next.add(name);
            return next;
        });
    }, []);
    if (isLoading) {
        return (_jsx("div", { className: "space-y-3 md:hidden", children: Array.from({ length: 3 }).map((_, i) => (_jsx("div", { className: "h-16 rounded-xl bg-dark-muted animate-pulse" }, i))) }));
    }
    if (!tasks.length) {
        return (_jsx("div", { className: "md:hidden py-8", children: _jsx(EmptyState, { title: "No tasks yet", description: "Create your first task or adjust your filters to see work here.", action: _jsxs(Button, { onClick: onCreateTask, className: "mt-2 gap-1.5", children: [_jsx(Plus, { className: "h-4 w-4" }), "Create task"] }) }) }));
    }
    return (_jsx("div", { className: "space-y-3 md:hidden", children: groups.map((group) => {
            const isOpen = expanded.has(group.name);
            return (_jsxs("section", { className: "rounded-2xl border border-dark-border bg-dark-card overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => toggle(group.name), className: "w-full flex items-center gap-3 px-4 py-4 min-h-[64px] text-left hover:bg-dark-hover transition-colors", "aria-expanded": isOpen, children: [_jsx("div", { className: "h-10 w-10 rounded-xl bg-accent-primary/10 flex items-center justify-center shrink-0", children: _jsx(LayoutList, { className: "h-5 w-5 text-accent-primary" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-text-primary truncate", children: group.name }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: `${group.total} task${group.total !== 1 ? 's' : ''}` })] }), _jsx(ChevronDown, { className: clsx('h-5 w-5 text-text-muted shrink-0 transition-transform duration-200', isOpen && 'rotate-180') })] }), _jsx("div", { className: clsx('grid transition-[grid-template-rows] duration-200 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'), children: _jsx("div", { className: "overflow-hidden", children: _jsx("div", { className: "px-3 pb-3 pt-0 space-y-2 border-t border-dark-border bg-surface-subtle/50", children: isOpen && group.tasks.map((task) => (_jsx(MobileTaskCard, { task: task, onClick: () => onTaskClick(task.id) }, task.id))) }) }) })] }, group.name));
        }) }));
}
