import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { isMentionPart, splitCommentMentions } from '../../lib/mentions';
/** Lightweight markdown-ish renderer for daily updates (lists, bold, tables, mentions). */
export function DailyUpdateContent({ content }) {
    const blocks = content.split(/\n/);
    return (_jsx("div", { className: "space-y-1 text-[15px] leading-relaxed text-text-primary", children: blocks.map((line, i) => {
            const trimmed = line.trimEnd();
            if (!trimmed) {
                return _jsx("div", { className: "h-2" }, i);
            }
            // Table row
            if (trimmed.includes('|') && trimmed.split('|').length >= 3) {
                const rawCells = trimmed.split('|').map((c) => c.trim());
                const cells = rawCells.filter((c, idx) => {
                    if (idx === 0 && c === '' && trimmed.startsWith('|'))
                        return false;
                    if (idx === rawCells.length - 1 && c === '' && trimmed.endsWith('|'))
                        return false;
                    return true;
                });
                if (cells.every((c) => /^:?-+:?$/.test(c))) {
                    return null;
                }
                return (_jsx("div", { className: "grid gap-2 text-sm", style: { gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }, children: cells.map((cell, ci) => (_jsx("div", { className: "border-b border-dark-border/60 py-1 px-1 truncate", children: _jsx(InlineText, { text: cell }) }, ci))) }, i));
            }
            const bullet = trimmed.match(/^(\s*)([-*])\s+(.*)$/);
            if (bullet) {
                const indent = Math.floor(bullet[1].replace(/\t/g, '  ').length / 2);
                return (_jsxs("div", { className: "flex gap-2", style: { paddingLeft: indent * 12 }, children: [_jsx("span", { className: "text-text-muted select-none shrink-0", children: "\u2014" }), _jsx("div", { className: "min-w-0", children: _jsx(InlineText, { text: bullet[3] }) })] }, i));
            }
            const numbered = trimmed.match(/^(\s*)(\d+)\.\s+(.*)$/);
            if (numbered) {
                const indent = Math.floor(numbered[1].replace(/\t/g, '  ').length / 2);
                return (_jsxs("div", { className: "flex gap-2", style: { paddingLeft: indent * 12 }, children: [_jsxs("span", { className: "text-text-muted select-none shrink-0 w-4 text-right", children: [numbered[2], "."] }), _jsx("div", { className: "min-w-0", children: _jsx(InlineText, { text: numbered[3] }) })] }, i));
            }
            return (_jsx("p", { className: "whitespace-pre-wrap break-words", children: _jsx(InlineText, { text: trimmed }) }, i));
        }) }));
}
function InlineText({ text }) {
    const withBold = text.split(/(\*\*[^*]+\*\*)/g);
    return (_jsx(_Fragment, { children: withBold.map((chunk, i) => {
            if (chunk.startsWith('**') && chunk.endsWith('**')) {
                return (_jsx("strong", { className: "font-semibold text-text-primary", children: _jsx(MentionBits, { text: chunk.slice(2, -2) }) }, i));
            }
            return _jsx(MentionBits, { text: chunk }, i);
        }) }));
}
function MentionBits({ text }) {
    return (_jsx(_Fragment, { children: splitCommentMentions(text).map((part, i) => isMentionPart(part) ? (_jsx("span", { className: "text-accent-primary font-medium", children: part }, i)) : (_jsx("span", { children: part }, i))) }));
}
