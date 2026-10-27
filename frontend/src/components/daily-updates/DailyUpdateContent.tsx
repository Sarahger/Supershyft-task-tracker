import { isMentionPart, splitCommentMentions } from '../../lib/mentions';

/** Lightweight markdown-ish renderer for daily updates (lists, bold, tables, mentions). */
export function DailyUpdateContent({ content }: { content: string }) {
  const blocks = content.split(/\n/);

  return (
    <div className="space-y-1 text-[15px] leading-relaxed text-text-primary">
      {blocks.map((line, i) => {
        const trimmed = line.trimEnd();
        if (!trimmed) {
          return <div key={i} className="h-2" />;
        }

        // Table row
        if (trimmed.includes('|') && trimmed.split('|').length >= 3) {
          const rawCells = trimmed.split('|').map((c) => c.trim());
          const cells = rawCells.filter((c, idx) => {
            if (idx === 0 && c === '' && trimmed.startsWith('|')) return false;
            if (idx === rawCells.length - 1 && c === '' && trimmed.endsWith('|')) return false;
            return true;
          });
          if (cells.every((c) => /^:?-+:?$/.test(c))) {
            return null;
          }
          return (
            <div key={i} className="grid gap-2 text-sm" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
              {cells.map((cell, ci) => (
                <div key={ci} className="border-b border-dark-border/60 py-1 px-1 truncate">
                  <InlineText text={cell} />
                </div>
              ))}
            </div>
          );
        }

        const bullet = trimmed.match(/^(\s*)([-*])\s+(.*)$/);
        if (bullet) {
          const indent = Math.floor(bullet[1].replace(/\t/g, '  ').length / 2);
          return (
            <div key={i} className="flex gap-2" style={{ paddingLeft: indent * 12 }}>
              <span className="text-text-muted select-none shrink-0">—</span>
              <div className="min-w-0">
                <InlineText text={bullet[3]} />
              </div>
            </div>
          );
        }

        const numbered = trimmed.match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (numbered) {
          const indent = Math.floor(numbered[1].replace(/\t/g, '  ').length / 2);
          return (
            <div key={i} className="flex gap-2" style={{ paddingLeft: indent * 12 }}>
              <span className="text-text-muted select-none shrink-0 w-4 text-right">{numbered[2]}.</span>
              <div className="min-w-0">
                <InlineText text={numbered[3]} />
              </div>
            </div>
          );
        }

        return (
          <p key={i} className="whitespace-pre-wrap break-words">
            <InlineText text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}

function InlineText({ text }: { text: string }) {
  const withBold = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {withBold.map((chunk, i) => {
        if (chunk.startsWith('**') && chunk.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-text-primary">
              <MentionBits text={chunk.slice(2, -2)} />
            </strong>
          );
        }
        return <MentionBits key={i} text={chunk} />;
      })}
    </>
  );
}

function MentionBits({ text }: { text: string }) {
  return (
    <>
      {splitCommentMentions(text).map((part, i) =>
        isMentionPart(part) ? (
          <span key={i} className="text-accent-primary font-medium">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
