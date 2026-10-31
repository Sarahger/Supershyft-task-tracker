import clsx from 'clsx';
import { isMentionPart, splitCommentMentions } from '../../lib/mentions';

export function CommentMentionText({ content, className }: { content: string; className?: string }) {
  const parts = splitCommentMentions(content);

  return (
    <p className={clsx('text-sm text-text-secondary mt-0.5 leading-relaxed whitespace-pre-wrap break-words', className)}>
      {parts.map((part, i) =>
        isMentionPart(part) ? (
          <span key={i} className="text-accent-primary font-medium">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}
