import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { AtSign, Calendar, Flag, Plus, Rocket, X } from 'lucide-react';

type Priority = 'high' | 'mid' | 'low';

interface FluxCreateTaskComposerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRIORITY_OPTIONS: { id: Priority; label: string }[] = [
  { id: 'high', label: 'High' },
  { id: 'mid', label: 'Mid' },
  { id: 'low', label: 'Low' },
];

function formatDraftStamp(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `draft_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function FluxCreateTaskComposer({ isOpen, onClose }: FluxCreateTaskComposerProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [priority, setPriority] = useState<Priority>('mid');
  const [dueLabel, setDueLabel] = useState('No date');
  const [assigneeHint, setAssigneeHint] = useState<string | null>(null);
  const [draftId] = useState(() => formatDraftStamp());
  const [shippedFlash, setShippedFlash] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setDescription('');
    setShowDescription(false);
    setPriority('mid');
    setDueLabel('No date');
    setAssigneeHint(null);
    setShippedFlash(false);
    const t = window.setTimeout(() => titleRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const insertToken = (token: string) => {
    const el = titleRef.current;
    const value = title;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const needsSpace = start > 0 && !/\s$/.test(value.slice(0, start));
    const insert = `${needsSpace ? ' ' : ''}${token} `;
    const next = value.slice(0, start) + insert + value.slice(end);
    setTitle(next);
    requestAnimationFrame(() => {
      const pos = start + insert.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const cycleDue = () => {
    const cycle = ['No date', 'Today', 'Tomorrow', 'Friday', 'Next week'];
    const i = cycle.indexOf(dueLabel);
    setDueLabel(cycle[(i + 1) % cycle.length]);
  };

  const handleShip = () => {
    if (!title.trim()) {
      titleRef.current?.focus();
      return;
    }
    setShippedFlash(true);
    window.setTimeout(() => {
      setShippedFlash(false);
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[var(--overlay-backdrop)] backdrop-blur-[2px] animate-[fluxFade_200ms_ease-out]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx(
          'relative w-full sm:max-w-[520px] max-h-[92vh] overflow-y-auto',
          'rounded-t-3xl sm:rounded-3xl border border-dark-border',
          'bg-dark-card shadow-[var(--shadow-dropdown)]',
          'animate-[fluxRise_280ms_cubic-bezier(0.22,1,0.36,1)]',
          'px-5 pt-5 pb-6 sm:px-7 sm:pt-6 sm:pb-7',
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">
              New entry
            </p>
            <p className="text-xs text-text-secondary mt-0.5 font-mono opacity-80">/ {draftId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-1 rounded-full text-text-muted hover:text-text-primary hover:bg-dark-hover transition-colors"
            aria-label="Close composer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label htmlFor={titleId} className="sr-only">
          Task title
        </label>
        <textarea
          id={titleId}
          ref={titleRef}
          rows={2}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to ship?"
          className={clsx(
            'w-full resize-none bg-transparent border-0 p-0',
            'text-[1.65rem] sm:text-[1.85rem] leading-[1.2] font-semibold tracking-tight',
            'text-text-primary placeholder:text-text-muted/50',
            'focus:outline-none focus:ring-0',
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleShip();
            }
          }}
        />

        {showDescription ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add description"
            rows={3}
            className="mt-3 w-full resize-none bg-transparent border-0 p-0 text-[15px] leading-relaxed text-text-secondary placeholder:text-text-muted focus:outline-none focus:ring-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowDescription(true)}
            className="mt-3 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            Add description
          </button>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-dark-border bg-surface-subtle/80 p-0.5">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPriority(opt.id)}
                className={clsx(
                  'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all',
                  priority === opt.id
                    ? opt.id === 'high'
                      ? 'bg-red-500/20 text-red-300'
                      : opt.id === 'mid'
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'bg-sky-500/15 text-sky-300'
                    : 'text-text-muted hover:text-text-secondary',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={cycleDue}
            className="inline-flex items-center gap-1.5 rounded-full border border-dark-border px-3 py-1.5 text-xs text-text-secondary hover:bg-dark-hover transition-colors"
          >
            <Calendar className="h-3.5 w-3.5 text-text-muted" />
            {dueLabel}
          </button>

          {assigneeHint && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-dark-border px-3 py-1.5 text-xs text-text-secondary">
              <AtSign className="h-3.5 w-3.5 text-text-muted" />
              {assigneeHint}
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <QuickChip
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="/Date"
            onClick={() => {
              cycleDue();
              insertToken('/friday');
            }}
          />
          <QuickChip
            icon={<AtSign className="h-3.5 w-3.5" />}
            label="@Assign"
            onClick={() => {
              setAssigneeHint('Unassigned');
              insertToken('@');
            }}
          />
          <QuickChip
            icon={<Flag className="h-3.5 w-3.5" />}
            label="!Priority"
            onClick={() => {
              const order: Priority[] = ['high', 'mid', 'low'];
              setPriority(order[(order.indexOf(priority) + 1) % order.length]);
              insertToken(`!${priority === 'high' ? 'mid' : priority === 'mid' ? 'low' : 'high'}`);
            }}
          />
        </div>

        <div className="mt-7 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleShip}
            className={clsx(
              'group relative w-full overflow-hidden rounded-2xl px-4 py-3.5',
              'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]',
              'text-sm font-semibold tracking-wide',
              'hover:opacity-95 active:scale-[0.99] transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Rocket className={clsx('h-4 w-4 transition-transform', shippedFlash && 'translate-x-1 -translate-y-1')} />
              {shippedFlash ? 'Shipped (preview)' : 'Ship Task'}
            </span>
          </button>
          <p className="text-[12px] leading-relaxed text-text-muted text-center sm:text-left">
            <span className="text-text-secondary font-medium">Pro-tip:</span>{' '}
            Type “Ship the deck @ravi !high /friday” — it fills everything for you.
          </p>
          <p className="text-[11px] text-text-muted/80 text-center sm:text-left">
            Form preview only — not connected to the API yet.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fluxFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fluxRise {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function QuickChip({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-dark-border px-3 py-2 text-xs text-text-muted hover:text-text-secondary hover:border-text-muted/40 hover:bg-dark-hover/60 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

/** Global floating “new task” control — visible on all breakpoints. */
export function GlobalCreateTaskFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="New task"
      className={clsx(
        'fixed z-[45] flex items-center justify-center',
        'h-14 w-14 rounded-full',
        'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]',
        'shadow-[0_12px_40px_rgba(0,0,0,0.35)]',
        'hover:scale-105 active:scale-95 transition-transform duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg',
        'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4',
        'md:bottom-8 md:right-8',
      )}
    >
      <Plus className="h-6 w-6 stroke-[2.5]" />
    </button>
  );
}
