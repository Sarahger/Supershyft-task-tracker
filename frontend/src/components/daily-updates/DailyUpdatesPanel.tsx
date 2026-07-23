import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isValid, parseISO } from 'date-fns';
import { Link2, Save } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { dailyUpdatesApi, tasksApi, usersApi } from '../../services/endpoints';
import { useAuth } from '../../contexts/AuthContext';
import { extractMentionedUserIds } from '../../lib/mentions';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { toast } from '../ui/Toast';
import { Avatar } from '../ui/Avatar';
import { DailyUpdateCalendar } from './DailyUpdateCalendar';
import { DailyUpdateContent } from './DailyUpdateContent';
import { DailyUpdateEditor } from './DailyUpdateEditor';
import { CommentMentionText } from '../tasks/CommentMentionText';
import type { Task } from '../../types';

function parseDateParam(value: string | null): Date {
  if (!value) return new Date();
  const d = parseISO(value);
  return isValid(d) ? d : new Date();
}

export function DailyUpdatesPanel({ hideIntro = false }: { hideIntro?: boolean }) {
  const { user } = useAuth();
  const { openTask } = useTaskDrawer();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedDate = useMemo(() => parseDateParam(searchParams.get('date')), [searchParams]);
  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [filterUserId, setFilterUserId] = useState<number | ''>('');
  const [draft, setDraft] = useState('');
  const [taskIds, setTaskIds] = useState<number[]>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  const setSelectedDate = (day: Date) => {
    const next = new URLSearchParams(searchParams);
    next.set('date', format(day, 'yyyy-MM-dd'));
    setSearchParams(next, { replace: true });
    setEditing(false);
  };

  const { data: dayData, isLoading } = useQuery({
    queryKey: ['daily-updates', 'day', dateKey, filterUserId || 'all'],
    queryFn: () =>
      dailyUpdatesApi
        .getDay(dateKey, filterUserId === '' ? undefined : filterUserId)
        .then((r) => r.data.data),
  });

  const { data: calendar } = useQuery({
    queryKey: ['daily-updates', 'calendar', calendarMonth.getFullYear(), calendarMonth.getMonth() + 1],
    queryFn: () =>
      dailyUpdatesApi
        .getCalendar(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1)
        .then((r) => r.data.data),
  });

  const { data: usersList, isLoading: usersLoading, isError: usersError } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const r = await usersApi.list({ page_size: 100 });
      const items = r.data?.data?.items;
      return Array.isArray(items) ? items : [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: 'always',
  });

  const users = useMemo(
    () =>
      (usersList ?? [])
        .filter((u) => u.status !== 'inactive')
        .slice()
        .sort((a, b) =>
          `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
        ),
    [usersList],
  );

  const filterPeople = useMemo(
    () => users.filter((u) => u.id !== user?.id),
    [users, user?.id],
  );

  const { data: myTasks = [] } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => tasksApi.my().then((r) => r.data.data as Task[]),
  });

  useEffect(() => {
    if (!dayData) return;
    setDraft(dayData.own_update?.content ?? '');
    setTaskIds(dayData.own_update?.tasks.map((t) => t.id) ?? []);
    setEditing(!dayData.own_update && dayData.editable);
  }, [dayData]);

  const saveMutation = useMutation({
    mutationFn: () =>
      dailyUpdatesApi.upsert({
        update_date: dateKey,
        content: draft,
        task_ids: taskIds,
        mentioned_user_ids: extractMentionedUserIds(draft, users),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-updates'] });
      toast.success('Daily update saved');
      setEditing(false);
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string | { msg?: string }[]; message?: string } } })
        ?.response?.data;
      const msg =
        typeof detail?.detail === 'string'
          ? detail.detail
          : Array.isArray(detail?.detail)
            ? detail.detail.map((d) => (typeof d === 'string' ? d : d.msg)).filter(Boolean).join(', ')
            : detail?.message;
      toast.error(msg || 'Could not save update');
    },
  });

  const editable = !!dayData?.editable;
  const ownUpdate = dayData?.own_update;
  const showEditor = editable && (editing || !ownUpdate);

  const toggleTask = (id: number) => {
    setTaskIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const untilLabel = dayData?.editable_until
    ? format(parseISO(dayData.editable_until), "MMM d · h:mm a")
    : null;

  return (
    <section className={hideIntro ? undefined : 'mb-10'}>
      {!hideIntro && (
      <div className="mb-3 px-1">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted">Daily update</p>
        <h2 className="text-lg font-semibold text-text-primary mt-0.5">What got done</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Point-wise notes for the day. Editable until 10:30 AM the next morning.
          {untilLabel && editable ? ` Open until ${untilLabel}.` : ''}
        </p>
      </div>
      )}
      {hideIntro && untilLabel && editable && (
        <p className="text-sm text-text-muted mb-3 px-1">
          Open until {untilLabel}.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3">
          <DailyUpdateCalendar
            month={calendarMonth}
            selected={selectedDate}
            markers={calendar?.days ?? []}
            onMonthChange={setCalendarMonth}
            onSelect={setSelectedDate}
          />
          <div className="rounded-2xl border border-dark-border bg-dark-card p-3">
              <label className="block text-2xs uppercase tracking-wider text-text-muted mb-1.5">
                Filter by person
              </label>
              <select
                className="input text-sm"
                value={filterUserId === '' ? '' : String(filterUserId)}
                onChange={(e) => setFilterUserId(e.target.value ? Number(e.target.value) : '')}
                disabled={usersLoading}
              >
                <option value="">All teammates</option>
                {filterPeople.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
              {usersLoading && (
                <p className="text-2xs text-text-muted mt-1.5">Loading people…</p>
              )}
              {usersError && (
                <p className="text-2xs text-accent-danger mt-1.5">Could not load people list.</p>
              )}
              {!usersLoading && !usersError && filterPeople.length === 0 && (
                <p className="text-2xs text-text-muted mt-1.5">No other users found.</p>
              )}
            </div>
        </div>

        <div className="rounded-2xl border border-dark-border bg-dark-card p-5 sm:p-6 min-h-[280px] overflow-visible">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted">
                {format(selectedDate, 'EEEE')}
              </p>
              <h3 className="text-base font-semibold text-text-primary mt-0.5">
                {format(selectedDate, 'MMMM d, yyyy')}
              </h3>
            </div>
            {editable && ownUpdate && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-sm text-accent-primary hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : (
            <>
              {showEditor ? (
                <div className="space-y-4">
                  <DailyUpdateEditor
                    value={draft}
                    onChange={setDraft}
                    users={users}
                    usersLoading={usersLoading}
                  />

                  <div>
                    <p className="text-2xs uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
                      <Link2 className="h-3 w-3" /> Related tasks (optional)
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {myTasks.slice(0, 40).map((t) => {
                        const on = taskIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTask(t.id)}
                            className={
                              on
                                ? 'chip border border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
                                : 'chip border border-dark-border text-text-muted hover:text-text-secondary'
                            }
                          >
                            {t.title}
                          </button>
                        );
                      })}
                      {!myTasks.length && (
                        <span className="text-xs text-text-muted">No tasks assigned to link.</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={saveMutation.isPending || !draft.trim()}
                      onClick={() => saveMutation.mutate()}
                      className="btn-primary inline-flex items-center gap-1.5 text-sm px-3 py-2"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saveMutation.isPending ? 'Saving…' : 'Save update'}
                    </button>
                    {ownUpdate && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(ownUpdate.content);
                          setTaskIds(ownUpdate.tasks.map((t) => t.id));
                          setEditing(false);
                        }}
                        className="text-sm text-text-muted hover:text-text-secondary"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ) : ownUpdate ? (
                <div className="space-y-4">
                  <DailyUpdateContent content={ownUpdate.content} />
                  {ownUpdate.tasks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ownUpdate.tasks.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => openTask(t.id)}
                          className="chip border border-dark-border text-text-secondary hover:text-text-primary"
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  {editable
                    ? 'No update yet — start writing above.'
                    : 'No update for this day. Updates can only be written during that day until 10:30 AM the next morning.'}
                </p>
              )}

              {(dayData?.mentioned_lines.length ?? 0) > 0 && (
                <div className="mt-8 pt-5 border-t border-dark-border">
                  <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted mb-3">
                    Mentions in your notes
                  </p>
                  <ul className="space-y-3">
                    {dayData!.mentioned_lines.map((line) => (
                      <li key={line.id} className="rounded-xl bg-surface-subtle/60 px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar
                            name={`${line.author.first_name} ${line.author.last_name}`}
                            size="sm"
                            src={line.author.profile_picture ?? undefined}
                          />
                          <span className="text-xs text-text-muted">
                            From {line.author.first_name} {line.author.last_name}
                          </span>
                        </div>
                        <CommentMentionText content={line.line_text} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-8 pt-5 border-t border-dark-border">
                  <p className="text-2xs font-medium uppercase tracking-[0.14em] text-text-muted mb-3">
                    {filterUserId
                      ? `Update from ${dayData?.filtered_user?.first_name ?? 'teammate'} ${dayData?.filtered_user?.last_name ?? ''}`.trim()
                      : 'Team updates'}
                  </p>
                  {(dayData?.team_updates.length ?? 0) > 0 ? (
                    <div className="space-y-5">
                      {dayData!.team_updates.map((u) => (
                        <article key={u.id}>
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar
                              name={`${u.author.first_name} ${u.author.last_name}`}
                              size="sm"
                              src={u.author.profile_picture ?? undefined}
                            />
                            <p className="text-sm font-medium text-text-primary">
                              {u.author.first_name} {u.author.last_name}
                            </p>
                          </div>
                          <DailyUpdateContent content={u.content} />
                          {u.tasks.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {u.tasks.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => openTask(t.id)}
                                  className="chip border border-dark-border text-text-secondary"
                                >
                                  {t.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">
                      {filterUserId
                        ? 'No update from this person for this day yet.'
                        : 'No teammate updates for this day yet.'}
                    </p>
                  )}
                </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
