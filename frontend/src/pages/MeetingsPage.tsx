import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Video, Phone, Clock, Users, AlertTriangle, LogOut, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { meetingsApi } from '../services/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { canAccessManagerFeatures } from '../lib/roles';
import { joinMeetingAndRedirect, isInMorningCallWindow, todayIsoDate } from '../lib/meetings';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import type { MeetingLog } from '../types';

function userName(user?: { first_name: string; last_name: string } | null) {
  return user ? `${user.first_name} ${user.last_name}` : 'Unknown';
}

function LogRow({ log, meetUrl, onLeave }: { log: MeetingLog; meetUrl: string; onLeave?: (id: number) => void }) {
  const joined = format(new Date(log.click_time), 'h:mm a');
  const left = log.left_at ? format(new Date(log.left_at), 'h:mm a') : null;
  return (
    <div className="flex flex-wrap items-center gap-2 py-2 border-b border-dark-border last:border-0 text-sm">
      <div className="flex-1 min-w-[200px]">
        <p className="text-text-primary font-medium">{log.log_type}</p>
        {log.task_title && <p className="text-text-muted text-xs mt-0.5">{log.task_title}</p>}
        {log.status && (
          <span className={clsx(
            'inline-block mt-1 text-xs px-1.5 py-0.5 rounded',
            log.status === 'Late' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400',
          )}>
            {log.status}
          </span>
        )}
      </div>
      <div className="text-text-secondary tabular-nums">
        <span>Joined {joined}</span>
        {left ? <span className="text-text-muted"> · Left {left}</span> : <span className="text-text-muted"> · Still in call</span>}
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Button
          variant="secondary"
          size="sm"
          className="gap-1"
          onClick={() => window.open(meetUrl, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Join
        </Button>
        {!left && onLeave && (
          <Button variant="secondary" size="sm" className="gap-1" onClick={() => onLeave(log.id)}>
            <LogOut className="h-3.5 w-3.5" /> Left call
          </Button>
        )}
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  const { user } = useAuth();
  const isManager = canAccessManagerFeatures(user);
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [inMorningWindow, setInMorningWindow] = useState(isInMorningCallWindow());

  useEffect(() => {
    const tick = () => setInMorningWindow(isInMorningCallWindow());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['meetings-day', selectedDate],
    queryFn: () => meetingsApi.getDay(selectedDate).then((r) => r.data.data),
  });

  const joinMutation = useMutation({
    mutationFn: (kind: 'morning' | 'quick') => joinMeetingAndRedirect(kind),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings-day', selectedDate] });
      toast.success('Opening Google Meet…');
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (logId: number) => meetingsApi.leave(logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings-day', selectedDate] });
      toast.success('Departure recorded');
    },
    onError: () => toast.error('Could not record departure'),
  });

  const settingsMutation = useMutation({
    mutationFn: (enabled: boolean) => meetingsApi.updateDaySettings(selectedDate, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings-day', selectedDate] });
      toast.success('Morning call availability updated');
    },
    onError: () => toast.error('Could not update setting'),
  });

  const meetUrl = data?.meet_url ?? 'https://meet.google.com/mvs-btmd-bby';
  const managerOverride = data?.morning_call_enabled ?? false;
  const isToday = selectedDate === todayIsoDate();
  const canJoinMorning = isToday && (inMorningWindow || managerOverride);
  const displayDate = (() => {
    try {
      return format(parseISO(selectedDate), 'EEEE, MMM d, yyyy');
    } catch {
      return selectedDate;
    }
  })();

  return (
    <div className="max-w-workspace mx-auto pb-12">
      <PageHeader
        title="Meetings"
        subtitle="Daily standups and quick team calls"
        action={
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input py-1.5 text-sm w-auto"
          />
        }
      />

      <p className="text-sm text-text-muted mb-6">{displayDate}</p>

      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <div className="rounded-xl border border-dark-border bg-dark-card p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <Video className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-text-primary">Daily Morning Call</h2>
              <p className="text-sm text-text-muted mt-0.5">
                Available 9:30–10:30 AM by default. On-time if joined by 10:00 AM.
              </p>
            </div>
          </div>

          {isToday && !canJoinMorning && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
              Morning call opens at 9:30 AM. A manager can enable it anytime using the checkbox below.
            </div>
          )}

          {isManager && (
            <label className="flex items-center gap-2 mb-4 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={managerOverride}
                disabled={settingsMutation.isPending}
                onChange={(e) => settingsMutation.mutate(e.target.checked)}
                className="rounded border-dark-border"
              />
              Enable morning call anytime today
            </label>
          )}

          <Button
            className="w-full gap-2"
            disabled={!canJoinMorning || joinMutation.isPending}
            onClick={() => joinMutation.mutate('morning')}
          >
            <Video className="h-4 w-4" /> Join Morning Call
          </Button>
        </div>

        <div className="rounded-xl border border-dark-border bg-dark-card p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
              <Phone className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-text-primary">Instant Workspace Call</h2>
              <p className="text-sm text-text-muted mt-0.5">
                Jump into a quick team call anytime — no attendance tracking.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="w-full gap-2"
            disabled={joinMutation.isPending}
            onClick={() => joinMutation.mutate('quick')}
          >
            <Phone className="h-4 w-4" /> Launch Quick Team Call
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-32 rounded-xl bg-dark-muted animate-pulse" />
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-dark-border bg-dark-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-text-muted" />
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Your attendance</h3>
            </div>
            {!data?.my_logs.length ? (
              <p className="text-sm text-text-muted">No meeting activity recorded for this day.</p>
            ) : (
              data.my_logs.map((log) => (
                <LogRow
                  key={log.id}
                  log={log}
                  meetUrl={meetUrl}
                  onLeave={(id) => leaveMutation.mutate(id)}
                />
              ))
            )}
          </section>

          {isManager && (
            <section className="rounded-xl border border-dark-border bg-dark-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Late morning arrivals</h3>
              </div>
              {!data?.late_arrivals.length ? (
                <p className="text-sm text-text-muted">No late arrivals for the morning call.</p>
              ) : (
                <div className="space-y-1">
                  {data.late_arrivals.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-2 text-sm border-b border-dark-border last:border-0">
                      <span className="text-text-primary">{userName(log.user)}</span>
                      <span className="text-text-secondary tabular-nums">
                        Joined {format(new Date(log.click_time), 'h:mm a')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border border-dark-border bg-dark-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-text-muted" />
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Task discussion calls</h3>
            </div>
            {!data?.task_calls.length ? (
              <p className="text-sm text-text-muted">No task calls for this day.</p>
            ) : (
              data.task_calls.map((log) => (
                <div key={log.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-dark-border last:border-0 text-sm">
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-text-primary">{log.task_title || `Task #${log.task_id}`}</p>
                    <p className="text-text-muted text-xs">{userName(log.user)} · {format(new Date(log.click_time), 'h:mm a')}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                    onClick={() => window.open(meetUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Join
                  </Button>
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </div>
  );
}
