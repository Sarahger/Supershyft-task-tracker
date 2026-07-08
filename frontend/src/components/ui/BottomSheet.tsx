import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({ isOpen, onClose, title, children, className }: BottomSheetProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) {
      document.addEventListener('keydown', handler);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden pointer-events-none">
      <div
        className="fixed inset-0 bg-[var(--overlay-backdrop)] animate-in fade-in duration-200 pointer-events-auto"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'relative w-full max-h-[85vh] rounded-t-2xl bg-dark-card border-t border-dark-border pointer-events-auto',
          'dropdown-panel animate-in slide-in-from-bottom duration-300 flex flex-col',
          className,
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-center pt-2 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-dark-border" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-4 pb-3 shrink-0">
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -mr-1 rounded-lg text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
