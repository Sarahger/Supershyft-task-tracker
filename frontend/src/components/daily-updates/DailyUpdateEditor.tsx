import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Avatar } from '../ui/Avatar';
import {
  matchMentionUsers,
  mentionDisplayName,
  mentionToken,
  type MentionUser,
} from '../../lib/mentions';
import { matchEmojis, type EmojiItem } from '../../lib/emojiShortcodes';

interface DailyUpdateEditorProps {
  value: string;
  onChange: (value: string) => void;
  users: MentionUser[];
  usersLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function getActiveMention(text: string, cursor: number): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const lineStart = before.lastIndexOf('\n') + 1;
  const lineBefore = before.slice(lineStart);
  const match = lineBefore.match(/@([\w\s]*)$/);
  if (!match) return null;
  return {
    query: match[1],
    start: lineStart + match.index!,
  };
}

/** Slack-style `:fire` — only when `:` starts a token (not `10:30`). */
function getActiveEmoji(text: string, cursor: number): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const lineStart = before.lastIndexOf('\n') + 1;
  const lineBefore = before.slice(lineStart);
  const match = lineBefore.match(/(?:^|[\s([{]):([\w+-]*)$/);
  if (!match) return null;
  const full = match[0];
  const colonOffset = full.lastIndexOf(':');
  return {
    query: match[1],
    start: lineStart + match.index! + colonOffset,
  };
}

function applyListContinue(value: string, selectionStart: number): { next: string; cursor: number } | null {
  const before = value.slice(0, selectionStart);
  const lineStart = before.lastIndexOf('\n') + 1;
  const currentLine = before.slice(lineStart);
  const bullet = currentLine.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
  if (!bullet) return null;
  const [, indent, marker, rest] = bullet;
  if (!rest.trim()) {
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
  usersLoading = false,
  disabled,
  placeholder = 'What did you get done today? Use @name or :emoji…',
  className,
}: DailyUpdateEditorProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);

  const activeMention = useMemo(() => getActiveMention(value, cursor), [value, cursor]);
  const activeEmoji = useMemo(() => {
    if (activeMention) return null;
    return getActiveEmoji(value, cursor);
  }, [value, cursor, activeMention]);

  const mentionSuggestions = useMemo(() => {
    if (!activeMention) return [];
    return matchMentionUsers(users, activeMention.query).slice(0, 8);
  }, [users, activeMention]);

  const emojiSuggestions = useMemo(() => {
    if (!activeEmoji) return [];
    return matchEmojis(activeEmoji.query, 24);
  }, [activeEmoji]);

  const showMentionMenu = !disabled && menuOpen && activeMention !== null;
  const showEmojiMenu = !disabled && menuOpen && activeEmoji !== null;
  const showMenu = showMentionMenu || showEmojiMenu;
  const canPickMention = mentionSuggestions.length > 0;
  const canPickEmoji = emojiSuggestions.length > 0;
  const canPick = showMentionMenu ? canPickMention : canPickEmoji;

  const syncCursor = (el: HTMLTextAreaElement) => {
    setCursor(el.selectionStart);
  };

  const insertAtActive = (start: number, inserted: string) => {
    const before = value.slice(0, start);
    const after = value.slice(cursor);
    const next = before + inserted + after;
    onChange(next);
    setMenuOpen(false);
    setHighlight(0);
    const nextCursor = before.length + inserted.length;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
      setCursor(nextCursor);
    });
  };

  const pickUser = (user: MentionUser) => {
    if (!activeMention) return;
    insertAtActive(activeMention.start, `${mentionToken(user)} `);
  };

  const pickEmoji = (item: EmojiItem) => {
    if (!activeEmoji) return;
    insertAtActive(activeEmoji.start, `${item.emoji} `);
  };

  const pickHighlighted = () => {
    if (showMentionMenu && canPickMention) {
      pickUser(mentionSuggestions[highlight] ?? mentionSuggestions[0]);
    } else if (showEmojiMenu && canPickEmoji) {
      pickEmoji(emojiSuggestions[highlight] ?? emojiSuggestions[0]);
    }
  };

  const optionCount = showMentionMenu ? mentionSuggestions.length : emojiSuggestions.length;

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
          syncCursor(e.target);
          setMenuOpen(true);
          setHighlight(0);
        }}
        onKeyUp={(e) => syncCursor(e.currentTarget)}
        onSelect={(e) => syncCursor(e.currentTarget)}
        onClick={(e) => syncCursor(e.currentTarget)}
        onFocus={(e) => {
          setMenuOpen(true);
          syncCursor(e.currentTarget);
        }}
        onBlur={() => {
          window.setTimeout(() => setMenuOpen(false), 180);
        }}
        onKeyDown={(e) => {
          if (showMenu && canPick) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((i) => Math.min(i + 1, optionCount - 1));
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              pickHighlighted();
              return;
            }
            if (e.key === 'Tab' && !e.shiftKey) {
              e.preventDefault();
              pickHighlighted();
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setMenuOpen(false);
              return;
            }
          }

          const el = textareaRef.current;
          if (!el || disabled) return;

          if (e.key === 'Enter' && !e.shiftKey && !(showMenu && canPick)) {
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

          if (e.key === 'Tab' && !(showMenu && canPick)) {
            e.preventDefault();
            const result = applyIndent(value, el.selectionStart, el.selectionEnd, e.shiftKey);
            onChange(result.next);
            requestAnimationFrame(() => {
              el.setSelectionRange(result.start, result.end);
              setCursor(result.end);
            });
            return;
          }

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

      {showMentionMenu && (
        <ul
          className="absolute z-50 left-0 right-0 bottom-full mb-2 max-h-56 overflow-y-auto rounded-xl dropdown-panel border border-dark-border py-1 shadow-lg bg-dark-card"
          role="listbox"
        >
          {usersLoading && (
            <li className="px-3 py-2.5 text-sm text-text-muted">Loading people…</li>
          )}
          {!usersLoading && canPickMention &&
            mentionSuggestions.map((u, idx) => {
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
                    {u.email && (
                      <span className="ml-auto text-2xs text-text-muted truncate max-w-[40%]">{u.email}</span>
                    )}
                  </button>
                </li>
              );
            })}
          {!usersLoading && !canPickMention && (
            <li className="px-3 py-2.5 text-sm text-text-muted">No matching people</li>
          )}
        </ul>
      )}

      {showEmojiMenu && (
        <div
          className="absolute z-50 left-0 right-0 bottom-full mb-2 max-h-56 overflow-y-auto rounded-xl dropdown-panel border border-dark-border p-2 shadow-lg bg-dark-card"
          role="listbox"
        >
          {canPickEmoji ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
              {emojiSuggestions.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={idx === highlight}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickEmoji(item)}
                  onMouseEnter={() => setHighlight(idx)}
                  className={clsx(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors min-h-[40px]',
                    idx === highlight ? 'bg-dark-hover text-text-primary' : 'text-text-secondary hover:bg-dark-hover',
                  )}
                >
                  <span className="text-lg leading-none w-7 text-center shrink-0">{item.emoji}</span>
                  <span className="truncate text-text-muted">:{item.id}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-2 py-2 text-sm text-text-muted">No matching emoji</p>
          )}
        </div>
      )}

      {!disabled && (
        <p className="mt-2 text-2xs text-text-muted">
          Type @ to mention · : for emoji (e.g. :fire) · Enter continues lists · Tab indents
        </p>
      )}
    </div>
  );
}
