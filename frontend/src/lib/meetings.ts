import { format } from 'date-fns';
import { meetingsApi } from '../services/endpoints';
import { toast } from '../components/ui/Toast';

export const MORNING_MEET_URL = 'https://meet.google.com/mvs-btmd-bby';

const MORNING_START_MINUTES = 9 * 60 + 45;
const MORNING_END_MINUTES = 11 * 60 + 15;

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
  return mins >= MORNING_START_MINUTES && mins <= MORNING_END_MINUTES;
}

export function openMeetUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function toastApiError(err: unknown, fallback: string) {
  const msg =
    (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data?.detail
    || (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    || fallback;
  toast.error(typeof msg === 'string' ? msg : fallback);
}

export async function joinMorningCall() {
  try {
    const res = await meetingsApi.joinMorning();
    const { redirect_url } = res.data.data;
    if (redirect_url) openMeetUrl(redirect_url);
    return res.data.data.log;
  } catch (err: unknown) {
    toastApiError(err, 'Could not join morning call');
    throw err;
  }
}

export async function startInstantCall(inviteUserIds: number[]) {
  try {
    const res = await meetingsApi.startInstant({ invite_user_ids: inviteUserIds });
    const { redirect_url } = res.data.data;
    if (redirect_url) openMeetUrl(redirect_url);
    return res.data.data;
  } catch (err: unknown) {
    toastApiError(err, 'Could not start instant call');
    throw err;
  }
}

export async function endInstantCall(poolId: number) {
  try {
    const res = await meetingsApi.endInstant(poolId);
    return res.data.data;
  } catch (err: unknown) {
    toastApiError(err, 'Could not end call');
    throw err;
  }
}

export async function startTaskCall(taskId: number) {
  try {
    const res = await meetingsApi.startTaskCall(taskId);
    const { redirect_url } = res.data.data;
    if (redirect_url) openMeetUrl(redirect_url);
    return res.data.data;
  } catch (err: unknown) {
    toastApiError(err, 'Could not start task call');
    throw err;
  }
}

export async function joinTaskCall(taskId: number) {
  try {
    const res = await meetingsApi.joinTaskCall(taskId);
    const { redirect_url } = res.data.data;
    if (redirect_url) openMeetUrl(redirect_url);
    return res.data.data;
  } catch (err: unknown) {
    toastApiError(err, 'Could not join task call');
    throw err;
  }
}

export async function endTaskCall(taskId: number) {
  try {
    const res = await meetingsApi.endTaskCall(taskId);
    return res.data.data;
  } catch (err: unknown) {
    toastApiError(err, 'Could not end task call');
    throw err;
  }
}

export function formatMeetingTime(iso: string) {
  return format(new Date(iso), 'h:mm a');
}

export function todayIsoDate() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function statusBadgeClass(status: string | null) {
  if (!status) return '';
  if (status === 'Late' || status === 'Delayed Response') return 'bg-amber-500/15 text-amber-400';
  return 'bg-emerald-500/15 text-emerald-400';
}
