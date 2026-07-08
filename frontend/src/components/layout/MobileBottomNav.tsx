import { NavLink, useLocation } from 'react-router-dom';
import { LayoutList, FolderKanban, BarChart3, Users } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import type { User } from '../../types';

const items: {
  to: string;
  icon: typeof LayoutList;
  label: string;
  end?: boolean;
  roles?: User['role'][];
}[] = [
  { to: '/', icon: LayoutList, label: 'Tasks', end: true },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/users', icon: Users, label: 'Users', roles: ['administrator', 'manager'] },
];

function NavItem({ to, icon: Icon, label, end }: { to: string; icon: typeof LayoutList; label: string; end?: boolean }) {
  const location = useLocation();
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <NavLink
      to={to}
      end={end}
      className={clsx(
        'mobile-nav-item flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors duration-hover',
        isActive ? 'text-accent-primary' : 'text-text-muted',
      )}
    >
      <Icon className={clsx('h-5 w-5', isActive && 'stroke-[2.5]')} />
      <span className="text-[10px] font-medium leading-none">{label}</span>
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
      <div className="flex items-stretch justify-around px-1">
        {visible.map((item) => (
          <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} end={item.end} />
        ))}
      </div>
    </nav>
  );
}
