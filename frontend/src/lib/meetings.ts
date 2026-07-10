import { format } from 'date-fns';
import { meetingsApi } from '../services/endpoints';
import { toast } from '../components/ui/Toast';

export const DEFAULT_MEET_URL = 'https://meet.google.com/mvs-btmd-bby';

const MORNING_CALL_START_MINUTES = 9 * 60 + 30;
const MORNING_CALL_END_MINUTES = 10 * 60 + 30;

export function isInMorningCallWindow(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const mins = hour * 60 + minute;
  return mins >= MORNING_CALL_START_MINUTES && mins <= MORNING_CALL_END_MINUTES;
}

export async function joinMeetingAndRedirect(kind: 'morning' | 'quick' | 'task', taskId?: number) {
  try {
    const res = await meetingsApi.join({ kind, task_id: taskId });
    const { redirect_url } = res.data.data;
    window.open(redirect_url, '_blank', 'noopener,noreferrer');
    return res.data.data.log;
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data?.detail
      || (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      || 'Could not start meeting';
    toast.error(typeof msg === 'string' ? msg : 'Could not start meeting');
    throw err;
  }
}

export function formatMeetingTime(iso: string) {
  return format(new Date(iso), 'h:mm a');
}

export function formatMeetingDate(iso: string) {
  return format(new Date(iso), 'MMM d, yyyy');
}

export function todayIsoDate() {
  return format(new Date(), 'yyyy-MM-dd');
}
