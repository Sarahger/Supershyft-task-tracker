import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Skeleton } from '../ui/Skeleton';

GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfViewerProps {
  data: ArrayBuffer;
  className?: string;
}

export function PdfViewer({ data, className }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const canvases: HTMLCanvasElement[] = [];

    const render = async () => {
      setLoading(true);
      setError(false);
      container.innerHTML = '';

      try {
        const pdf = await getDocument({ data: data.slice(0) }).promise;
        if (cancelled) return;

        setPageCount(pdf.numPages);
        const containerWidth = container.clientWidth || window.innerWidth - 32;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;

          const page = await pdf.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min((containerWidth / baseViewport.width) * dpr, 2.5);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / dpr}px`;
          canvas.style.height = `${viewport.height / dpr}px`;
          canvas.className = 'max-w-full rounded-lg border border-dark-border bg-white shadow-sm';

          const wrapper = document.createElement('div');
          wrapper.className = 'flex justify-center mb-3 last:mb-0';
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);
          canvases.push(canvas);

          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    render();

    return () => {
      cancelled = true;
      container.innerHTML = '';
    };
  }, [data]);

  if (error) {
    return (
      <p className="text-sm text-red-400 text-center py-8">
        Could not render PDF preview on this device.
      </p>
    );
  }

  return (
    <div className={className}>
      {loading && (
        <div className="space-y-3 mb-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-[60vh] w-full" />
        </div>
      )}
      <div ref={containerRef} className="space-y-3" />
      {!loading && pageCount > 0 && (
        <p className="text-2xs text-text-muted text-center mt-3">{pageCount} page{pageCount !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}
