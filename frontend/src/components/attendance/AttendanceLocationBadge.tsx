import clsx from 'clsx';
import type { AttendanceDayRow } from '../../types';

interface Props {
  row: Pick<
    AttendanceDayRow,
    'status' | 'office_name' | 'location_verified' | 'verification_method' | 'distance_from_office' | 'gps_accuracy' | 'recorded_at'
  >;
  showDetail?: boolean;
}

export function AttendanceLocationBadge({ row, showDetail = false }: Props) {
  if (row.status !== 'WFO') {
    return <span className="text-xs text-text-muted">—</span>;
  }

  if (row.location_verified) {
    return (
      <div className="text-xs">
        <span className="text-emerald-400 font-medium">✓ Verified</span>
        {showDetail && row.office_name && (
          <p className="text-text-muted mt-0.5">{row.office_name}</p>
        )}
        {showDetail && row.distance_from_office != null && (
          <p className="text-text-muted">{Math.round(row.distance_from_office)}m · GPS ±{Math.round(row.gps_accuracy ?? 0)}m</p>
        )}
      </div>
    );
  }

  if (row.location_verified === false) {
    return (
      <div className="text-xs">
        <span className="text-amber-400 font-medium">✕ Not Verified</span>
        {showDetail && row.office_name && (
          <p className="text-text-muted mt-0.5">{row.office_name}</p>
        )}
        {showDetail && row.distance_from_office != null && (
          <p className="text-text-muted">{Math.round(row.distance_from_office)}m from office</p>
        )}
        {showDetail && row.verification_method === 'hr_override' && (
          <p className="text-text-muted">Marked by HR</p>
        )}
      </div>
    );
  }

  return <span className={clsx('text-xs text-text-muted')}>—</span>;
}
