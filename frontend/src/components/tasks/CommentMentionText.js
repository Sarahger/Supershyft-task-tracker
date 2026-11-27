import { jsx as _jsx } from "react/jsx-runtime";
import clsx from 'clsx';
import { isMentionPart, splitCommentMentions } from '../../lib/mentions';
export function CommentMentionText({ content, className }) {
    const parts = splitCommentMentions(content);
    return (_jsx("p", { className: clsx('text-sm text-text-secondary mt-0.5 leading-relaxed whitespace-pre-wrap break-words', className), children: parts.map((part, i) => isMentionPart(part) ? (_jsx("span", { className: "text-accent-primary font-medium", children: part }, i)) : (_jsx("span", { children: part }, i))) }));
}
