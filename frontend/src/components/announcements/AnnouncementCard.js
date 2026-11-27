import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ExternalLink, FileText, ThumbsUp, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from '../ui/Avatar';
import { CommentMentionText } from '../tasks/CommentMentionText';
import { announcementsApi } from '../../services/endpoints';
const TRUNCATE_AT = 180;
function isImage(att) {
    return !!att.mime_type?.startsWith('image/');
}
function AnnouncementImage({ attachment }) {
    const [src, setSrc] = useState(null);
    useEffect(() => {
        let objectUrl = null;
        let active = true;
        announcementsApi.attachmentBlob(attachment.id).then((res) => {
            if (!active)
                return;
            objectUrl = URL.createObjectURL(res.data);
            setSrc(objectUrl);
        }).catch(() => undefined);
        return () => {
            active = false;
            if (objectUrl)
                URL.revokeObjectURL(objectUrl);
        };
    }, [attachment.id]);
    if (!src) {
        return (_jsx("div", { className: "h-24 rounded-lg bg-dark-muted animate-pulse" }));
    }
    return (_jsx("img", { src: src, alt: attachment.filename || 'Photo', className: "max-h-56 w-full object-cover rounded-lg border border-dark-border" }));
}
export function AnnouncementCard({ item, onReact, onDelete, }) {
    const [expanded, setExpanded] = useState(false);
    const long = useMemo(() => item.body.length > TRUNCATE_AT || item.body.split('\n').length > 4, [item.body]);
    const authorName = `${item.author.first_name} ${item.author.last_name}`;
    const published = format(parseISO(item.created_at), 'EEE, MMM d · h:mm a');
    const files = item.attachments.filter((a) => a.attachment_type === 'file');
    const links = item.attachments.filter((a) => a.attachment_type === 'link');
    const photos = files.filter(isImage);
    const docs = files.filter((a) => !isImage(a));
    return (_jsxs("article", { className: "rounded-2xl border border-dark-border bg-dark-card px-4 py-3.5 space-y-3", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(Avatar, { name: authorName, src: item.author.profile_picture || undefined, size: "sm" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium text-text-primary", children: authorName }), _jsx("p", { className: "text-2xs text-text-muted tabular-nums", children: published })] }), item.can_delete && onDelete && (_jsx("button", { type: "button", onClick: () => onDelete(item.id), className: "p-1.5 rounded-md text-text-muted hover:text-accent-danger hover:bg-red-500/10", "aria-label": "Delete announcement", children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) }))] }), _jsxs("button", { type: "button", className: "w-full text-left", onClick: () => long && setExpanded((v) => !v), children: [_jsx("div", { className: clsx(!expanded && long && 'line-clamp-4'), children: _jsx(CommentMentionText, { content: item.body, className: "text-text-primary mt-0" }) }), long && (_jsx("p", { className: "text-2xs text-accent-primary mt-1", children: expanded ? 'Show less' : 'Read more' }))] }), (photos.length > 0 || docs.length > 0 || links.length > 0) && (_jsxs("div", { className: "space-y-2", children: [photos.length > 0 && (_jsx("div", { className: clsx('grid gap-2', photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'), children: photos.map((photo) => (_jsx(AnnouncementImage, { attachment: photo }, photo.id))) })), docs.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2", children: docs.map((doc) => (_jsxs("button", { type: "button", onClick: () => announcementsApi.downloadAttachment(doc.id, doc.filename || 'file'), className: "chip badge-neutral inline-flex items-center gap-1.5", children: [_jsx(FileText, { className: "h-3.5 w-3.5" }), _jsx("span", { className: "max-w-[10rem] truncate", children: doc.filename || 'Document' })] }, doc.id))) })), links.length > 0 && (_jsx("div", { className: "space-y-1", children: links.map((link) => (_jsxs("a", { href: link.url || '#', target: "_blank", rel: "noreferrer", className: "flex items-center gap-1.5 text-sm text-accent-primary hover:underline", children: [_jsx(ExternalLink, { className: "h-3.5 w-3.5 shrink-0" }), _jsx("span", { className: "truncate", children: link.filename || link.url })] }, link.id))) }))] })), _jsx("div", { className: "flex items-center gap-2 pt-1", children: _jsxs("button", { type: "button", onClick: () => onReact(item.id), className: clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition-colors', item.reacted
                        ? 'border-sky-400/40 bg-sky-400/10 text-sky-300'
                        : 'border-dark-border text-text-muted hover:text-text-primary hover:bg-dark-hover'), children: [_jsx(ThumbsUp, { className: "h-3.5 w-3.5" }), item.reaction_count > 0 ? item.reaction_count : 'Up'] }) })] }));
}
