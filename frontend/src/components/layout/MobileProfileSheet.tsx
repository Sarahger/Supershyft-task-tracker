import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, type ThemePreference } from '../../contexts/ThemeContext';
import { Avatar } from '../ui/Avatar';
import { BottomSheet } from '../ui/BottomSheet';

interface MobileProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function MobileProfileSheet({ isOpen, onClose }: MobileProfileSheetProps) {
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const navigate = useNavigate();

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleLogout = () => {
    onClose();
    logout();
    navigate('/login');
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Account">
      {user && (
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-dark-border">
          <Avatar name={`${user.first_name} ${user.last_name}`} size="lg" />
          <div className="min-w-0">
            <p className="text-base font-semibold text-text-primary truncate">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-sm text-text-muted truncate">{user.email}</p>
            <p className="text-xs text-text-muted capitalize mt-0.5">{user.role}</p>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => go('/settings')}
          className="mobile-menu-item w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-text-primary hover:bg-dark-hover transition-colors min-h-[48px]"
        >
          <Settings className="h-5 w-5 text-text-muted shrink-0" />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-dark-border">
        <p className="text-2xs font-medium uppercase tracking-wider text-text-muted mb-2 px-1">Theme</p>
        <div className="grid grid-cols-3 gap-2">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPreference(opt.value)}
              className={clsx(
                'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-colors min-h-[72px]',
                preference === opt.value
                  ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                  : 'border-dark-border bg-surface-subtle text-text-secondary hover:bg-dark-hover',
              )}
            >
              <opt.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-4 w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-accent-danger hover:bg-dark-hover transition-colors min-h-[48px]"
      >
        <LogOut className="h-5 w-5 shrink-0" />
        <span className="text-sm font-medium">Sign out</span>
      </button>
    </BottomSheet>
  );
}
