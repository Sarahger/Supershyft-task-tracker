import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Avatar } from '../ui/Avatar';

export type AssigneeUser = { id: number; first_name: string; last_name: string };

interface AssigneeMentionInputProps {
  users: AssigneeUser[];
  onSelect: (userId: number) => void;
  className?: string;
  placeholder?: string;
}

function matchUsers(users: AssigneeUser[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return users;
  return users.filter((u) => {
    const full = `${u.first_name} ${u.last_name}`.toLowerCase();
    return (
      full.includes(q)
      || u.first_name.toLowerCase().includes(q)
      || u.last_name.toLowerCase().includes(q)
    );
  });
}

export function AssigneeMentionInput({ users, onSelect, className, placeholder = 'Type @name to add assignee…' }: AssigneeMentionInputProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const mentionQuery = useMemo(() => {
    const match = input.match(/@([\w\s]*)$/);
    return match ? match[1] : null;
  }, [input]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return matchUsers(users, mentionQuery).slice(0, 8);
  }, [users, mentionQuery]);

  const showMenu = open && mentionQuery !== null && suggestions.length > 0;

  const pickUser = (user: AssigneeUser) => {
    onSelect(user.id);
    setInput('');
    setOpen(false);
    setHighlight(0);
    inputRef.current?.focus();
  };

  return (
    <div className={clsx('relative', className)}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!showMenu) {
            if (e.key === 'Enter' && input.trim() && !input.includes('@')) {
              const match = matchUsers(users, input.trim());
              if (match.length === 1) pickUser(match[0]);
            }
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pickUser(suggestions[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="input text-sm w-full"
        aria-label="Add assignee"
        aria-autocomplete="list"
        aria-expanded={showMenu}
      />
      {showMenu && (
        <ul
          className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl dropdown-panel border border-dark-border py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((u, idx) => {
            const name = `${u.first_name} ${u.last_name}`;
            return (
              <li key={u.id} role="option" aria-selected={idx === highlight}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickUser(u)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors min-h-[44px]',
                    idx === highlight ? 'bg-dark-hover text-text-primary' : 'text-text-secondary hover:bg-dark-hover',
                  )}
                >
                  <Avatar name={name} size="sm" />
                  <span className="truncate">{name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
