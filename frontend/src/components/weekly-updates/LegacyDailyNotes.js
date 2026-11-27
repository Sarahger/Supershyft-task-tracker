import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { DailyUpdateContent } from '../daily-updates/DailyUpdateContent';
import { format, parseISO } from 'date-fns';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
export function LegacyDailyNotes({ notes, }) {
    const [open, setOpen] = useState(false);
    const { openTask } = useTaskDrawer();
    if (!notes.length)
        return null;
    return (_jsxs("section", { className: "rounded-2xl border border-dark-border bg-dark-card", children: [_jsxs("button", { type: "button", onClick: () => setOpen((v) => !v), className: "w-full flex items-center justify-between px-4 py-3 text-left", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-text-primary", children: "Earlier daily notes" }), _jsxs("p", { className: "text-xs text-text-muted mt-0.5", children: [notes.length, " saved day", notes.length === 1 ? '' : 's'] })] }), _jsx("span", { className: "text-xs text-text-muted", children: open ? 'Hide' : 'Show' })] }), open && (_jsx("div", { className: "border-t border-dark-border divide-y divide-dark-border", children: notes.map((note) => (_jsxs("article", { className: "px-4 py-3 space-y-2", children: [_jsx("p", { className: "text-xs text-text-muted", children: format(parseISO(note.update_date), 'EEEE, d MMM yyyy') }), _jsx(DailyUpdateContent, { content: note.content }), note.tasks.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5", children: note.tasks.map((task) => (_jsx("button", { type: "button", onClick: () => openTask(task.id), className: "text-xs text-accent-primary hover:underline", children: task.title }, task.id))) }))] }, note.id))) }))] }));
}
