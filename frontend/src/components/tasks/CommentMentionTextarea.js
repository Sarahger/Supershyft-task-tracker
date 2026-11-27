import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Avatar } from '../ui/Avatar';
import { matchMentionUsers, mentionDisplayName, mentionToken, } from '../../lib/mentions';
export function CommentMentionTextarea({ value, onChange, users, placeholder = 'Write a comment… Use @name to mention someone', rows = 2, className, }) {
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const textareaRef = useRef(null);
    const mentionQuery = useMemo(() => {
        const match = value.match(/@([\w\s]*)$/);
        return match ? match[1] : null;
    }, [value]);
    const suggestions = useMemo(() => {
        if (mentionQuery === null)
            return [];
        return matchMentionUsers(users, mentionQuery).slice(0, 8);
    }, [users, mentionQuery]);
    const showMenu = open && mentionQuery !== null && suggestions.length > 0;
    const pickUser = (user) => {
        const token = mentionToken(user);
        const next = value.replace(/@[\w\s]*$/, `${token} `);
        onChange(next);
        setOpen(false);
        setHighlight(0);
        textareaRef.current?.focus();
    };
    return (_jsxs("div", { className: clsx('relative flex-1', className), children: [_jsx("textarea", { ref: textareaRef, value: value, onChange: (e) => {
                    onChange(e.target.value);
                    setOpen(true);
                    setHighlight(0);
                }, onFocus: () => setOpen(true), onBlur: () => {
                    window.setTimeout(() => setOpen(false), 150);
                }, onKeyDown: (e) => {
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
                    else if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        pickUser(suggestions[highlight]);
                    }
                    else if (e.key === 'Escape') {
                        setOpen(false);
                    }
                }, placeholder: placeholder, rows: rows, className: "input resize-none text-sm w-full" }), showMenu && (_jsx("ul", { className: "absolute z-20 left-0 right-0 bottom-full mb-1 max-h-48 overflow-y-auto rounded-xl dropdown-panel border border-dark-border py-1 shadow-lg", role: "listbox", children: suggestions.map((u, idx) => {
                    const name = mentionDisplayName(u);
                    return (_jsx("li", { role: "option", "aria-selected": idx === highlight, children: _jsxs("button", { type: "button", onMouseDown: (e) => e.preventDefault(), onClick: () => pickUser(u), className: clsx('w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors min-h-[44px]', idx === highlight ? 'bg-dark-hover text-text-primary' : 'text-text-secondary hover:bg-dark-hover'), children: [_jsx(Avatar, { name: name, size: "sm" }), _jsx("span", { className: "truncate", children: name })] }) }, u.id));
                }) }))] }));
}
