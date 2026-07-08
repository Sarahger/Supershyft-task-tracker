import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutList, FolderKanban, CheckSquare, BarChart3, Users, Settings, LogOut, Menu, X, Bell,
} from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { AppLogo } from './AppLogo';
import { Avatar } from '../ui/Avatar';
import { GlobalSearch } from './GlobalSearch';
import { ThemeToggle } from '../ui/ThemeToggle';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileProfileSheet } from './MobileProfileSheet';
import { notificationsApi } from '../../services/endpoints';
import type { Notification, User } from '../../types';

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
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { openTask } = useTaskDrawer();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data.data as Notification[]),
    refetchInterval: 30000,
    retry: false,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    setShowNotifs(false);
    const link = notification.link || '';
    const taskMatch = link.match(/\/tasks\/(\d+)/);
    if (taskMatch) {
      openTask(Number(taskMatch[1]));
      return;
    }
    if (link.startsWith('/')) {
      navigate(link);
    }
  };

  const visibleNav = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <div className="flex h-screen overflow-hidden bg-dark-bg">
      {/* Desktop + tablet sidebar — hidden on mobile */}
      <aside className={clsx(
        'app-sidebar fixed inset-y-0 left-0 z-40 w-52 bg-dark-sidebar border-r border-dark-border transform transition-transform duration-drawer flex-col',
        'max-md:hidden md:flex',
        'lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex items-center h-12 px-4 shrink-0">
          <AppLogo size="sm" className="min-w-0 flex-1" />
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
                isActive && 'sidebar-link-active',
              )}
            >
              <item.icon className="sidebar-icon h-4 w-4 shrink-0 opacity-80" />
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

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-[var(--overlay-backdrop)] max-md:hidden lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="app-header h-11 flex items-center justify-between px-4 lg:px-6 shrink-0 border-b border-dark-border bg-dark-bg">
          {/* Tablet hamburger — hidden on mobile and desktop */}
          <button onClick={() => setSidebarOpen(true)} className="max-md:hidden lg:hidden p-1.5 rounded-md hover:bg-dark-hover text-text-secondary">
            <Menu className="h-4 w-4" />
          </button>

          {/* Mobile logo */}
          <AppLogo size="md" className="md:hidden" />

          {/* Global search — desktop + tablet only */}
          <div className="max-md:hidden flex-1 min-w-0">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <ThemeToggle className="max-md:p-2" />
            <div className="relative">
            <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 rounded-md text-text-secondary hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-accent-danger text-[var(--btn-primary-fg)] text-[9px] flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                <div className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-dark-card z-50 max-h-96 overflow-y-auto dropdown-panel">
                  <div className="px-3 py-2 border-b border-dark-border flex items-center justify-between gap-2">
                    <span className="text-2xs font-medium text-text-muted uppercase tracking-wider">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllReadMutation.mutate()}
                        disabled={markAllReadMutation.isPending}
                        className="text-2xs text-text-muted hover:text-text-secondary"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications?.length ? notifications.slice(0, 15).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={clsx(
                        'w-full text-left px-3 py-2.5 border-b border-dark-border last:border-0 text-sm hover:bg-dark-hover transition-colors',
                        !n.is_read && 'bg-surface-subtle',
                      )}
                    >
                      <p className="font-medium text-text-primary text-xs">{n.title}</p>
                      {n.message && <p className="text-text-muted text-2xs mt-0.5 line-clamp-2">{n.message}</p>}
                      <p className="text-2xs text-text-muted mt-1">
                        {new Date(n.created_at).toLocaleString()}
                        {n.email_sent ? ' · emailed' : ''}
                      </p>
                    </button>
                  )) : (
                    <p className="p-4 text-xs text-text-muted text-center">No notifications</p>
                  )}
                </div>
              </>
            )}
            </div>

            {/* Mobile profile avatar */}
            {user && (
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="md:hidden p-1 rounded-full hover:ring-2 hover:ring-accent-primary/30 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Open account menu"
              >
                <Avatar name={`${user.first_name} ${user.last_name}`} size="sm" />
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 mobile-main-content">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav />
      <MobileProfileSheet isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
