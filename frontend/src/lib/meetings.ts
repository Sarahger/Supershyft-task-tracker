import { format } from 'date-fns';
import { meetingsApi } from '../services/endpoints';
import { toast } from '../components/ui/Toast';

export const DEFAULT_MEET_URL = 'https://meet.google.com/mvs-btmd-bby';

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
