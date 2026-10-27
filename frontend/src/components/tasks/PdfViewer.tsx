import { ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';

interface PdfViewerProps {
  /** Object URL (blob:) for the PDF */
  url: string;
  filename?: string;
  className?: string;
}

/**
 * Native browser PDF preview via <object>/<iframe>.
 * Avoids pdf.js worker/canvas issues that were breaking in-app previews.
 */
export function PdfViewer({ url, filename, className }: PdfViewerProps) {
  return (
    <div className={className}>
      <object
        data={url}
        type="application/pdf"
        title={filename || 'PDF preview'}
        className="w-full h-[70vh] rounded-lg border border-dark-border bg-white"
      >
        <iframe
          title={filename || 'PDF preview'}
          src={url}
          className="w-full h-[70vh] rounded-lg border border-dark-border bg-white"
        />
      </object>
      <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
        <p className="text-2xs text-text-muted text-center">
          If the preview is blank on this device, open it in a new tab.
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in new tab
        </Button>
      </div>
    </div>
  );
}
