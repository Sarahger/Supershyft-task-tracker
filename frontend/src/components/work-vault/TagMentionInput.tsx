import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { matchMentionUsers, mentionDisplayName, mentionToken, type MentionUser } from '../../lib/mentions';

type TeamOption = { id: number; name: string };

function teamToken(team: TeamOption) {
  return `@${team.name.trim()}`;
}

function matchTeams(teams: TeamOption[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return teams;
  return teams.filter((team) => team.name.toLowerCase().includes(q));
}

interface TagMentionInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  users: MentionUser[];
  teams: TeamOption[];
  label?: string;
  placeholder?: string;
}

export function TagMentionInput({
  value,
  onChange,
  users,
  teams,
  label = 'Tags',
  placeholder = '@shruti or @tech',
}: TagMentionInputProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const mentionQuery = useMemo(() => {
    const atMatch = input.match(/@([\w\s]*)$/);
    if (atMatch) return atMatch[1];
    if (!input.trim()) return null;
    return input.trim();
  }, [input]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const selected = new Set(value.map((tag) => tag.toLowerCase()));
    const people = matchMentionUsers(users, mentionQuery)
      .filter((user) => !selected.has(mentionToken(user).toLowerCase()))
      .slice(0, 6)
      .map((user) => ({
        key: `user-${user.id}`,
        token: mentionToken(user),
        label: mentionDisplayName(user),
        kind: 'person' as const,
      }));
    const groupOptions = matchTeams(teams, mentionQuery)
      .filter((team) => !selected.has(teamToken(team).toLowerCase()))
      .slice(0, 4)
      .map((team) => ({
        key: `team-${team.id}`,
        token: teamToken(team),
        label: team.name,
        kind: 'team' as const,
      }));
    return [...groupOptions, ...people].slice(0, 8);
  }, [users, teams, mentionQuery, value]);

  const showMenu = open && suggestions.length > 0;

  const addTag = (token: string) => {
    const next = token.trim();
    if (!next) return;
    if (!value.some((tag) => tag.toLowerCase() === next.toLowerCase())) {
      onChange([...value, next]);
    }
    setInput('');
    setOpen(false);
    setHighlight(0);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-text-secondary">{label}</label>}
      <div className="relative">
        <div className="input min-h-[42px] h-auto py-1.5 flex flex-wrap items-center gap-1.5">
          {value.map((tag) => (
            <span key={tag} className="chip badge-neutral inline-flex items-center gap-1">
              {tag}
              <button
                type="button"
                className="text-text-muted hover:text-text-primary"
                onClick={() => onChange(value.filter((item) => item !== tag))}
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
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
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !input && value.length) {
                onChange(value.slice(0, -1));
                return;
              }
              if (!showMenu) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((i) => Math.min(i + 1, suggestions.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                addTag(suggestions[highlight].token);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            placeholder={value.length ? '' : placeholder}
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-text-primary placeholder:text-text-muted"
            aria-label={label}
            aria-autocomplete="list"
            aria-expanded={showMenu}
          />
        </div>
        {showMenu && (
          <ul
            className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl dropdown-panel border border-dark-border py-1 shadow-lg"
            role="listbox"
          >
            {suggestions.map((item, idx) => (
              <li key={item.key} role="option" aria-selected={idx === highlight}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(item.token)}
                  className={clsx(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors min-h-[40px]',
                    idx === highlight ? 'bg-dark-hover text-text-primary' : 'text-text-secondary hover:bg-dark-hover',
                  )}
                >
                  {item.kind === 'person' ? <Avatar name={item.label} size="sm" /> : <span className="chip badge-neutral">Team</span>}
                  <span className="truncate">{item.token}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
