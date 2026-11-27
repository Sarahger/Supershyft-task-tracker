import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutList, CheckSquare, BarChart3, Users, Settings, LogOut, Menu, X, Video, NotebookPen, CalendarCheck, Library, } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { AppLogo } from './AppLogo';
import { Avatar } from '../ui/Avatar';
import { GlobalSearch } from './GlobalSearch';
import { ThemeToggle } from '../ui/ThemeToggle';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileProfileSheet } from './MobileProfileSheet';
import { MobileMoreSheet } from './MobileMoreSheet';
import { MANAGER_ACCESS_ROLES } from '../../lib/roles';
import { useWorkVaultUnread } from '../../hooks/useWorkVaultUnread';
const navItems = [
    { to: '/', icon: LayoutList, label: 'Tasks', end: true },
    { to: '/my-tasks', icon: CheckSquare, label: 'My Tasks' },
    { to: '/weekly-updates', icon: NotebookPen, label: 'Weekly Updates' },
    { to: '/work-vault', icon: Library, label: 'Work Vault' },
    { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
    { to: '/meetings', icon: Video, label: 'Meetings' },
    { to: '/reports', icon: BarChart3, label: 'Reports', roles: MANAGER_ACCESS_ROLES },
    { to: '/users', icon: Users, label: 'Users', roles: MANAGER_ACCESS_ROLES },
    { to: '/settings', icon: Settings, label: 'Settings' },
];
export function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { data: unreadWorkVault = 0 } = useWorkVaultUnread();
    const visibleNav = navItems.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
    return (_jsxs("div", { className: "flex h-screen overflow-hidden bg-dark-bg", children: [_jsxs("aside", { className: clsx('app-sidebar fixed inset-y-0 left-0 z-40 w-52 bg-dark-sidebar border-r border-dark-border transform transition-transform duration-drawer flex-col', 'max-md:hidden md:flex', 'lg:relative lg:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'), children: [_jsxs("div", { className: "flex items-center h-12 px-4 shrink-0", children: [_jsx(AppLogo, { size: "sm", className: "min-w-0 flex-1" }), _jsx("button", { onClick: () => setSidebarOpen(false), className: "ml-auto lg:hidden p-1 text-text-muted", children: _jsx(X, { className: "h-4 w-4" }) })] }), _jsx("nav", { className: "flex-1 px-2 py-1 space-y-0.5 overflow-y-auto", children: visibleNav.map((item) => (_jsxs(NavLink, { to: item.to, end: item.end, onClick: () => setSidebarOpen(false), className: ({ isActive }) => clsx('sidebar-link', isActive && 'sidebar-link-active'), children: [_jsxs("span", { className: "relative", children: [_jsx(item.icon, { className: "sidebar-icon h-4 w-4 shrink-0 opacity-80" }), item.to === '/work-vault' && unreadWorkVault > 0 && (_jsx("span", { className: "absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-400", "aria-label": "New team resources" }))] }), item.label] }, item.to))) }), _jsx("div", { className: "p-3 border-t border-dark-border shrink-0", children: _jsxs("div", { className: "flex items-center gap-2 px-1", children: [user && _jsx(Avatar, { name: `${user.first_name} ${user.last_name}`, src: user.profile_picture, size: "sm" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-xs font-medium text-text-primary truncate", children: user?.first_name }), _jsx("p", { className: "text-2xs text-text-muted truncate capitalize", children: user?.role })] }), _jsx("button", { onClick: () => { logout(); navigate('/login'); }, className: "p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover", title: "Sign out", children: _jsx(LogOut, { className: "h-3.5 w-3.5" }) })] }) })] }), sidebarOpen && _jsx("div", { className: "fixed inset-0 z-30 bg-[var(--overlay-backdrop)] max-md:hidden lg:hidden", onClick: () => setSidebarOpen(false) }), _jsxs("div", { className: "flex-1 flex flex-col overflow-hidden min-w-0", children: [_jsxs("header", { className: "app-header h-11 flex items-center justify-between px-4 lg:px-6 shrink-0 border-b border-dark-border bg-dark-bg", children: [_jsx("button", { onClick: () => setSidebarOpen(true), className: "max-md:hidden lg:hidden p-1.5 rounded-md hover:bg-dark-hover text-text-secondary", children: _jsx(Menu, { className: "h-4 w-4" }) }), _jsx(AppLogo, { size: "md", className: "md:hidden" }), _jsx("div", { className: "max-md:hidden flex-1 min-w-0", children: _jsx(GlobalSearch, {}) }), _jsxs("div", { className: "flex items-center gap-1 ml-auto", children: [_jsx(ThemeToggle, { className: "max-md:p-2" }), _jsx("button", { type: "button", onClick: () => setMoreOpen(true), className: "md:hidden p-2 rounded-md text-text-secondary hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover min-h-[44px] min-w-[44px] flex items-center justify-center", "aria-label": "Open more menu", children: _jsx(Menu, { className: "h-4 w-4" }) }), user && (_jsx("button", { type: "button", onClick: () => setProfileOpen(true), className: "md:hidden p-1 rounded-full hover:ring-2 hover:ring-accent-primary/30 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center", "aria-label": "Open account menu", children: _jsx(Avatar, { name: `${user.first_name} ${user.last_name}`, src: user.profile_picture, size: "sm" }) }))] })] }), _jsx("main", { className: "flex-1 overflow-y-auto px-4 lg:px-6 py-5 mobile-main-content", children: _jsx(Outlet, {}) })] }), _jsx(MobileBottomNav, {}), _jsx(MobileMoreSheet, { isOpen: moreOpen, onClose: () => setMoreOpen(false) }), _jsx(MobileProfileSheet, { isOpen: profileOpen, onClose: () => setProfileOpen(false) })] }));
}
