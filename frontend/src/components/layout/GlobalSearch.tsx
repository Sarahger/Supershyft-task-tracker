import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchApi } from '../../services/endpoints';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { useUserDrawer } from '../../contexts/UserDrawerContext';

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { openTask } = useTaskDrawer();
  const { openUser } = useUserDrawer();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setIsOpen(true); }
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);
  useEffect(() => { const t = setTimeout(() => setDebounced(query), 300); return () => clearTimeout(t); }, [query]);

  const { data: results } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => searchApi.search(debounced).then((r) => r.data.data),
    enabled: debounced.length >= 2,
  });

  const allResults = results
    ? [
        ...(results.tasks ?? []).map((r) => ({ ...r, type: 'task' as const })),
        ...(results.projects ?? []).map((r) => ({ ...r, type: 'project' as const })),
        ...(results.users ?? []).map((r) => ({ ...r, type: 'user' as const })),
      ]
    : [];

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="toolbar-btn hidden sm:inline-flex">
        <Search className="h-3.5 w-3.5" />
        <span>Search</span>
        <kbd className="text-2xs bg-dark-muted px-1 rounded text-text-muted ml-1">⌘K</kbd>
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
          <div className="fixed inset-0 bg-[var(--overlay-backdrop)]" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-dark-card overflow-hidden dropdown-panel">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-dark-border">
              <Search className="h-4 w-4 text-text-muted shrink-0" />
              <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks, projects, people..." className="flex-1 text-sm text-text-primary outline-none placeholder:text-text-muted bg-transparent" />
            </div>
            {allResults.length > 0 && (
              <div className="max-h-72 overflow-y-auto py-1">
                {allResults.map((r) => (
                  <button key={`${r.type}-${r.id}`} onClick={() => { setIsOpen(false); setQuery(''); r.type === 'task' ? openTask(r.id) : r.type === 'project' ? navigate(`/projects/${r.id}`) : openUser(r.id); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-dark-hover text-left transition-colors duration-hover">
                    <span className="text-2xs uppercase text-text-muted w-14 shrink-0">{r.type}</span>
                    <div className="min-w-0"><p className="text-sm text-text-primary truncate">{r.title}</p>{r.subtitle && <p className="text-2xs text-text-muted truncate">{r.subtitle}</p>}</div>
                  </button>
                ))}
              </div>
            )}
            {debounced.length >= 2 && !allResults.length && <p className="py-8 text-center text-sm text-text-muted">No results</p>}
          </div>
        </div>
      )}
    </>
  );
}
