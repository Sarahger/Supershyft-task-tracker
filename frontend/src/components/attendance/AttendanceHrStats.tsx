import clsx from 'clsx';
import { Building2, Home, Umbrella, CircleDashed, Clock, Users } from 'lucide-react';
import type { AttendanceTodayStatKey, AttendanceTodayStats } from '../../types';

interface Props {
  stats: AttendanceTodayStats | undefined;
  loading?: boolean;
  activeKey?: AttendanceTodayStatKey | null;
  onSelect?: (key: AttendanceTodayStatKey) => void;
}

const CARDS: {
  key: AttendanceTodayStatKey;
  label: string;
  icon: typeof Building2;
  color: string;
  border: string;
  iconWrap: string;
}[] = [
  {
    key: 'present_wfo',
    label: 'Present (WFO)',
    icon: Building2,
    color: 'metric-emerald',
    border: 'border-emerald-500/20 bg-emerald-500/5',
    iconWrap: 'bg-emerald-500/10 text-emerald-400',
  },
  {
    key: 'wfh',
    label: 'WFH',
    icon: Home,
    color: 'metric-sky',
    border: 'border-sky-500/20 bg-sky-500/5',
    iconWrap: 'bg-sky-500/10 text-sky-400',
  },
  {
    key: 'on_leave',
    label: 'On leave',
    icon: Umbrella,
    color: 'metric-amber',
    border: 'border-amber-500/20 bg-amber-500/5',
    iconWrap: 'bg-amber-500/10 text-amber-400',
  },
  {
    key: 'half_day',
    label: 'Half day',
    icon: Clock,
    color: 'metric-violet',
    border: 'border-violet-500/20 bg-violet-500/5',
    iconWrap: 'bg-violet-500/10 text-violet-400',
  },
  {
    key: 'camp',
    label: 'Camp/Meeting',
    icon: Users,
    color: 'metric-orange',
    border: 'border-orange-500/20 bg-orange-500/5',
    iconWrap: 'bg-orange-500/10 text-orange-400',
  },
  {
    key: 'not_marked',
    label: 'Not marked',
    icon: CircleDashed,
    color: 'text-text-muted',
    border: 'border-dark-border',
    iconWrap: 'bg-surface-muted text-text-muted',
  },
];

export function AttendanceHrStats({ stats, loading, activeKey, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {CARDS.map((c) => {
        const Icon = c.icon;
        const count = stats?.[c.key] ?? 0;
        const isActive = activeKey === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect?.(c.key)}
            disabled={loading || !stats}
            className={clsx(
              'card p-4 border text-left transition-colors duration-hover',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary',
              'disabled:cursor-default',
              c.border,
              onSelect && !loading && stats && 'hover:bg-dark-hover cursor-pointer',
              isActive && 'ring-2 ring-accent-primary/40',
            )}
            data-testid={`hr-stat-${c.key}`}
            aria-pressed={isActive}
            aria-label={`Show ${count} people — ${c.label}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                {loading || !stats ? (
                  <div className="h-7 w-10 bg-dark-muted rounded animate-pulse" />
                ) : (
                  <p className={clsx('text-2xl font-semibold tabular-nums', c.color)}>{count}</p>
                )}
                <p className="text-xs text-text-secondary mt-1 font-medium">{c.label}</p>
              </div>
              <div className={clsx('p-1.5 rounded-lg shrink-0', c.iconWrap)}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export const ATTENDANCE_HR_STAT_LABELS: Record<AttendanceTodayStatKey, string> = {
  present_wfo: 'Present (WFO)',
  wfh: 'WFH',
  on_leave: 'On leave',
  half_day: 'Half day',
  camp: 'Camp/Meeting',
  not_marked: 'Not marked',
};
