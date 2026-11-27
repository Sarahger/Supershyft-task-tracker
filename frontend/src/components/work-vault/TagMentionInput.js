import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { matchMentionUsers, mentionDisplayName, mentionToken } from '../../lib/mentions';
function teamToken(team) {
    return `@${team.name.trim()}`;
}
function matchTeams(teams, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return teams;
    return teams.filter((team) => team.name.toLowerCase().includes(q));
}
export function TagMentionInput({ value, onChange, users, teams, label = 'Tags', placeholder = '@shruti or @tech', }) {
    const [input, setInput] = useState('');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const inputRef = useRef(null);
    const mentionQuery = useMemo(() => {
        const atMatch = input.match(/@([\w\s]*)$/);
        if (atMatch)
            return atMatch[1];
        if (!input.trim())
            return null;
        return input.trim();
    }, [input]);
    const suggestions = useMemo(() => {
        if (mentionQuery === null)
            return [];
        const selected = new Set(value.map((tag) => tag.toLowerCase()));
        const people = matchMentionUsers(users, mentionQuery)
            .filter((user) => !selected.has(mentionToken(user).toLowerCase()))
            .slice(0, 6)
            .map((user) => ({
            key: `user-${user.id}`,
            token: mentionToken(user),
            label: mentionDisplayName(user),
            kind: 'person',
        }));
        const groupOptions = matchTeams(teams, mentionQuery)
            .filter((team) => !selected.has(teamToken(team).toLowerCase()))
            .slice(0, 4)
            .map((team) => ({
            key: `team-${team.id}`,
            token: teamToken(team),
            label: team.name,
            kind: 'team',
        }));
        return [...groupOptions, ...people].slice(0, 8);
    }, [users, teams, mentionQuery, value]);
    const showMenu = open && suggestions.length > 0;
    const addTag = (token) => {
        const next = token.trim();
        if (!next)
            return;
        if (!value.some((tag) => tag.toLowerCase() === next.toLowerCase())) {
            onChange([...value, next]);
        }
        setInput('');
        setOpen(false);
        setHighlight(0);
        inputRef.current?.focus();
    };
    return (_jsxs("div", { className: "space-y-1.5", children: [label && _jsx("label", { className: "block text-xs font-medium text-text-secondary", children: label }), _jsxs("div", { className: "relative", children: [_jsxs("div", { className: "input min-h-[42px] h-auto py-1.5 flex flex-wrap items-center gap-1.5", children: [value.map((tag) => (_jsxs("span", { className: "chip badge-neutral inline-flex items-center gap-1", children: [tag, _jsx("button", { type: "button", className: "text-text-muted hover:text-text-primary", onClick: () => onChange(value.filter((item) => item !== tag)), "aria-label": `Remove ${tag}`, children: _jsx(X, { className: "h-3 w-3" }) })] }, tag))), _jsx("input", { ref: inputRef, type: "text", value: input, onChange: (e) => {
                                    setInput(e.target.value);
                                    setOpen(true);
                                    setHighlight(0);
                                }, onFocus: () => setOpen(true), onBlur: () => window.setTimeout(() => setOpen(false), 150), onKeyDown: (e) => {
                                    if (e.key === 'Backspace' && !input && value.length) {
                                        onChange(value.slice(0, -1));
                                        return;
                                    }
                                    if (!showMenu)
                                        return;
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setHighlight((i) => Math.min(i + 1, suggestions.length - 1));
                                    }
                                    else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setHighlight((i) => Math.max(i - 1, 0));
                                    }
                                    else if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addTag(suggestions[highlight].token);
                                    }
                                    else if (e.key === 'Escape') {
                                        setOpen(false);
                                    }
                                }, placeholder: value.length ? '' : placeholder, className: "flex-1 min-w-[120px] bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted", "aria-label": label, "aria-autocomplete": "list", "aria-expanded": showMenu })] }), showMenu && (_jsx("ul", { className: "absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl dropdown-panel border border-dark-border py-1 shadow-lg", role: "listbox", children: suggestions.map((item, idx) => (_jsx("li", { role: "option", "aria-selected": idx === highlight, children: _jsxs("button", { type: "button", onMouseDown: (e) => e.preventDefault(), onClick: () => addTag(item.token), className: clsx('w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors min-h-[40px]', idx === highlight ? 'bg-dark-hover text-text-primary' : 'text-text-secondary hover:bg-dark-hover'), children: [item.kind === 'person' ? _jsx(Avatar, { name: item.label, size: "sm" }) : _jsx("span", { className: "chip badge-neutral", children: "Team" }), _jsx("span", { className: "truncate", children: item.token })] }) }, item.key))) }))] })] }));
}
