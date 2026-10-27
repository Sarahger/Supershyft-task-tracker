import clsx from 'clsx';
import type { WeeklyOverview } from '../../types';

export type OverviewFilter = 'all' | 'submitted' | 'pending' | 'overdue' | 'completed' | 'upcoming' | 'carried_forward';

const chips: { key: OverviewFilter; label: string; field: keyof WeeklyOverview }[] = [
  { key: 'submitted', label: 'Submitted', field: 'submitted' },
  { key: 'pending', label: 'Pending', field: 'pending' },
  { key: 'completed', label: 'Completed', field: 'completed' },
  { key: 'upcoming', label: 'Upcoming', field: 'upcoming' },
  { key: 'overdue', label: 'Overdue', field: 'overdue' },
  { key: 'carried_forward', label: 'Carried forward', field: 'carried_forward' },
];

export function WeeklyOverviewStats({
  overview,
  active,
  onSelect,
}: {
  overview: WeeklyOverview;
  active: OverviewFilter;
  onSelect: (key: OverviewFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => {
        const value = overview[chip.field];
        const selected = active === chip.key;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onSelect(selected ? 'all' : chip.key)}
            className={clsx(
              'rounded-full border px-2.5 py-1 text-xs transition-colors',
              selected
                ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                : 'border-dark-border text-text-secondary hover:text-text-primary',
            )}
          >
            <span className="font-semibold tabular-nums">{String(value)}</span>
            <span className="ml-1">{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
}
