import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import clsx from 'clsx';
const sizeClasses = { sm: 'h-6 w-6 text-xs', md: 'h-8 w-8 text-sm', lg: 'h-10 w-10 text-base' };
function getInitials(name) {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}
function getColor(name) {
    const colors = ['bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-blue-500', 'bg-teal-500', 'bg-orange-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}
function InitialsAvatar({ name, size, className }) {
    return (_jsx("div", { className: clsx('rounded-full flex items-center justify-center text-white font-medium shrink-0', getColor(name), sizeClasses[size], className), children: getInitials(name) }));
}
export function Avatar({ name, src, size = 'md', className }) {
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        setFailed(false);
    }, [src]);
    if (src && !failed) {
        return (_jsx("img", { src: src, alt: name, onError: () => setFailed(true), className: clsx('rounded-full object-cover shrink-0', sizeClasses[size], className) }));
    }
    return _jsx(InitialsAvatar, { name: name, size: size, className: className });
}
export function AvatarGroup({ users, max = 3 }) {
    const visible = users.slice(0, max);
    const remaining = users.length - max;
    return (_jsxs("div", { className: "flex -space-x-2", children: [visible.map((u, i) => (_jsx(Avatar, { name: `${u.first_name} ${u.last_name}`, src: u.profile_picture, size: "sm" }, i))), remaining > 0 && (_jsxs("div", { className: "h-6 w-6 rounded-full bg-dark-muted flex items-center justify-center text-xs text-text-muted ring-2 ring-dark-bg", children: ["+", remaining] }))] }));
}
