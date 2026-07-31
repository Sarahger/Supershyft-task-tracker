import { NavLink, useLocation } from 'react-router-dom';
import { LayoutList, CheckSquare, Video, NotebookPen, CalendarCheck } from 'lucide-react';
import clsx from 'clsx';

const items: {
  to: string;
  icon: typeof LayoutList;
  label: string;
  end?: boolean;
}[] = [
  { to: '/', icon: LayoutList, label: 'All tasks', end: true },
  { to: '/my-tasks', icon: CheckSquare, label: 'My tasks', end: true },
  { to: '/daily-updates', icon: NotebookPen, label: 'Daily Updates', end: true },
  { to: '/attendance', icon: CalendarCheck, label: 'Attendance', end: true },
  { to: '/meetings', icon: Video, label: 'Meetings', end: true },
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
  return (
    <nav
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-dark-border bg-dark-sidebar"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around px-0.5">
        {items.map((item) => (
          <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} end={item.end} />
        ))}
      </div>
    </nav>
  );
}
