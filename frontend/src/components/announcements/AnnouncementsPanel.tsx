import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { announcementsApi } from '../../services/endpoints';
import { mondayOf } from '../../lib/weeklyPlanParse';
import { EmptyState, Skeleton } from '../ui/Skeleton';
import { toast } from '../ui/Toast';
import { AnnouncementCard } from './AnnouncementCard';
import { AnnouncementComposer } from './AnnouncementComposer';

function isoMonday(day: Date = new Date()) {
  return format(mondayOf(day), 'yyyy-MM-dd');
}

export function AnnouncementsPanel() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(isoMonday());
  const [authorId, setAuthorId] = useState<number | ''>('');
  const [onDate, setOnDate] = useState('');

  const currentMonday = isoMonday();
  const weekEnd = format(addDays(parseISO(weekStart), 6), 'yyyy-MM-dd');
  const weekLabel = weekStart === currentMonday
    ? 'This week'
    : `${format(parseISO(weekStart), 'MMM d')} – ${format(parseISO(weekEnd), 'MMM d')}`;

  const params = {
    week_start: weekStart,
    ...(authorId !== '' ? { author_id: Number(authorId) } : {}),
    ...(onDate ? { on_date: onDate } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', params],
    queryFn: () => announcementsApi.list(params).then((r) => r.data.data),
  });

  useEffect(() => {
    announcementsApi.markSeen().then(() => {
      qc.setQueryData(['announcements', 'unread'], 0);
    }).catch(() => undefined);
  }, [qc]);

  const authors = data?.authors ?? [];
  const items = data?.items ?? [];
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(weekStart), i), 'yyyy-MM-dd')),
    [weekStart],
  );

  const reactMutation = useMutation({
    mutationFn: (id: number) => announcementsApi.toggleReaction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
    onError: () => toast.error('Could not save reaction'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => announcementsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement deleted');
    },
    onError: () => toast.error('Could not delete announcement'),
  });

  const shiftWeek = (days: number) => {
    const next = addDays(parseISO(weekStart), days);
    setWeekStart(isoMonday(next));
    setOnDate('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Announcements</h1>
          <p className="text-xs text-text-muted mt-0.5">This week’s posts. Older announcements stay saved but stay in their own week.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftWeek(-7)}
            className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm text-text-secondary min-w-[7.5rem] text-center">{weekLabel}</p>
          <button
            type="button"
            onClick={() => shiftWeek(7)}
            disabled={weekStart >= currentMonday}
            className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary disabled:opacity-40"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-text-secondary mb-1.5">Filter by person</span>
          <select
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value ? Number(e.target.value) : '')}
            className="input w-full text-sm"
          >
            <option value="">Everyone</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.first_name} {author.last_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-text-secondary mb-1.5">Filter by date</span>
          <select
            value={onDate}
            onChange={(e) => setOnDate(e.target.value)}
            className="input w-full text-sm"
          >
            <option value="">Whole week</option>
            {weekDates.map((day) => (
              <option key={day} value={day}>
                {format(parseISO(day), 'EEEE, MMM d')}
              </option>
            ))}
          </select>
        </label>
      </div>

      {weekStart === currentMonday && <AnnouncementComposer />}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={weekStart === currentMonday ? 'No announcements this week' : 'No announcements this week'}
          description="Posts from other weeks stay in the database and can be opened with the week arrows."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <AnnouncementCard
              key={item.id}
              item={item}
              onReact={(id) => reactMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
