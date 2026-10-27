import { useState } from 'react';
import { DailyUpdateContent } from '../daily-updates/DailyUpdateContent';
import { format, parseISO } from 'date-fns';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';

export function LegacyDailyNotes({
  notes,
}: {
  notes: { id: number; update_date: string; content: string; tasks: { id: number; title: string }[] }[];
}) {
  const [open, setOpen] = useState(false);
  const { openTask } = useTaskDrawer();
  if (!notes.length) return null;

  return (
    <section className="rounded-2xl border border-dark-border bg-dark-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <h3 className="text-sm font-medium text-text-primary">Earlier daily notes</h3>
          <p className="text-xs text-text-muted mt-0.5">{notes.length} saved day{notes.length === 1 ? '' : 's'}</p>
        </div>
        <span className="text-xs text-text-muted">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="border-t border-dark-border divide-y divide-dark-border">
          {notes.map((note) => (
            <article key={note.id} className="px-4 py-3 space-y-2">
              <p className="text-xs text-text-muted">
                {format(parseISO(note.update_date), 'EEEE, d MMM yyyy')}
              </p>
              <DailyUpdateContent content={note.content} />
              {note.tasks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {note.tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openTask(task.id)}
                      className="text-xs text-accent-primary hover:underline"
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
