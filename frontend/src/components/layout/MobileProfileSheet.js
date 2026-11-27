import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Avatar } from '../ui/Avatar';
import { BottomSheet } from '../ui/BottomSheet';
const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
];
export function MobileProfileSheet({ isOpen, onClose }) {
    const { user, logout } = useAuth();
    const { preference, setPreference } = useTheme();
    const navigate = useNavigate();
    const go = (path) => {
        onClose();
        navigate(path);
    };
    const handleLogout = () => {
        onClose();
        logout();
        navigate('/login');
    };
    return (_jsxs(BottomSheet, { isOpen: isOpen, onClose: onClose, title: "Account", children: [user && (_jsxs("div", { className: "flex items-center gap-3 pb-4 mb-4 border-b border-dark-border", children: [_jsx(Avatar, { name: `${user.first_name} ${user.last_name}`, src: user.profile_picture, size: "lg" }), _jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "text-base font-semibold text-text-primary truncate", children: [user.first_name, " ", user.last_name] }), _jsx("p", { className: "text-sm text-text-muted truncate", children: user.email }), _jsx("p", { className: "text-xs text-text-muted capitalize mt-0.5", children: user.role })] })] })), _jsx("div", { className: "space-y-1", children: _jsxs("button", { type: "button", onClick: () => go('/settings'), className: "mobile-menu-item w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-text-primary hover:bg-dark-hover transition-colors min-h-[48px]", children: [_jsx(Settings, { className: "h-5 w-5 text-text-muted shrink-0" }), _jsx("span", { className: "text-sm font-medium", children: "Settings" })] }) }), _jsxs("div", { className: "mt-4 pt-4 border-t border-dark-border", children: [_jsx("p", { className: "text-2xs font-medium uppercase tracking-wider text-text-muted mb-2 px-1", children: "Theme" }), _jsx("div", { className: "grid grid-cols-3 gap-2", children: themeOptions.map((opt) => (_jsxs("button", { type: "button", onClick: () => setPreference(opt.value), className: clsx('flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-colors min-h-[72px]', preference === opt.value
                                ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                                : 'border-dark-border bg-surface-subtle text-text-secondary hover:bg-dark-hover'), children: [_jsx(opt.icon, { className: "h-5 w-5" }), _jsx("span", { className: "text-xs font-medium", children: opt.label })] }, opt.value))) })] }), _jsxs("button", { type: "button", onClick: handleLogout, className: "mt-4 w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-accent-danger hover:bg-dark-hover transition-colors min-h-[48px]", children: [_jsx(LogOut, { className: "h-5 w-5 shrink-0" }), _jsx("span", { className: "text-sm font-medium", children: "Sign out" })] })] }));
}
