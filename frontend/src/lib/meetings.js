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
/**
 * Open a blank tab synchronously inside a click handler.
 * Required on iOS Safari — async window.open after await is blocked.
 */
export function openBlankMeetWindow() {
    try {
        return window.open('about:blank', '_blank');
    }
    catch {
        return null;
    }
}
function closeMeetWindow(win) {
    if (!win || win.closed)
        return;
    try {
        win.close();
    }
    catch {
        /* ignore */
    }
}
/**
 * Navigate to a Meet URL. Prefer a window opened during the user gesture.
 * Falls back to a new tab, then same-tab navigation if popups are blocked.
 */
export function openMeetUrl(url, pendingWindow) {
    if (!url)
        return;
    if (pendingWindow && !pendingWindow.closed) {
        try {
            pendingWindow.location.href = url;
            pendingWindow.focus();
            return;
        }
        catch {
            closeMeetWindow(pendingWindow);
        }
    }
    try {
        const opened = window.open(url, '_blank');
        if (opened) {
            try {
                opened.focus();
            }
            catch {
                /* ignore */
            }
            return;
        }
    }
    catch {
        /* ignore */
    }
    window.location.assign(url);
}
function toastApiError(err, fallback) {
    const msg = err?.response?.data?.detail
        || err?.response?.data?.message
        || fallback;
    toast.error(typeof msg === 'string' ? msg : fallback);
}
async function withMeetRedirect(pendingWindow, run, errorFallback) {
    try {
        const data = await run();
        if (data.redirect_url) {
            openMeetUrl(data.redirect_url, pendingWindow);
        }
        else {
            closeMeetWindow(pendingWindow);
        }
        return data;
    }
    catch (err) {
        closeMeetWindow(pendingWindow);
        toastApiError(err, errorFallback);
        throw err;
    }
}
export async function joinMorningCall(pendingWindow) {
    const data = await withMeetRedirect(pendingWindow, async () => {
        const res = await meetingsApi.joinMorning();
        return res.data.data;
    }, 'Could not join morning call');
    return data.log;
}
export async function startInstantCall(inviteUserIds, pendingWindow) {
    return withMeetRedirect(pendingWindow, async () => {
        const res = await meetingsApi.startInstant({ invite_user_ids: inviteUserIds });
        return res.data.data;
    }, 'Could not start instant call');
}
export async function endInstantCall(poolId) {
    try {
        const res = await meetingsApi.endInstant(poolId);
        return res.data.data;
    }
    catch (err) {
        toastApiError(err, 'Could not end call');
        throw err;
    }
}
export async function startTaskCall(taskId, pendingWindow) {
    return withMeetRedirect(pendingWindow, async () => {
        const res = await meetingsApi.startTaskCall(taskId);
        return res.data.data;
    }, 'Could not start task call');
}
export async function joinTaskCall(taskId, pendingWindow) {
    return withMeetRedirect(pendingWindow, async () => {
        const res = await meetingsApi.joinTaskCall(taskId);
        return res.data.data;
    }, 'Could not join task call');
}
export async function endTaskCall(taskId) {
    try {
        const res = await meetingsApi.endTaskCall(taskId);
        return res.data.data;
    }
    catch (err) {
        toastApiError(err, 'Could not end task call');
        throw err;
    }
}
export function formatMeetingTime(iso) {
    return format(new Date(iso), 'h:mm a');
}
export function todayIsoDate() {
    return format(new Date(), 'yyyy-MM-dd');
}
export function statusBadgeClass(status) {
    if (!status)
        return '';
    if (status === 'Late' || status === 'Delayed Response')
        return 'bg-amber-500/15 text-amber-400';
    return 'bg-emerald-500/15 text-emerald-400';
}
