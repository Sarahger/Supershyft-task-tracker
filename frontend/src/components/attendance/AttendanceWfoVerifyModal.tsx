import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Check, Loader2, MapPin, RefreshCw, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { AttendanceRecord } from '../../types';
import { formatRecordedTime } from './attendanceUtils';
import { Button } from '../ui/Button';
import { GeolocationError, getCurrentPosition } from '../../lib/geolocation';

type Phase =
  | 'getting_location'
  | 'verifying'
  | 'success'
  | 'not_verified'
  | 'permission_denied'
  | 'poor_accuracy'
  | 'error';

interface Props {
  open: boolean;
  attendanceDate?: string;
  onClose: () => void;
  onSubmit: (coords: { latitude: number; longitude: number; gps_accuracy: number }) => Promise<AttendanceRecord>;
  onComplete: (record: AttendanceRecord) => void;
}

export function AttendanceWfoVerifyModal({
  open,
  attendanceDate,
  onClose,
  onSubmit,
  onComplete,
}: Props) {
  const [phase, setPhase] = useState<Phase>('getting_location');
  const [message, setMessage] = useState('');
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const runId = useRef(0);

  const runVerification = useCallback(async () => {
    const id = ++runId.current;
    setRecord(null);
    setPhase('getting_location');
    setMessage('Getting your location...');

    try {
      const coords = await getCurrentPosition();
      if (id !== runId.current) return;

      setPhase('verifying');
      setMessage('Verifying office location...');

      const saved = await onSubmit({
        latitude: coords.latitude,
        longitude: coords.longitude,
        gps_accuracy: coords.accuracy,
      });
      if (id !== runId.current) return;

      setRecord(saved);
      if (saved.location_verified) {
        setPhase('success');
        return;
      }

      if (saved.verification_method === 'gps_poor_accuracy') {
        setPhase('poor_accuracy');
        setMessage(
          'Unable to reliably verify your location. Please move to an area with better GPS signal and try again.',
        );
        return;
      }

      if (saved.verification_method === 'gps_outside_radius') {
        setPhase('not_verified');
        return;
      }

      setPhase('error');
      setMessage('Could not verify your location.');
    } catch (error) {
      if (id !== runId.current) return;
      if (error instanceof GeolocationError) {
        setMessage(error.message);
        setPhase(error.code === 'denied' ? 'permission_denied' : 'error');
        return;
      }
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPhase('error');
      setMessage(typeof detail === 'string' ? detail : 'Could not verify your location. Please try again.');
    }
  }, [onSubmit]);

  useEffect(() => {
    if (!open) {
      runId.current += 1;
      setPhase('getting_location');
      setMessage('Getting your location...');
      setRecord(null);
      return;
    }
    void runVerification();
  }, [open, runVerification]);

  useEffect(() => {
    if (phase === 'success' && record) {
      const timer = window.setTimeout(() => onComplete(record), 2200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase, record, onComplete]);

  if (!open) return null;

  const formattedDate =
    attendanceDate && attendanceDate !== format(new Date(), 'yyyy-MM-dd')
      ? format(parseISO(attendanceDate), 'MMM d, yyyy')
      : null;

  const showFailure =
    phase === 'not_verified' ||
    phase === 'poor_accuracy' ||
    phase === 'permission_denied' ||
    phase === 'error';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wfo-verify-title"
    >
      <div className="fixed inset-0 bg-[var(--overlay-backdrop)]" onClick={onClose} />
      <div className="relative w-[90%] max-w-md rounded-2xl border border-dark-border bg-dark-card modal-panel my-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 flex flex-col items-center text-center gap-4">
          {(phase === 'getting_location' || phase === 'verifying') && (
            <>
              <div className="h-12 w-12 rounded-full bg-sky-500/15 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-sky-400 animate-spin" />
              </div>
              <div>
                <h2 id="wfo-verify-title" className="text-base font-semibold text-text-primary">
                  {phase === 'getting_location' ? 'Getting your location...' : 'Verifying office location...'}
                </h2>
                {formattedDate && (
                  <p className="text-xs text-text-muted mt-1">Marking WFO for {formattedDate}</p>
                )}
              </div>
            </>
          )}

          {phase === 'success' && record && (
            <>
              <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Check className="h-6 w-6 text-emerald-400" strokeWidth={2.5} />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-emerald-400">✓ Office Verified</p>
                {record.office_name && (
                  <p className="text-sm text-text-primary flex items-center justify-center gap-1.5">
                    <Building2 className="h-4 w-4 text-text-muted" />
                    {record.office_name}
                  </p>
                )}
                {record.distance_from_office != null && (
                  <p className="text-sm text-text-secondary">
                    {Math.round(record.distance_from_office)}m from office
                  </p>
                )}
                <p className="text-xs text-text-muted">
                  Attendance marked at {formatRecordedTime(record.recorded_at)}
                </p>
              </div>
            </>
          )}

          {showFailure && (
            <>
              <div className="h-12 w-12 rounded-full bg-amber-500/15 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-amber-400" />
              </div>
              <div className="space-y-2">
                <h2 id="wfo-verify-title" className="text-base font-semibold text-text-primary">
                  {phase === 'permission_denied'
                    ? 'Location access required'
                    : phase === 'poor_accuracy'
                      ? 'GPS signal too weak'
                      : 'Location not verified'}
                </h2>
                <p className="text-sm text-text-secondary">
                  {phase === 'permission_denied'
                    ? 'Location access is required to mark WFO attendance. Enable location in your browser settings and try again.'
                    : phase === 'not_verified'
                      ? 'You appear to be outside the office attendance zone.'
                      : message}
                </p>
                {record?.distance_from_office != null && phase === 'not_verified' && (
                  <p className="text-xs text-text-muted">
                    Approximately {Math.round(record.distance_from_office)}m from{' '}
                    {record.office_name || 'nearest office'}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                <Button className="flex-1 gap-1.5" onClick={() => void runVerification()}>
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button variant="secondary" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
              </div>
              {phase === 'not_verified' && record && !record.location_verified && (
                <Button variant="secondary" className="w-full" onClick={() => onComplete(record)}>
                  Done
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
