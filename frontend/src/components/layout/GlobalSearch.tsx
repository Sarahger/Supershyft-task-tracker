import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { searchApi, usersApi } from '../../services/endpoints';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { useUserDrawer } from '../../contexts/UserDrawerContext';
import { Avatar } from '../ui/Avatar';
import {
  matchMentionUsers,
  mentionDisplayName,
  type MentionUser,
} from '../../lib/mentions';

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { openTask } = useTaskDrawer();
  const { openUser } = useUserDrawer();

  const mentionMatch = query.match(/^@([\w\s]*)$/);
  const isMentionMode = mentionMatch !== null;
  const mentionQuery = mentionMatch?.[1] ?? '';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setHighlight(0);
    } else {
      setQuery('');
      setDebounced('');
      setHighlight(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setHighlight(0);
  }, [query, isMentionMode]);

  const { data: users } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
    enabled: isOpen && isMentionMode,
    staleTime: 5 * 60 * 1000,
  });

  const mentionUsers: MentionUser[] = users ?? [];
  const mentionSuggestions = useMemo(() => {
    if (!isMentionMode) return [];
    return matchMentionUsers(mentionUsers, mentionQuery).slice(0, 8);
  }, [isMentionMode, mentionUsers, mentionQuery]);

  const { data: results } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => searchApi.search(debounced).then((r) => r.data.data),
    enabled: !isMentionMode && debounced.length >= 2,
  });

  const allResults = results
    ? [
        ...(results.tasks ?? []).map((r) => ({ ...r, type: 'task' as const })),
        ...(results.projects ?? []).map((r) => ({ ...r, type: 'project' as const })),
        ...(results.users ?? []).map((r) => ({ ...r, type: 'user' as const })),
      ]
    : [];

  const close = () => setIsOpen(false);

  const filterByAssignee = (user: MentionUser) => {
    close();
    navigate(`/?assignee=${user.id}`);
  };

  const openResult = (r: { type: 'task' | 'project' | 'user'; id: number }) => {
    close();
    if (r.type === 'task') openTask(r.id);
    else if (r.type === 'project') navigate(`/projects/${r.id}`);
    else openUser(r.id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isMentionMode && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((i) => Math.min(i + 1, mentionSuggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        filterByAssignee(mentionSuggestions[highlight]);
        return;
      }
    }

    if (!isMentionMode && allResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((i) => Math.min(i + 1, allResults.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        openResult(allResults[highlight]);
      }
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="toolbar-btn hidden sm:inline-flex">
        <Search className="h-3.5 w-3.5" />
        <span>Search</span>
        <kbd className="text-2xs bg-dark-muted px-1 rounded text-text-muted ml-1">⌘K</kbd>
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
          <div className="fixed inset-0 bg-[var(--overlay-backdrop)]" onClick={close} />
          <div className="relative w-full max-w-md rounded-2xl bg-dark-card overflow-hidden dropdown-panel">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-dark-border">
              <Search className="h-4 w-4 text-text-muted shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search… or type @name to filter by assignee"
                className="flex-1 text-sm text-text-primary outline-none placeholder:text-text-muted bg-transparent"
              />
            </div>

            {isMentionMode && (
              <div className="max-h-72 overflow-y-auto py-1">
                <p className="px-4 py-2 text-2xs uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <UserRound className="h-3 w-3" />
                  Filter tasks by assignee
                </p>
                {mentionSuggestions.length > 0 ? (
                  mentionSuggestions.map((u, idx) => {
                    const name = mentionDisplayName(u);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => filterByAssignee(u)}
                        className={clsx(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-hover',
                          idx === highlight ? 'bg-dark-hover' : 'hover:bg-dark-hover',
                        )}
                      >
                        <Avatar name={name} src={u.profile_picture} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary truncate">{name}</p>
                          {u.email && (
                            <p className="text-2xs text-text-muted truncate">{u.email}</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="py-8 text-center text-sm text-text-muted">No matching people</p>
                )}
              </div>
            )}

            {!isMentionMode && allResults.length > 0 && (
              <div className="max-h-72 overflow-y-auto py-1">
                {allResults.map((r, idx) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    type="button"
                    onClick={() => openResult(r)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-hover',
                      idx === highlight ? 'bg-dark-hover' : 'hover:bg-dark-hover',
                    )}
                  >
                    <span className="text-2xs uppercase text-text-muted w-14 shrink-0">{r.type}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">{r.title}</p>
                      {r.subtitle && (
                        <p className="text-2xs text-text-muted truncate">{r.subtitle}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isMentionMode && debounced.length >= 2 && !allResults.length && (
              <p className="py-8 text-center text-sm text-text-muted">No results</p>
            )}

            {!isMentionMode && query.length === 0 && (
              <p className="px-4 py-3 text-xs text-text-muted border-t border-dark-border">
                Tip: type <span className="text-text-secondary">@name</span> to show only that person&apos;s tasks
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
