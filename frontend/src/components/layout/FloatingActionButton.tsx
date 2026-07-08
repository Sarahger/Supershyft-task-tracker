import { Plus } from 'lucide-react';
import clsx from 'clsx';

interface FloatingActionButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export function FloatingActionButton({ onClick, label = 'Create task', className }: FloatingActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={clsx(
        'mobile-fab fixed z-30 md:hidden flex items-center justify-center',
        'h-14 w-14 rounded-full bg-accent-primary text-white shadow-lg',
        'hover:opacity-90 active:scale-95 transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2',
        className,
      )}
    >
      <Plus className="h-6 w-6 stroke-[2.5]" />
    </button>
  );
}
