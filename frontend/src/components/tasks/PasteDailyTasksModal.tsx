import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Clock, ListPlus, UserRound, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { toast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { tasksApi, usersApi } from '../../services/endpoints';
import { mentionDisplayName, type MentionUser } from '../../lib/mentions';
import {
  formatDueEodForApi,
  formatHoursLabel,
  parseDailyTaskList,
} from '../../lib/dailyTaskListParse';
import { format } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBackToQuick?: () => void;
  initialText?: string;
}

const PLACEHOLDER = `Sarah

1. Meet with harshili to discuss options - 15-20 mins
2. Blood collection partners flow - 15m
3. Doc, nutritionist screens - 1 hr
4. Diwali offer webpage design - 2 hr
5. Task tracker changes - 2hrs`;

export function PasteDailyTasksModal({ isOpen, onClose, onBackToQuick, initialText = '' }: Props) {
  const { user: currentUser } = useAuth();
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
    enabled: isOpen,
  });

  const mentionUsers: MentionUser[] = users ?? [];

  const parsed = useMemo(
    () => parseDailyTaskList(text, mentionUsers),
    [text, mentionUsers],
  );

  const owner = parsed.owner ?? currentUser ?? null;

  useEffect(() => {
    if (!isOpen) return;
    setText(initialText);
    const t = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [isOpen, initialText]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!parsed.items.length) {
        throw new Error('No tasks found in the list');
      }
      const due = formatDueEodForApi(new Date());
      const ownerId = owner?.id ?? currentUser?.id;
      if (!ownerId) throw new Error('No assignee');

      const results = [];
      for (const item of parsed.items) {
        const assigneeIds = [...new Set([ownerId, ...item.mentionedUserIds])];
        const res = await tasksApi.create({
          title: item.title,
          priority: 'medium',
          status: 'to_do',
          due_date: due,
          assignee_ids: assigneeIds,
          estimated_hours: item.estimatedHours ?? undefined,
          review_required: false,
          testing_required: false,
        });
        results.push(res.data.data);
      }
      return results;
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['project-tasks'] });
      qc.invalidateQueries({ queryKey: ['project-my-tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        created.length === 1
          ? '1 task created for today'
          : `${created.length} tasks created for today`,
      );
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : 'Failed to create tasks');
    },
  });

  const ship = () => {
    if (!parsed.items.length) {
      toast.error('Paste a numbered task list first');
      return;
    }
    mutation.mutate();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!mutation.isPending) ship();
      return;
    }
    // Extra Enter on a trailing blank line after a parsed list → create
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const el = e.currentTarget;
      const atEnd = el.selectionStart === text.length && el.selectionEnd === text.length;
      if (atEnd && parsed.items.length > 0 && /\n\s*$/.test(text)) {
        e.preventDefault();
        if (!mutation.isPending) ship();
      }
    }
  };

  const todayLabel = format(new Date(), 'EEE, MMM d');

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="relative -m-1">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-1 right-0 p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-8 mb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">
            Paste today&apos;s tasks
          </h2>
          <p className="text-sm text-text-muted mt-1.5">
            Paste your daily list. Tasks are created for <span className="text-text-secondary">{todayLabel}</span> (due EOD).
            Names in a task (e.g. harshili) are added as assignees.
          </p>
        </div>

        <div
          className={clsx(
            'rounded-2xl border bg-surface-subtle overflow-hidden transition-colors',
            'border-blue-500/40 focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/25',
          )}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={PLACEHOLDER}
            rows={10}
            className="w-full resize-y min-h-[12rem] bg-transparent px-4 pt-4 pb-3 text-sm text-text-primary placeholder:text-text-muted/70 focus:outline-none font-mono leading-relaxed"
          />
        </div>

        {parsed.items.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wider text-text-muted font-medium">
                Preview · {parsed.items.length} task{parsed.items.length === 1 ? '' : 's'}
              </p>
              {owner && (
                <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                  <UserRound className="h-3.5 w-3.5 text-text-muted" />
                  Owner: {mentionDisplayName(owner)}
                </span>
              )}
            </div>
            <ul className="max-h-52 overflow-y-auto rounded-xl border border-dark-border divide-y divide-dark-border/60">
              {parsed.items.map((item, idx) => (
                <li key={`${idx}-${item.title}`} className="px-3 py-2.5 flex items-start gap-3">
                  <span className="text-xs text-text-muted tabular-nums pt-0.5 w-4 shrink-0">
                    {idx + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text-primary leading-snug">{item.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {item.timeLabel && (
                        <span className="inline-flex items-center gap-1 text-2xs text-text-muted">
                          <Clock className="h-3 w-3" />
                          {item.timeLabel}
                          {item.estimatedHours != null && (
                            <span className="text-text-secondary">
                              ({formatHoursLabel(item.estimatedHours)})
                            </span>
                          )}
                        </span>
                      )}
                      {item.mentionedUsers.map((u) => (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-1 text-2xs text-sky-400"
                        >
                          <Avatar name={mentionDisplayName(u)} src={u.profile_picture} size="sm" />
                          +{u.first_name}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onBackToQuick && (
              <Button type="button" variant="secondary" size="sm" onClick={onBackToQuick}>
                Quick create
              </Button>
            )}
            <p className="text-2xs text-text-muted hidden sm:block">
              Ctrl/Cmd + Enter to create
            </p>
          </div>
          <Button
            type="button"
            className="gap-1.5"
            disabled={mutation.isPending || parsed.items.length === 0}
            onClick={ship}
          >
            <ListPlus className="h-4 w-4" />
            {mutation.isPending
              ? 'Creating…'
              : parsed.items.length
                ? `Create ${parsed.items.length} task${parsed.items.length === 1 ? '' : 's'}`
                : 'Create tasks'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
