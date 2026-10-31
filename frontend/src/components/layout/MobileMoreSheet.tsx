import { useNavigate, useLocation } from 'react-router-dom';
import { FolderKanban, BarChart3, Users, Settings } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { MANAGER_ACCESS_ROLES } from '../../lib/roles';
import { BottomSheet } from '../ui/BottomSheet';
import type { User } from '../../types';

interface MobileMoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const moreItems: {
  to: string;
  icon: typeof FolderKanban;
  label: string;
  roles?: User['role'][];
}[] = [
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/reports', icon: BarChart3, label: 'Reports', roles: MANAGER_ACCESS_ROLES },
  { to: '/users', icon: Users, label: 'Users', roles: MANAGER_ACCESS_ROLES },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function MobileMoreSheet({ isOpen, onClose }: MobileMoreSheetProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const visible = moreItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="More">
      <div className="space-y-1">
        {visible.map((item) => {
          const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => go(item.to)}
              className={clsx(
                'mobile-menu-item w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors min-h-[48px]',
                active
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'text-text-primary hover:bg-dark-hover',
              )}
            >
              <item.icon className={clsx('h-5 w-5 shrink-0', active ? 'text-accent-primary' : 'text-text-muted')} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
