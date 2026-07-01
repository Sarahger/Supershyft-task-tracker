import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutList, FolderKanban, CheckSquare, BarChart3, Users, Settings, LogOut, Menu, X, Bell,
} from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../ui/Avatar';
import { GlobalSearch } from './GlobalSearch';
import { notificationsApi } from '../../services/endpoints';
import type { User } from '../../types';

const navItems: {
  to: string;
  icon: typeof LayoutList;
  label: string;
  end?: boolean;
  roles?: User['role'][];
}[] = [
  { to: '/', icon: LayoutList, label: 'Tasks', end: true },
  { to: '/my-tasks', icon: CheckSquare, label: 'My Tasks' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/users', icon: Users, label: 'Users', roles: ['administrator', 'manager'] },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data.data),
    refetchInterval: 30000,
    retry: false,
  });

  const unreadCount = notifications?.filter((n: { is_read: boolean }) => !n.is_read).length || 0;
  const visibleNav = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <div className="flex h-screen overflow-hidden bg-dark-bg">
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 w-52 bg-dark-sidebar border-r border-dark-border transform transition-transform duration-drawer lg:relative lg:translate-x-0 flex flex-col',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex items-center h-12 px-4 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-5 w-5 rounded bg-white/[0.08] flex items-center justify-center text-2xs font-semibold text-text-primary shrink-0">W</span>
            <span className="text-sm font-semibold text-text-primary truncate">Work OS</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden p-1 text-text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'sidebar-link',
                isActive ? 'bg-white/[0.06] text-text-primary font-medium' : 'text-text-secondary hover:bg-dark-hover hover:text-text-primary'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0 opacity-80" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-dark-border shrink-0">
          <div className="flex items-center gap-2 px-1">
            {user && <Avatar name={`${user.first_name} ${user.last_name}`} size="sm" />}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-text-primary truncate">{user?.first_name}</p>
              <p className="text-2xs text-text-muted truncate capitalize">{user?.role}</p>
            </div>
            <button onClick={() => { logout(); navigate('/login'); }} className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover" title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-11 flex items-center justify-between px-4 lg:px-6 shrink-0 border-b border-dark-border bg-dark-bg">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-md hover:bg-dark-hover text-text-secondary">
            <Menu className="h-4 w-4" />
          </button>
          <GlobalSearch />
          <div className="relative ml-auto">
            <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 rounded-md text-text-secondary hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                <div className="absolute right-0 top-full mt-1 w-72 rounded-md border border-dark-border bg-dark-card z-50 max-h-80 overflow-y-auto shadow-lg">
                  <div className="px-3 py-2 border-b border-dark-border text-2xs font-medium text-text-muted uppercase tracking-wider">Notifications</div>
                  {notifications?.length ? notifications.slice(0, 10).map((n: { id: number; title: string; message?: string; is_read: boolean }) => (
                    <div key={n.id} className={clsx('px-3 py-2.5 border-b border-dark-border last:border-0 text-sm', !n.is_read && 'bg-white/[0.03]')}>
                      <p className="font-medium text-text-primary text-xs">{n.title}</p>
                      {n.message && <p className="text-text-muted text-2xs mt-0.5 line-clamp-2">{n.message}</p>}
                    </div>
                  )) : (
                    <p className="p-4 text-xs text-text-muted text-center">No notifications</p>
                  )}
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 lg:px-6 py-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
