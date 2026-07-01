import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import api from '../../services/api';
import { tasksApi } from '../../services/endpoints';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import type { TaskAttachment } from '../../types';

interface AttachmentPreviewModalProps {
  attachment: TaskAttachment | null;
  onClose: () => void;
}

function isImageMime(mime?: string) {
  return !!mime && mime.startsWith('image/');
}

function isPdfMime(mime?: string) {
  return mime === 'application/pdf';
}

function isTextMime(mime?: string) {
  return !!mime && (mime.startsWith('text/') || mime === 'application/json');
}

export function canPreviewInApp(mime?: string) {
  return isImageMime(mime) || isPdfMime(mime) || isTextMime(mime);
}

export function AttachmentPreviewModal({ attachment, onClose }: AttachmentPreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!attachment) {
      setPreviewUrl(null);
      setTextContent(null);
      setError(false);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      setError(false);
      setPreviewUrl(null);
      setTextContent(null);

      try {
        const response = await api.get(`/attachments/${attachment.id}/download`, { responseType: 'blob' });
        const mime = attachment.mime_type || response.data.type || 'application/octet-stream';
        const blob = new Blob([response.data], { type: mime });

        if (!active) return;

        if (isTextMime(mime)) {
          setTextContent(await blob.text());
        } else if (canPreviewInApp(mime)) {
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
        }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (attachment) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [attachment, onClose]);

  if (!attachment) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg bg-dark-card border border-dark-border shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-dark-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-primary truncate">{attachment.filename}</h2>
            {attachment.mime_type && (
              <p className="text-2xs text-text-muted mt-0.5">{attachment.mime_type}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => tasksApi.downloadAttachment(attachment.id, attachment.filename)}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-text-muted hover:bg-dark-hover hover:text-text-primary transition-colors"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5 min-h-[240px]">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-red-400 text-center py-12">Could not load preview.</p>
          )}

          {!loading && !error && previewUrl && isImageMime(attachment.mime_type) && (
            <div className="flex items-center justify-center">
              <img
                src={previewUrl}
                alt={attachment.filename}
                className="max-h-[70vh] max-w-full rounded-lg object-contain"
              />
            </div>
          )}

          {!loading && !error && previewUrl && isPdfMime(attachment.mime_type) && (
            <iframe
              src={previewUrl}
              title={attachment.filename}
              className="w-full h-[70vh] rounded-lg border border-dark-border bg-white"
            />
          )}

          {!loading && !error && textContent !== null && (
            <pre className="max-h-[70vh] overflow-auto rounded-lg border border-dark-border bg-dark-muted p-4 text-sm text-text-secondary whitespace-pre-wrap break-words">
              {textContent}
            </pre>
          )}

          {!loading && !error && !previewUrl && textContent === null && (
            <div className="text-center py-12">
              <p className="text-sm text-text-muted mb-4">No in-app preview for this file type.</p>
              <Button
                variant="secondary"
                onClick={() => tasksApi.downloadAttachment(attachment.id, attachment.filename)}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Download file
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
