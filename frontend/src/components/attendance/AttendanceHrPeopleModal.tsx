import { useState } from 'react';
import type { AttendanceUserBrief } from '../../types';
import { Avatar } from '../ui/Avatar';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  title: string;
  people: AttendanceUserBrief[];
  onClose: () => void;
  onSelectUser: (userId: number) => void;
}

export function AttendanceHrPeopleModal({ open, title, people, onClose, onSelectUser }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0 bg-[var(--overlay-backdrop)]" onClick={onClose} />
      <div
        className={clsx(
          'relative w-full sm:max-w-md bg-dark-card border border-dark-border modal-panel',
          'flex flex-col',
          'max-h-[min(85dvh,calc(100dvh-1rem))] sm:max-h-[min(80vh,560px)]',
          'rounded-t-2xl sm:rounded-2xl',
          'pb-[env(safe-area-inset-bottom,0px)]',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-dark-border shrink-0">
          <h2 className="text-base font-semibold text-text-primary truncate min-w-0">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain min-h-0 flex-1 px-4 sm:px-5 py-3">
          {people.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-text-secondary">No one in this group.</p>
              <p className="text-xs text-text-muted mt-1">Counts update as people mark attendance.</p>
            </div>
          ) : (
            <ul className="divide-y divide-dark-border" data-testid="hr-stat-people-list">
              {people.map((user) => {
                const name = `${user.first_name} ${user.last_name}`.trim();
                const dept = (user.departments || []).join(', ') || '—';
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectUser(user.id);
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-dark-hover transition-colors duration-hover rounded-lg"
                    >
                      <Avatar name={name} src={user.profile_picture} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">{name}</p>
                        <p className="text-xs text-text-muted truncate">
                          {user.job_title ? `${user.job_title} · ${dept}` : dept}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
