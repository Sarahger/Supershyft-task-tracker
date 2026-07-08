import { X } from 'lucide-react';
import clsx from 'clsx';
import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-xl' };

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[var(--overlay-backdrop)]" onClick={onClose} />
      <div className={clsx('relative w-full rounded-2xl bg-dark-card border border-dark-border modal-panel', sizes[size])}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Drawer({ isOpen, onClose, children }: DrawerProps) {
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[var(--overlay-backdrop)] transition-opacity duration-drawer"
        onClick={onClose}
      />
      <div className={clsx(
        'relative w-full max-w-[680px] sm:max-w-[720px] bg-dark-drawer flex flex-col h-full border-l border-dark-border drawer-panel',
        'animate-slide-in max-sm:max-w-full'
      )}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function DrawerSection({ title, children, defaultOpen = true }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="drawer-section group">
      <summary className="text-xs font-medium uppercase tracking-wider text-text-muted cursor-pointer list-none flex items-center justify-between select-none">
        {title}
        <Chevron className="group-open:rotate-180 transition-transform duration-hover" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg className={clsx('h-3 w-3 text-text-muted', className)} viewBox="0 0 12 12" fill="currentColor">
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
