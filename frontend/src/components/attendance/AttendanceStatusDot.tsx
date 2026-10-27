import clsx from 'clsx';
import type { AttendanceStatus } from '../../types';
import { formatRecordedTime, normalizeStatus, statusDotClass, statusLabel, statusShort } from './attendanceUtils';

interface Props {
  status: AttendanceStatus | string | null | undefined;
  recordedAt?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizes = {
  sm: 'h-2.5 w-2.5',
  md: 'h-3.5 w-3.5',
  lg: 'h-5 w-5',
};

export function AttendanceStatusDot({
  status,
  recordedAt,
  size = 'md',
  showLabel = false,
  className,
}: Props) {
  const normalized = normalizeStatus(status ?? undefined);
  const label = statusLabel(normalized);
  const time = formatRecordedTime(recordedAt);
  const title = time ? `${label} · ${time}` : label;

  return (
    <span
      className={clsx('inline-flex items-center gap-1.5', className)}
      title={title}
      aria-label={title}
    >
      <span
        className={clsx('rounded-full shrink-0', sizes[size], statusDotClass(normalized))}
        aria-hidden
      />
      {showLabel && (
        <span className="text-xs text-text-secondary">{statusShort(normalized)}</span>
      )}
    </span>
  );
}
