import { NavLink, useLocation } from 'react-router-dom';
import { LayoutList, CheckSquare, NotebookPen, CalendarCheck, Library, Video } from 'lucide-react';
import clsx from 'clsx';
import { useWorkVaultUnread } from '../../hooks/useWorkVaultUnread';

const items: {
  to: string;
  icon: typeof LayoutList;
  label: string;
  end?: boolean;
}[] = [
  { to: '/', icon: LayoutList, label: 'All tasks', end: true },
  { to: '/my-tasks', icon: CheckSquare, label: 'My tasks', end: true },
  { to: '/weekly-updates', icon: NotebookPen, label: 'Weekly Updates', end: true },
  { to: '/work-vault', icon: Library, label: 'Work Vault', end: true },
  { to: '/attendance', icon: CalendarCheck, label: 'Attendance', end: true },
  { to: '/meetings', icon: Video, label: 'Meetings', end: true },
];

function NavItem({
  to,
  icon: Icon,
  label,
  end,
  showDot,
}: {
  to: string;
  icon: typeof LayoutList;
  label: string;
  end?: boolean;
  showDot?: boolean;
}) {
  const location = useLocation();
  const isActive = end ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <NavLink
      to={to}
      end={end}
      className={clsx(
        'mobile-nav-item flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 min-h-[56px] px-0 transition-colors duration-hover',
        isActive ? 'text-accent-primary' : 'text-text-muted',
      )}
    >
      <span className="relative">
        <Icon className={clsx('h-[18px] w-[18px] shrink-0', isActive && 'stroke-[2.5]')} />
        {showDot && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-400" aria-label="New team resources" />
        )}
      </span>
      <span className="text-[8px] font-medium leading-tight text-center max-w-[3.4rem]">{label}</span>
    </NavLink>
  );
}

export function MobileBottomNav() {
  const { data: unreadWorkVault = 0 } = useWorkVaultUnread();
  return (
    <nav
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-dark-border bg-dark-sidebar"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around px-0.5">
        {items.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            end={item.end}
            showDot={item.to === '/work-vault' && unreadWorkVault > 0}
          />
        ))}
      </div>
    </nav>
  );
}
