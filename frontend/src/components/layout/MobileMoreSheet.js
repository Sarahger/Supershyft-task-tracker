import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, Users, Settings } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { MANAGER_ACCESS_ROLES } from '../../lib/roles';
import { BottomSheet } from '../ui/BottomSheet';
const moreItems = [
    { to: '/reports', icon: BarChart3, label: 'Reports', roles: MANAGER_ACCESS_ROLES },
    { to: '/users', icon: Users, label: 'Users', roles: MANAGER_ACCESS_ROLES },
    { to: '/settings', icon: Settings, label: 'Settings' },
];
export function MobileMoreSheet({ isOpen, onClose }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const visible = moreItems.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
    const go = (path) => {
        onClose();
        navigate(path);
    };
    return (_jsx(BottomSheet, { isOpen: isOpen, onClose: onClose, title: "More", children: _jsx("div", { className: "space-y-1", children: visible.map((item) => {
                const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                return (_jsxs("button", { type: "button", onClick: () => go(item.to), className: clsx('mobile-menu-item w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors min-h-[48px]', active
                        ? 'bg-accent-primary/10 text-accent-primary'
                        : 'text-text-primary hover:bg-dark-hover'), children: [_jsx(item.icon, { className: clsx('h-5 w-5 shrink-0', active ? 'text-accent-primary' : 'text-text-muted') }), _jsx("span", { className: "text-sm font-medium", children: item.label })] }, item.to));
            }) }) }));
}
