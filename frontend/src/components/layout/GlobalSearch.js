import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { searchApi, usersApi } from '../../services/endpoints';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { useUserDrawer } from '../../contexts/UserDrawerContext';
import { Avatar } from '../ui/Avatar';
import { matchMentionUsers, mentionDisplayName, } from '../../lib/mentions';
export function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const [highlight, setHighlight] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();
    const { openTask } = useTaskDrawer();
    const { openUser } = useUserDrawer();
    const mentionMatch = query.match(/^@([\w\s]*)$/);
    const isMentionMode = mentionMatch !== null;
    const mentionQuery = mentionMatch?.[1] ?? '';
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === 'Escape')
                setIsOpen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);
    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setHighlight(0);
        }
        else {
            setQuery('');
            setDebounced('');
            setHighlight(0);
        }
    }, [isOpen]);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(query), 300);
        return () => clearTimeout(t);
    }, [query]);
    useEffect(() => {
        setHighlight(0);
    }, [query, isMentionMode]);
    const { data: users } = useQuery({
        queryKey: ['users-list'],
        queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
        enabled: isOpen && isMentionMode,
        staleTime: 5 * 60 * 1000,
    });
    const mentionUsers = users ?? [];
    const mentionSuggestions = useMemo(() => {
        if (!isMentionMode)
            return [];
        return matchMentionUsers(mentionUsers, mentionQuery).slice(0, 8);
    }, [isMentionMode, mentionUsers, mentionQuery]);
    const { data: results } = useQuery({
        queryKey: ['search', debounced],
        queryFn: () => searchApi.search(debounced).then((r) => r.data.data),
        enabled: !isMentionMode && debounced.length >= 2,
    });
    const allResults = results
        ? [
            ...(results.tasks ?? []).map((r) => ({ ...r, type: 'task' })),
            ...(results.users ?? []).map((r) => ({ ...r, type: 'user' })),
        ]
        : [];
    const close = () => setIsOpen(false);
    const filterByAssignee = (user) => {
        close();
        navigate(`/?assignee=${user.id}`);
    };
    const openResult = (r) => {
        close();
        if (r.type === 'task')
            openTask(r.id);
        else
            openUser(r.id);
    };
    const onKeyDown = (e) => {
        if (isMentionMode && mentionSuggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((i) => Math.min(i + 1, mentionSuggestions.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                filterByAssignee(mentionSuggestions[highlight]);
                return;
            }
        }
        if (!isMentionMode && allResults.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((i) => Math.min(i + 1, allResults.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                openResult(allResults[highlight]);
            }
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => setIsOpen(true), className: "toolbar-btn hidden sm:inline-flex", children: [_jsx(Search, { className: "h-3.5 w-3.5" }), _jsx("span", { children: "Search" }), _jsx("kbd", { className: "text-2xs bg-dark-muted px-1 rounded text-text-muted ml-1", children: "\u2318K" })] }), isOpen && (_jsxs("div", { className: "fixed inset-0 z-50 flex items-start justify-center pt-[12vh]", children: [_jsx("div", { className: "fixed inset-0 bg-[var(--overlay-backdrop)]", onClick: close }), _jsxs("div", { className: "relative w-full max-w-md rounded-2xl bg-dark-card overflow-hidden dropdown-panel", children: [_jsxs("div", { className: "flex items-center gap-2.5 px-4 py-3 border-b border-dark-border", children: [_jsx(Search, { className: "h-4 w-4 text-text-muted shrink-0" }), _jsx("input", { ref: inputRef, value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: onKeyDown, placeholder: "Search\u2026 or type @name to filter by assignee", className: "flex-1 text-sm text-text-primary outline-none placeholder:text-text-muted bg-transparent" })] }), isMentionMode && (_jsxs("div", { className: "max-h-72 overflow-y-auto py-1", children: [_jsxs("p", { className: "px-4 py-2 text-2xs uppercase tracking-wider text-text-muted flex items-center gap-1.5", children: [_jsx(UserRound, { className: "h-3 w-3" }), "Filter tasks by assignee"] }), mentionSuggestions.length > 0 ? (mentionSuggestions.map((u, idx) => {
                                        const name = mentionDisplayName(u);
                                        return (_jsxs("button", { type: "button", onClick: () => filterByAssignee(u), className: clsx('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-hover', idx === highlight ? 'bg-dark-hover' : 'hover:bg-dark-hover'), children: [_jsx(Avatar, { name: name, src: u.profile_picture, size: "sm" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm text-text-primary truncate", children: name }), u.email && (_jsx("p", { className: "text-2xs text-text-muted truncate", children: u.email }))] })] }, u.id));
                                    })) : (_jsx("p", { className: "py-8 text-center text-sm text-text-muted", children: "No matching people" }))] })), !isMentionMode && allResults.length > 0 && (_jsx("div", { className: "max-h-72 overflow-y-auto py-1", children: allResults.map((r, idx) => (_jsxs("button", { type: "button", onClick: () => openResult(r), className: clsx('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-hover', idx === highlight ? 'bg-dark-hover' : 'hover:bg-dark-hover'), children: [_jsx("span", { className: "text-2xs uppercase text-text-muted w-14 shrink-0", children: r.type }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm text-text-primary truncate", children: r.title }), r.subtitle && (_jsx("p", { className: "text-2xs text-text-muted truncate", children: r.subtitle }))] })] }, `${r.type}-${r.id}`))) })), !isMentionMode && debounced.length >= 2 && !allResults.length && (_jsx("p", { className: "py-8 text-center text-sm text-text-muted", children: "No results" })), !isMentionMode && query.length === 0 && (_jsxs("p", { className: "px-4 py-3 text-xs text-text-muted border-t border-dark-border", children: ["Tip: type ", _jsx("span", { className: "text-text-secondary", children: "@name" }), " to show only that person's tasks"] }))] })] }))] }));
}
