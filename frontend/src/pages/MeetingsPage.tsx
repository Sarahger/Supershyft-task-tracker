import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  Video, Phone, Clock, Users, LogOut, ExternalLink, Shield, PhoneOff, Search,
} from 'lucide-react';
import clsx from 'clsx';
import { meetingsApi, usersApi } from '../services/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { canAccessManagerFeatures } from '../lib/roles';
import {
  endInstantCall,
  isInMorningCallWindow,
  joinMorningCall,
  openBlankMeetWindow,
  openMeetUrl,
  startInstantCall,
  statusBadgeClass,
  todayIsoDate,
  MORNING_MEET_URL,
} from '../lib/meetings';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import type { MeetingLog, User } from '../types';

function userName(user?: { first_name: string; last_name: string } | null) {
  return user ? `${user.first_name} ${user.last_name}` : 'Unknown';
}

function LogRow({ log, onLeave }: { log: MeetingLog; onLeave?: (id: number) => void }) {
  const meetUrl = log.meet_url ?? MORNING_MEET_URL;
  const joined = format(new Date(log.click_time), 'h:mm a');
  const left = log.left_at ? format(new Date(log.left_at), 'h:mm a') : null;
  return (
    <div className="flex flex-wrap items-center gap-2 py-2 border-b border-dark-border last:border-0 text-sm">
      <div className="flex-1 min-w-[200px]">
        <p className="text-text-primary font-medium">{log.log_type}</p>
        {log.task_title && <p className="text-text-muted text-xs mt-0.5">{log.task_title}</p>}
        {log.status && (
          <span className={clsx('inline-block mt-1 text-xs px-1.5 py-0.5 rounded', statusBadgeClass(log.status))}>
            {log.status}
          </span>
        )}
      </div>
      <div className="text-text-secondary tabular-nums">
        <span>Joined {joined}</span>
        {left ? <span className="text-text-muted"> · Left {left}</span> : <span className="text-text-muted"> · Still in call</span>}
      </div>
      <div className="flex gap-1.5 shrink-0">
        {log.meet_url && (
          <Button variant="secondary" size="sm" className="gap-1" onClick={() => openMeetUrl(meetUrl)}>
            <ExternalLink className="h-3.5 w-3.5" /> Join
          </Button>
        )}
        {!left && onLeave && (
          <Button variant="secondary" size="sm" className="gap-1" onClick={() => onLeave(log.id)}>
            <LogOut className="h-3.5 w-3.5" /> Left call
          </Button>
        )}
      </div>
    </div>
  );
}

function UserInvitePicker({
  users,
  selected,
  onChange,
}: {
  users: User[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.first_name.toLowerCase().includes(q)
        || u.last_name.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team members…"
          className="pl-8 text-sm"
        />
      </div>
      <div className="max-h-40 overflow-y-auto rounded-lg border border-dark-border divide-y divide-dark-border">
        {filtered.map((u) => (
          <label
            key={u.id}
            className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-dark-muted"
          >
            <input
              type="checkbox"
              checked={selected.includes(u.id)}
              onChange={() => toggle(u.id)}
              className="rounded border-dark-border"
            />
            <span className="text-text-primary">{u.first_name} {u.last_name}</span>
          </label>
        ))}
        {!filtered.length && (
          <p className="px-3 py-2 text-sm text-text-muted">No matching users</p>
        )}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-text-muted">{selected.length} member(s) selected</p>
      )}
    </div>
  );
}

