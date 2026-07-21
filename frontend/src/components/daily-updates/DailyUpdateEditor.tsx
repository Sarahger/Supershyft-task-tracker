import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Avatar } from '../ui/Avatar';
import {
  matchMentionUsers,
  mentionDisplayName,
  mentionToken,
  type MentionUser,
} from '../../lib/mentions';

interface DailyUpdateEditorProps {
  value: string;
  onChange: (value: string) => void;
  users: MentionUser[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function applyListContinue(value: string, selectionStart: number): { next: string; cursor: number } | null {
  const before = value.slice(0, selectionStart);
  const lineStart = before.lastIndexOf('\n') + 1;
  const currentLine = before.slice(lineStart);
  const bullet = currentLine.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
  if (!bullet) return null;
  const [, indent, marker, rest] = bullet;
  if (!rest.trim()) {
    // Empty bullet → outdent / remove
    const after = value.slice(selectionStart);
    const next = value.slice(0, lineStart) + after;
    return { next, cursor: lineStart };
  }
  let nextMarker = marker;
  if (/^\d+\.$/.test(marker)) {
    nextMarker = `${Number(marker.slice(0, -1)) + 1}.`;
  }
  const insert = `\n${indent}${nextMarker} `;
  const next = value.slice(0, selectionStart) + insert + value.slice(selectionStart);
  return { next, cursor: selectionStart + insert.length };
}

function applyIndent(value: string, start: number, end: number, reverse: boolean) {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const block = value.slice(lineStart, end);
  const lines = block.split('\n');
  const nextLines = lines.map((line) => {
    if (reverse) {
      if (line.startsWith('  ')) return line.slice(2);
      if (line.startsWith('\t')) return line.slice(1);
      return line;
    }
    return line.length ? `  ${line}` : line;
  });
  const joined = nextLines.join('\n');
  const next = value.slice(0, lineStart) + joined + value.slice(end);
  return {
    next,
    start: lineStart,
    end: lineStart + joined.length,
  };
}

export function DailyUpdateEditor({
  value,
  onChange,
  users,
  disabled,
  placeholder = 'What did you get done today? Use @name to mention someone…',
  className,
}: DailyUpdateEditorProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);

  const mentionQuery = useMemo(() => {
    const before = value.slice(0, cursor);
    const match = before.match(/@([\w\s]*)$/);
    return match ? match[1] : null;
  }, [value, cursor]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return matchMentionUsers(users, mentionQuery).slice(0, 8);
  }, [users, mentionQuery]);

  const showMenu = !disabled && open && mentionQuery !== null && suggestions.length > 0;

  const pickUser = (user: MentionUser) => {
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const replaced = before.replace(/@[\w\s]*$/, `${mentionToken(user)} `);
    const next = replaced + after;
    onChange(next);
    setOpen(false);
    setHighlight(0);
    const nextCursor = replaced.length;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      setCursor(nextCursor);
    });
  };

  return (
    <div className={clsx('relative', className)}>
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        rows={8}
        onChange={(e) => {
          onChange(e.target.value);
          setCursor(e.target.selectionStart);
          setOpen(true);
          setHighlight(0);
        }}
        onSelect={(e) => setCursor((e.target as HTMLTextAreaElement).selectionStart)}
        onClick={(e) => setCursor((e.target as HTMLTextAreaElement).selectionStart)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (showMenu) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((i) => Math.min(i + 1, suggestions.length - 1));
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              pickUser(suggestions[highlight]);
              return;
            }
            if (e.key === 'Escape') {
              setOpen(false);
              return;
            }
          }

          const el = textareaRef.current;
          if (!el || disabled) return;

          if (e.key === 'Enter' && !e.shiftKey && !showMenu) {
            const continued = applyListContinue(value, el.selectionStart);
            if (continued) {
              e.preventDefault();
              onChange(continued.next);
              requestAnimationFrame(() => {
                el.setSelectionRange(continued.cursor, continued.cursor);
                setCursor(continued.cursor);
              });
              return;
            }
          }

          if (e.key === 'Tab') {
            e.preventDefault();
            const result = applyIndent(value, el.selectionStart, el.selectionEnd, e.shiftKey);
            onChange(result.next);
            requestAnimationFrame(() => {
              el.setSelectionRange(result.start, result.end);
              setCursor(result.end);
            });
            return;
          }

          // Cmd/Ctrl + B → wrap selection in **
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const selected = value.slice(start, end) || 'bold';
            const next = `${value.slice(0, start)}**${selected}**${value.slice(end)}`;
            onChange(next);
            requestAnimationFrame(() => {
              el.setSelectionRange(start + 2, start + 2 + selected.length);
            });
            return;
          }

          // Cmd/Ctrl + Shift + 8 → insert bullet
          if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '8') {
            e.preventDefault();
            const start = el.selectionStart;
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const next = `${value.slice(0, lineStart)}- ${value.slice(lineStart)}`;
            onChange(next);
            requestAnimationFrame(() => {
              el.setSelectionRange(lineStart + 2, lineStart + 2);
              setCursor(lineStart + 2);
            });
          }
        }}
        className={clsx(
          'w-full resize-y min-h-[160px] bg-transparent border-0 p-0 text-[15px] leading-relaxed',
          'text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-0',
          disabled && 'opacity-70 cursor-not-allowed',
        )}
      />
      {showMenu && (
        <ul
          className="absolute z-20 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-xl dropdown-panel border border-dark-border py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((u, idx) => {
            const name = mentionDisplayName(u);
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
                  <Avatar name={name} size="sm" src={u.profile_picture} />
                  <span className="truncate">{name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!disabled && (
        <p className="mt-2 text-2xs text-text-muted">
          Shortcuts: Enter continues lists · Tab / Shift+Tab indent · ⌘/Ctrl+B bold · - or 1. for lists · | for tables · @mention
        </p>
      )}
    </div>
  );
}
