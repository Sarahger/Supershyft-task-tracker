import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutList, FolderKanban, CheckSquare, BarChart3, Users, Settings, LogOut, Menu, X, Video, NotebookPen, CalendarCheck,
} from 'lucide-react';
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
  { to: '/daily-updates', icon: NotebookPen, label: 'Daily Updates' },
  { to: '/attendance', icon: CalendarCheck, label: 'Attendance' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
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
            {user && <Avatar name={`${user.first_name} ${user.last_name}`} src={user.profile_picture} size="sm" />}
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

            {/* Mobile more menu — replaces notifications */}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="md:hidden p-2 rounded-md text-text-secondary hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open more menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Mobile profile avatar */}
            {user && (
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="md:hidden p-1 rounded-full hover:ring-2 hover:ring-accent-primary/30 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Open account menu"
              >
                <Avatar name={`${user.first_name} ${user.last_name}`} src={user.profile_picture} size="sm" />
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 mobile-main-content">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav />
      <MobileMoreSheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} />
      <MobileProfileSheet isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
