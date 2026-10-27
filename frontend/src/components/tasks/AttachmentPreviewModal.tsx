import { useEffect, useState } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';
import api from '../../services/api';
import { tasksApi } from '../../services/endpoints';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { PdfViewer } from './PdfViewer';
import type { TaskAttachment } from '../../types';

interface AttachmentPreviewModalProps {
  attachment: TaskAttachment | null;
  onClose: () => void;
}

function isImageMime(mime?: string) {
  return !!mime && mime.startsWith('image/');
}

function isPdfMime(mime?: string) {
  return mime === 'application/pdf' || !!mime?.includes('pdf');
}

function isTextMime(mime?: string) {
  return !!mime && (mime.startsWith('text/') || mime === 'application/json');
}

export function canPreviewInApp(mime?: string) {
  return isImageMime(mime) || isPdfMime(mime) || isTextMime(mime);
}

async function blobLooksLikePdf(blob: Blob): Promise<boolean> {
  const header = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  // %PDF-
  return (
    header.length >= 4 &&
    header[0] === 0x25 &&
    header[1] === 0x50 &&
    header[2] === 0x44 &&
    header[3] === 0x46
  );
}

export function AttachmentPreviewModal({ attachment, onClose }: AttachmentPreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment) {
      setPreviewUrl(null);
      setTextContent(null);
      setError(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      setError(null);
      setPreviewUrl(null);
      setTextContent(null);

      try {
        const response = await api.get(`/attachments/${attachment.id}/download`, {
          responseType: 'blob',
        });
        const mime = attachment.mime_type || response.data.type || 'application/octet-stream';
        const raw = response.data as Blob;
        const blob =
          raw instanceof Blob
            ? new Blob([raw], { type: mime || raw.type || 'application/octet-stream' })
            : new Blob([raw], { type: mime });

        if (!active) return;

        if (blob.size === 0) {
          throw new Error('Downloaded file was empty.');
        }

        // Auth/API errors often come back as JSON blobs when responseType is blob.
        if (
          blob.type.includes('json') ||
          blob.type.includes('text/html') ||
          blob.type.includes('text/plain')
        ) {
          const text = await blob.text();
          let detail = text.slice(0, 200);
          try {
            const parsed = JSON.parse(text) as { detail?: string };
            if (parsed.detail) detail = parsed.detail;
          } catch {
            /* keep raw text */
          }
          throw new Error(detail || 'Server returned an error instead of the file.');
        }

        if (isTextMime(mime)) {
          setTextContent(await blob.text());
          return;
        }

        if (isPdfMime(mime) || attachment.filename?.toLowerCase().endsWith('.pdf')) {
          const isPdf = await blobLooksLikePdf(blob);
          if (!isPdf) {
            const text = await blob.text();
            let detail = 'Downloaded file is not a valid PDF.';
            try {
              const parsed = JSON.parse(text) as { detail?: string };
              if (parsed.detail) detail = parsed.detail;
            } catch {
              if (text.startsWith('{') || text.startsWith('<')) {
                detail = 'Could not download the PDF (server returned an error).';
              }
            }
            throw new Error(detail);
          }
          const pdfBlob = new Blob([blob], { type: 'application/pdf' });
          objectUrl = URL.createObjectURL(pdfBlob);
          setPreviewUrl(objectUrl);
          return;
        }

        if (isImageMime(mime)) {
          objectUrl = URL.createObjectURL(blob);
          setPreviewUrl(objectUrl);
          return;
        }
      } catch (err) {
        if (!active) return;
        // Axios 404 with blob body
        const axiosData = (err as { response?: { data?: Blob; status?: number } })?.response?.data;
        if (axiosData instanceof Blob) {
          try {
            const text = await axiosData.text();
            const parsed = JSON.parse(text) as { detail?: string };
            if (parsed.detail) {
              setError(parsed.detail);
              return;
            }
          } catch {
            /* fall through */
          }
        }
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Could not load preview.';
        setError(message);
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

  const isPdf =
    isPdfMime(attachment.mime_type) || attachment.filename?.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0 bg-[var(--overlay-backdrop)]" onClick={onClose} />
      <div className="relative w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] flex flex-col sm:rounded-lg bg-dark-card border-0 sm:border border-dark-border shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-dark-border shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-primary truncate">{attachment.filename}</h2>
            {attachment.mime_type && (
              <p className="text-2xs text-text-muted mt-0.5">{attachment.mime_type}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {previewUrl && isPdf && (
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open</span>
              </Button>
            )}
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

        <div className="flex-1 overflow-auto p-4 sm:p-5 min-h-0">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-12 space-y-4">
              <p className="text-sm text-red-400">{error}</p>
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

          {!loading && !error && previewUrl && isImageMime(attachment.mime_type) && (
            <div className="flex items-center justify-center">
              <img
                src={previewUrl}
                alt={attachment.filename}
                className="max-h-[70vh] max-w-full rounded-lg object-contain"
              />
            </div>
          )}

          {!loading && !error && previewUrl && isPdf && (
            <PdfViewer url={previewUrl} filename={attachment.filename} />
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
