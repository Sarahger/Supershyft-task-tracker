import { useQuery } from '@tanstack/react-query';
import { Eye, FileText } from 'lucide-react';
import clsx from 'clsx';
import api from '../../services/api';
import { canPreviewInApp } from './AttachmentPreviewModal';
import type { TaskAttachment } from '../../types';

interface AttachmentInlinePreviewProps {
  attachment: TaskAttachment;
  isSelected: boolean;
  onPreview: () => void;
}

export function AttachmentInlinePreview({ attachment, isSelected, onPreview }: AttachmentInlinePreviewProps) {
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

  return (
    <div className="mt-2">
      {isImage && previewUrl ? (
        <button
          type="button"
          onClick={onPreview}
          className={clsx(
            'block w-full overflow-hidden rounded-lg border transition-colors',
            isSelected ? 'border-sky-500/50 ring-1 ring-sky-500/30' : 'border-dark-border hover:border-sky-500/30',
          )}
        >
          <img
            src={previewUrl}
            alt={attachment.filename}
            className="w-full max-h-48 object-cover bg-dark-muted"
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={onPreview}
          className={clsx(
            'flex items-center gap-3 w-full rounded-lg border px-3 py-4 text-left transition-colors',
            isSelected ? 'border-sky-500/50 bg-sky-500/5' : 'border-dark-border bg-dark-muted/50 hover:bg-dark-hover',
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark-card border border-dark-border shrink-0">
            {isPdf ? (
              <FileText className="h-5 w-5 text-red-400" />
            ) : (
              <Eye className="h-5 w-5 text-sky-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-text-primary">
              {canPreviewInApp(attachment.mime_type) ? 'Click to preview' : 'Click to open or download'}
            </p>
            <p className="text-2xs text-text-muted mt-0.5 truncate">{attachment.filename}</p>
          </div>
        </button>
      )}
    </div>
  );
}
