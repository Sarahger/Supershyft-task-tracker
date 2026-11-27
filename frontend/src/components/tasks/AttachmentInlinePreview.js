import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { Eye, FileText } from 'lucide-react';
import clsx from 'clsx';
import api from '../../services/api';
import { canPreviewInApp } from './AttachmentPreviewModal';
export function AttachmentInlinePreview({ attachment, isSelected, onPreview }) {
    const isImage = attachment.mime_type?.startsWith('image/');
    const isPdf = attachment.mime_type === 'application/pdf';
    const { data: previewUrl } = useQuery({
        queryKey: ['attachment-inline', attachment.id],
        queryFn: async () => {
            const response = await api.get(`/attachments/${attachment.id}/download`, { responseType: 'blob' });
            const mime = attachment.mime_type || response.data.type || 'application/octet-stream';
            return URL.createObjectURL(new Blob([response.data], { type: mime }));
        },
        enabled: isImage,
        staleTime: 5 * 60 * 1000,
    });
    return (_jsx("div", { className: "mt-2", children: isImage && previewUrl ? (_jsx("button", { type: "button", onClick: onPreview, className: clsx('block w-full overflow-hidden rounded-lg border transition-colors', isSelected ? 'border-sky-500/50 ring-1 ring-sky-500/30' : 'border-dark-border hover:border-sky-500/30'), children: _jsx("img", { src: previewUrl, alt: attachment.filename, className: "w-full max-h-48 object-cover bg-dark-muted" }) })) : (_jsxs("button", { type: "button", onClick: onPreview, className: clsx('flex items-center gap-3 w-full rounded-lg border px-3 py-4 text-left transition-colors', isSelected ? 'border-accent-primary/50 bg-accent-primary/5' : 'border-dark-border bg-surface-subtle hover:bg-dark-hover'), children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-lg bg-dark-card border border-dark-border shrink-0", children: isPdf ? (_jsx(FileText, { className: "h-5 w-5 text-red-400" })) : (_jsx(Eye, { className: "h-5 w-5 text-sky-400" })) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm text-text-primary", children: canPreviewInApp(attachment.mime_type) ? 'Click to preview' : 'Click to open or download' }), _jsx("p", { className: "text-2xs text-text-muted mt-0.5 truncate", children: attachment.filename })] })] })) }));
}