export default function MeetingsPage() {
  const { user } = useAuth();
  const isManager = canAccessManagerFeatures(user);
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [inMorningWindow, setInMorningWindow] = useState(isInMorningCallWindow());
  const [inviteUserIds, setInviteUserIds] = useState<number[]>([]);

  useEffect(() => {
    const tick = () => setInMorningWindow(isInMorningCallWindow());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { data: teamUsers } = useQuery({
    queryKey: ['users-meetings-invite'],
    queryFn: () => usersApi.list({ page_size: 100, status: 'active' }).then((r) => r.data.data.items),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['meetings-day', selectedDate],
    queryFn: () => meetingsApi.getDay(selectedDate).then((r) => r.data.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['meetings-day', selectedDate] });

  const morningMutation = useMutation({
    mutationFn: (pendingWindow: Window | null) => joinMorningCall(pendingWindow),
    onSuccess: () => { invalidate(); toast.success('Opening morning call…'); },
  });

  const instantMutation = useMutation({
    mutationFn: (pendingWindow: Window | null) => startInstantCall(inviteUserIds, pendingWindow),
    onSuccess: () => {
      invalidate();
      setInviteUserIds([]);
      toast.success('Instant call started — invites sent');
    },
  });

  const endCallMutation = useMutation({
    mutationFn: (poolId: number) => endInstantCall(poolId),
    onSuccess: () => { invalidate(); toast.success('Call ended — link returned to pool'); },
  });

  const leaveMutation = useMutation({
    mutationFn: (logId: number) => meetingsApi.leave(logId),
    onSuccess: () => { invalidate(); toast.success('Departure recorded'); },
    onError: () => toast.error('Could not record departure'),
  });

  const isToday = selectedDate === todayIsoDate();
  const canJoinMorning = isToday && inMorningWindow;
  const activeInstant = data?.active_instant_call ?? null;

  const displayDate = (() => {
    try { return format(parseISO(selectedDate), 'EEEE, MMM d, yyyy'); }
    catch { return selectedDate; }
  })();

  return (
    <div className="max-w-workspace mx-auto pb-12">
      <PageHeader
        title="Meetings"
        subtitle="Daily standup, instant syncs, and task calls"
        action={
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input py-1.5 text-sm w-auto"
          />
        }
      />

      <p className="text-sm text-text-muted mb-2">{displayDate}</p>
      {isToday && (
        <p className="text-xs text-text-muted mb-4">
          {data?.pool_available_count ?? '—'} of 8 Meet links available in pool
        </p>
      )}

      {/* Call actions — morning always on top, instant directly below */}
      <div className="space-y-4 mb-8">
        <section className="rounded-xl border border-sky-500/20 bg-dark-card p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <Video className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">Daily Morning Call</h2>
              <p className="text-sm text-text-muted mt-0.5">
                Join between 9:45 AM – 11:15 AM · Click &quot;Left call&quot; when you leave
              </p>
            </div>
          </div>

          <Button
            className="w-full gap-2"
            disabled={!canJoinMorning || morningMutation.isPending}
            onClick={() => morningMutation.mutate(openBlankMeetWindow())}
          >
            <Video className="h-4 w-4" /> Join Morning Call
          </Button>
        </section>

        <section className="rounded-xl border border-dark-border bg-dark-card p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
              <Phone className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-text-primary">Instant General Call</h2>
              <p className="text-sm text-text-muted mt-0.5">
                Assigns a free link from the pool. Select teammates to notify before launching.
              </p>
            </div>
          </div>

          {!activeInstant ? (
            <>
              <UserInvitePicker
                users={(teamUsers ?? []).filter((u) => u.id !== user?.id)}
                selected={inviteUserIds}
                onChange={setInviteUserIds}
              />
              <Button
                className="w-full gap-2 mt-4"
                disabled={instantMutation.isPending}
                onClick={() => instantMutation.mutate(openBlankMeetWindow())}
              >
                <Phone className="h-4 w-4" /> Start Instant General Call
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-emerald-400">You have an active instant call running.</p>
              <Button
                variant="secondary"
                className="w-full gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                disabled={endCallMutation.isPending}
                onClick={() => endCallMutation.mutate(activeInstant.id)}
              >
                <PhoneOff className="h-4 w-4" /> End Call & Release Link
              </Button>
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={() => openMeetUrl(activeInstant.meet_url)}
              >
                <ExternalLink className="h-4 w-4" /> Rejoin Meet
              </Button>
            </div>
          )}
        </section>
      </div>

      <div className="space-y-6">
        {isManager && (
          <section className="rounded-xl border border-dark-border bg-dark-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-text-primary">Morning call attendance</h3>
            </div>
            <p className="text-xs text-text-muted mb-4">
              Full join/leave log for manual review — no automatic late marking.
            </p>
            {!data?.morning_attendance?.length ? (
              <p className="text-sm text-text-muted">No morning call attendance recorded for this day.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-dark-border">
                      <th className="pb-2 pr-4 font-medium">Member</th>
                      <th className="pb-2 pr-4 font-medium">Joined</th>
                      <th className="pb-2 font-medium">Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.morning_attendance.map((log) => (
                      <tr key={log.id} className="border-b border-dark-border last:border-0">
                        <td className="py-2.5 pr-4 text-text-primary">{userName(log.user)}</td>
                        <td className="py-2.5 pr-4 tabular-nums text-text-secondary">
                          {format(new Date(log.click_time), 'h:mm a')}
                        </td>
                        <td className="py-2.5 tabular-nums text-text-secondary">
                          {log.left_at ? format(new Date(log.left_at), 'h:mm a') : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {isLoading ? (
          <div className="h-32 rounded-xl bg-dark-muted animate-pulse" />
        ) : (
          <>
              <section className="rounded-xl border border-dark-border bg-dark-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-text-muted" />
                  <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Your activity</h3>
                </div>
                {!data?.my_logs.length ? (
                  <p className="text-sm text-text-muted">No meeting activity recorded for this day.</p>
                ) : (
                  data.my_logs.map((log) => (
                    <LogRow key={log.id} log={log} onLeave={(id) => leaveMutation.mutate(id)} />
                  ))
                )}
              </section>

              <section className="rounded-xl border border-dark-border bg-dark-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-text-muted" />
                  <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">General syncs today</h3>
                </div>
                {!data?.general_calls.length ? (
                  <p className="text-sm text-text-muted">No general calls for this day.</p>
                ) : (
                  data.general_calls.map((log) => (
                    <div key={log.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-dark-border last:border-0 text-sm">
                      <div className="flex-1">
                        <p className="text-text-primary">{userName(log.user)}</p>
                        <p className="text-text-muted text-xs">{format(new Date(log.click_time), 'h:mm a')}</p>
                      </div>
                      {log.meet_url && (
                        <Button variant="secondary" size="sm" className="gap-1" onClick={() => openMeetUrl(log.meet_url!)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Join
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </section>

              <section className="rounded-xl border border-dark-border bg-dark-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Video className="h-4 w-4 text-text-muted" />
                  <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Task discussion calls</h3>
                </div>
                {!data?.task_calls.length ? (
                  <p className="text-sm text-text-muted">No task calls for this day.</p>
                ) : (
                  data.task_calls.map((log) => (
                    <div key={log.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-dark-border last:border-0 text-sm">
                      <div className="flex-1 min-w-[180px]">
                        <p className="text-text-primary">{log.task_title || `Task #${log.task_id}`}</p>
                        <p className="text-text-muted text-xs">
                          {userName(log.user)} · {format(new Date(log.click_time), 'h:mm a')}
                          {log.status ? ` · ${log.status}` : ''}
                        </p>
                      </div>
                      {log.meet_url && (
                        <Button variant="secondary" size="sm" className="gap-1" onClick={() => openMeetUrl(log.meet_url!)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Join
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </section>
            </>
        )}
      </div>
    </div>
  );
}
