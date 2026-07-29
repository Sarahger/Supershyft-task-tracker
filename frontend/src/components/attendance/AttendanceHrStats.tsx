import clsx from 'clsx';
import { Building2, Home, Umbrella, CircleDashed } from 'lucide-react';
import type { AttendanceTodayStats } from '../../types';

interface Props {
  stats: AttendanceTodayStats | undefined;
  loading?: boolean;
}

const CARDS = [
  { key: 'present_wfo' as const, label: 'Present Today (WFO)', icon: Building2, color: 'text-emerald-400' },
  { key: 'wfh' as const, label: 'WFH Today', icon: Home, color: 'text-sky-400' },
  { key: 'on_leave' as const, label: 'On Leave', icon: Umbrella, color: 'text-amber-400' },
  { key: 'not_marked' as const, label: 'Not Marked', icon: CircleDashed, color: 'text-text-muted' },
];

export function AttendanceHrStats({ stats, loading }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {CARDS.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.key}
            className="rounded-2xl border border-dark-border bg-dark-card p-4"
            data-testid={`hr-stat-${c.key}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                {loading || !stats ? (
                  <div className="h-7 w-10 bg-dark-muted rounded animate-pulse" />
                ) : (
                  <p className={clsx('text-2xl font-semibold tabular-nums', c.color)}>{stats[c.key]}</p>
                )}
                <p className="text-xs text-text-secondary mt-1 font-medium">{c.label}</p>
              </div>
              <Icon className={clsx('h-4 w-4 shrink-0 opacity-70', c.color)} aria-hidden />
            </div>
          </div>
        );
      })}
    </div>
  );
}
