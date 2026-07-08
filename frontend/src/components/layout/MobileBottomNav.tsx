import { NavLink, useLocation } from 'react-router-dom';
import { LayoutList, CheckSquare, FolderKanban, BarChart3, Users } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { MANAGER_ACCESS_ROLES } from '../../lib/roles';
import type { User } from '../../types';

const items: {
  to: string;
  icon: typeof LayoutList;
  label: string;
  end?: boolean;
  roles?: User['role'][];
}[] = [
  { to: '/', icon: LayoutList, label: 'All tasks', end: true },
  { to: '/my-tasks', icon: CheckSquare, label: 'My tasks', end: true },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/reports', icon: BarChart3, label: 'Reports', roles: MANAGER_ACCESS_ROLES },
  { to: '/users', icon: Users, label: 'Users', roles: MANAGER_ACCESS_ROLES },
];

function NavItem({ to, icon: Icon, label, end }: { to: string; icon: typeof LayoutList; label: string; end?: boolean }) {
  const location = useLocation();
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <NavLink
      to={to}
      end={end}
      className={clsx(
        'mobile-nav-item flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 min-h-[56px] px-0.5 transition-colors duration-hover',
        isActive ? 'text-accent-primary' : 'text-text-muted',
      )}
    >
      <Icon className={clsx('h-[18px] w-[18px] shrink-0', isActive && 'stroke-[2.5]')} />
      <span className="text-[9px] font-medium leading-tight text-center max-w-[4.5rem]">{label}</span>
    </NavLink>
  );
}

export function MobileBottomNav() {
  const { user } = useAuth();
  const visible = items.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <nav
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-dark-border bg-dark-sidebar"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-between px-0.5">
        {visible.map((item) => (
          <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} end={item.end} />
        ))}
      </div>
    </nav>
  );
}
