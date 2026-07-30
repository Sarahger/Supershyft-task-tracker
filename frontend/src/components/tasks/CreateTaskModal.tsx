import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Calendar, ChevronDown, Flag, CornerDownLeft, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { toast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { tasksApi, projectsApi, usersApi } from '../../services/endpoints';
import {
  matchMentionUsers,
  mentionDisplayName,
  mentionToken,
  type MentionUser,
} from '../../lib/mentions';
import {
  formatDueForApi,
  getActiveDateQuery,
  matchDateSuggestions,
  nextPriority,
  parseQuickTask,
  PRIORITY_SHORT,
  type QuickPriority,
} from '../../lib/quickTaskParse';
import { format } from 'date-fns';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateTaskModal({ isOpen, onClose }: CreateTaskModalProps) {
  const { user: currentUser } = useAuth();
  const { createDefaultProjectId } = useTaskDrawer();
  const [text, setText] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [priority, setPriority] = useState<QuickPriority>('medium');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [reviewRequired, setReviewRequired] = useState(false);
  const [testingRequired, setTestingRequired] = useState(false);
  const [menuHighlight, setMenuHighlight] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ page_size: 100 }).then((r) => r.data.data.items),
    enabled: isOpen,
  });

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
    enabled: isOpen,
  });

  const mentionUsers: MentionUser[] = users ?? [];

  const parsed = useMemo(
    () => parseQuickTask(text, mentionUsers),
    [text, mentionUsers],
  );

  const assigneeUsers = useMemo(() => {
    const byId = new Map(mentionUsers.map((u) => [u.id, u]));
    if (currentUser && !byId.has(currentUser.id)) {
      byId.set(currentUser.id, currentUser);
    }
    return assigneeIds
      .map((id) => byId.get(id))
      .filter((u): u is MentionUser => Boolean(u));
  }, [assigneeIds, mentionUsers, currentUser]);

  const mentionQuery = useMemo(() => {
    const match = text.match(/@([\w\s]*)$/);
    return match ? match[1] : null;
  }, [text]);

  const dateQuery = useMemo(() => getActiveDateQuery(text), [text]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const selected = new Set(assigneeIds);
    return matchMentionUsers(mentionUsers, mentionQuery)
      .filter((u) => !selected.has(u.id))
      .slice(0, 8);
  }, [mentionUsers, mentionQuery, assigneeIds]);

  const dateSuggestions = useMemo(() => {
    if (dateQuery === null) return [];
    return matchDateSuggestions(dateQuery).slice(0, 8);
  }, [dateQuery]);

  const showingMentions = menuOpen && mentionQuery !== null && mentionSuggestions.length > 0;
  const showingDates = menuOpen && dateQuery !== null && !showingMentions && dateSuggestions.length > 0;
  const suggestionCount = showingMentions ? mentionSuggestions.length : showingDates ? dateSuggestions.length : 0;

  useEffect(() => {
    if (!isOpen) return;
    setText('');
    setAssigneeIds(currentUser?.id ? [currentUser.id] : []);
    setPriority('medium');
    setShowAdvanced(Boolean(createDefaultProjectId));
    setDescription('');
    setProjectId(createDefaultProjectId ? String(createDefaultProjectId) : '');
    setReviewRequired(false);
    setTestingRequired(false);
    setMenuHighlight(0);
    setMenuOpen(false);
    const t = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [isOpen, currentUser?.id, createDefaultProjectId]);

  useEffect(() => {
    setMenuHighlight(0);
  }, [mentionQuery, dateQuery]);

  // Sync @mentions from the quick-input into assignee pills (additive only).
  useEffect(() => {
    if (!parsed.assigneeIds.length) return;
    setAssigneeIds((prev) => {
      let changed = false;
      const next = [...prev];
      for (const id of parsed.assigneeIds) {
        if (!next.includes(id)) {
          next.push(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [parsed.assigneeIds]);

  const resetAndClose = () => {
    onClose();
  };

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => tasksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['project-tasks'] });
      qc.invalidateQueries({ queryKey: ['project-my-tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Task created');
      resetAndClose();
    },
    onError: () => toast.error('Failed to create task'),
  });

  const pickUser = (user: MentionUser) => {
    const token = mentionToken(user);
    setText((prev) => prev.replace(/@[\w\s]*$/, `${token} `));
    setAssigneeIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]));
    setMenuOpen(false);
    setMenuHighlight(0);
    textareaRef.current?.focus();
  };

  const removeAssignee = (userId: number) => {
    setAssigneeIds((prev) => prev.filter((id) => id !== userId));
    const user = mentionUsers.find((u) => u.id === userId)
      ?? (currentUser?.id === userId ? currentUser : undefined);
    if (!user) return;
    const token = mentionToken(user);
    setText((prev) =>
      prev
        .replace(new RegExp(`(?:^|\\s)${escapeRegExp(token)}(?=\\s|$)`, 'g'), ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
  };

  const pickDate = (token: string) => {
    setText((prev) => prev.replace(/\/[a-zA-Z0-9._-]*$/, `/${token} `));
    setMenuOpen(false);
    setMenuHighlight(0);
    textareaRef.current?.focus();
  };

  const ship = () => {
    const title = parsed.title.trim();
    if (!title) {
      toast.error('Add a task title');
      return;
    }
    mutation.mutate({
      title,
      description: description.trim() || undefined,
      priority,
      status: assigneeIds.length ? 'to_do' : 'unassigned',
      project_id: projectId ? Number(projectId) : undefined,
      due_date: parsed.dueDate ? formatDueForApi(parsed.dueDate) : undefined,
      assignee_ids: assigneeIds,
      review_required: reviewRequired,
      testing_required: testingRequired,
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showingMentions || showingDates) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMenuHighlight((i) => Math.min(i + 1, suggestionCount - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuHighlight((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (showingMentions) pickUser(mentionSuggestions[menuHighlight]);
        else pickDate(dateSuggestions[menuHighlight].token);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!mutation.isPending) ship();
    }
  };

  const dueSummary = parsed.dueLabel ?? 'no due date';

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

        <div className="pr-8 mb-5">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">
            What&apos;s the move?
          </h2>
          <p className="text-sm text-text-muted mt-1.5">
            You&apos;re assigned by default. Use @ to add others, / for dates.
          </p>
        </div>

        <div
          className={clsx(
            'rounded-2xl border bg-surface-subtle overflow-hidden transition-colors',
            'border-blue-500/40 focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/25',
          )}
        >
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setMenuOpen(true);
              }}
              onFocus={() => setMenuOpen(true)}
              onBlur={() => window.setTimeout(() => setMenuOpen(false), 150)}
              onKeyDown={onKeyDown}
              placeholder="ship the landing page @name /friday"
              rows={3}
              className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-base text-text-primary placeholder:text-text-muted focus:outline-none"
            />

            {showingMentions && (
              <ul className="absolute z-20 left-3 right-3 top-full mt-1 max-h-48 overflow-y-auto rounded-xl dropdown-panel border border-dark-border py-1 shadow-lg">
                {mentionSuggestions.map((u, idx) => {
                  const name = mentionDisplayName(u);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickUser(u)}
                        className={clsx(
                          'w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors',
                          idx === menuHighlight
                            ? 'bg-dark-hover text-text-primary'
                            : 'text-text-secondary hover:bg-dark-hover',
                        )}
                      >
                        <Avatar name={name} src={u.profile_picture} size="sm" />
                        <span className="truncate">{name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {showingDates && (
              <ul className="absolute z-20 left-3 right-3 top-full mt-1 max-h-48 overflow-y-auto rounded-xl dropdown-panel border border-dark-border py-1 shadow-lg">
                {dateSuggestions.map((s, idx) => (
                  <li key={s.token}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickDate(s.token)}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors',
                        idx === menuHighlight
                          ? 'bg-dark-hover text-text-primary'
                          : 'text-text-secondary hover:bg-dark-hover',
                      )}
                    >
                      <Calendar className="h-3.5 w-3.5 text-text-muted shrink-0" />
                      <span>/{s.token}</span>
                      <span className="text-text-muted ml-auto text-xs">{s.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2 px-4 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPriority((p) => nextPriority(p))}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors',
                  priority === 'low' && 'border-sky-500/30 bg-sky-500/10 text-sky-300',
                  priority === 'medium' && 'border-amber-500/35 bg-amber-500/10 text-amber-300',
                  priority === 'high' && 'border-orange-500/35 bg-orange-500/10 text-orange-300',
                  priority === 'critical' && 'border-red-500/35 bg-red-500/10 text-red-300',
                )}
                title="Click to change priority"
              >
                <Flag className="h-3 w-3" />
                {PRIORITY_SHORT[priority]}
              </button>

              <span className="text-xs text-text-muted truncate">{dueSummary}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-h-[1.75rem]">
              {assigneeUsers.length ? (
                assigneeUsers.map((u) => {
                  const name = mentionDisplayName(u);
                  return (
                    <span
                      key={u.id}
                      className="chip badge-todo inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 border border-dark-border"
                    >
                      <Avatar name={name} src={u.profile_picture} size="sm" />
                      <span className="text-xs text-text-primary max-w-[7rem] truncate">{name}</span>
                      <button
                        type="button"
                        onClick={() => removeAssignee(u.id)}
                        className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-surface-active transition-colors"
                        aria-label={`Remove ${name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-text-muted">No assignees — type @ to add</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-dark-border/80">
            <p className="text-2xs text-text-muted">tips: @ to assign · / for date</p>
            <Button
              type="button"
              onClick={ship}
              loading={mutation.isPending}
              disabled={!parsed.title.trim()}
              className="gap-2 rounded-xl bg-[var(--accent-primary)] hover:opacity-90 border-transparent text-white"
            >
              Ship it
              <CornerDownLeft className="h-3.5 w-3.5 opacity-80" />
            </Button>
          </div>
        </div>

        {parsed.title && (
          <div className="mt-4 rounded-xl border border-dark-border bg-dark-card px-4 py-3">
            <p className="text-2xs uppercase tracking-wider text-text-muted mb-1.5">Preview</p>
            <p className="text-sm font-medium text-text-primary">{parsed.title}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-text-muted">
              {assigneeUsers[0] && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar
                    name={mentionDisplayName(assigneeUsers[0])}
                    src={assigneeUsers[0].profile_picture}
                    size="sm"
                  />
                  {assigneeUsers.map((u) => u.first_name).join(', ')}
                </span>
              )}
              {parsed.dueLabel && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {parsed.dueLabel}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-amber-300/90">
                <Flag className="h-3.5 w-3.5" />
                {PRIORITY_SHORT[priority]}
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="mt-4 flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary"
        >
          <ChevronDown className={clsx('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
          More options
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-3 pl-3 border-l-2 border-dark-border">
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details…"
              rows={2}
            />
            {projects && (
              <Select
                label="Project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                options={[
                  { value: '', label: 'No project' },
                  ...projects.map((p: { id: number; name: string }) => ({
                    value: String(p.id),
                    label: p.name,
                  })),
                ]}
              />
            )}
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={reviewRequired}
                onChange={(e) => setReviewRequired(e.target.checked)}
                className="rounded border-dark-border"
              />
              Review required
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={testingRequired}
                onChange={(e) => setTestingRequired(e.target.checked)}
                className="rounded border-dark-border"
              />
              Testing required
            </label>
            <Input
              label="Override due date"
              type="date"
              value={parsed.dueDate ? format(parsed.dueDate, 'yyyy-MM-dd') : ''}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  setText((prev) => prev.replace(/(?:^|\s)\/[a-zA-Z0-9._-]+/g, ' ').replace(/\s+/g, ' ').trim());
                  return;
                }
                setText((prev) => {
                  const without = prev.replace(/(?:^|\s)\/[a-zA-Z0-9._-]+/g, ' ').replace(/\s+/g, ' ').trim();
                  return `${without} /${v}`.trim();
                });
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
