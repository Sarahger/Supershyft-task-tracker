import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { Skeleton } from '../ui/Skeleton';

// Vite resolves these to hashed assets in production builds.
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Directory URL for OpenJPEG / JBIG2 wasm (must end with /).
const WASM_URL = new URL('pdfjs-dist/wasm/openjpeg.wasm', import.meta.url)
  .toString()
  .replace(/openjpeg\.wasm$/, '');

interface PdfViewerProps {
  data: ArrayBuffer;
  className?: string;
}

export function PdfViewer({ data, className }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    const render = async () => {
      setLoading(true);
      setError(false);
      setPageCount(0);
      setFallbackUrl(null);
      container.innerHTML = '';

      try {
        // Copy into a Uint8Array — pdf.js may transfer/detach the buffer.
        const bytes = new Uint8Array(data.slice(0));
        const pdf = await getDocument({
          data: bytes,
          wasmUrl: WASM_URL,
          useSystemFonts: true,
        }).promise;
        if (cancelled) return;

        setPageCount(pdf.numPages);

        const containerWidth = Math.max(
          container.clientWidth || container.parentElement?.clientWidth || 0,
          Math.min(window.innerWidth - 32, 720),
        );
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;

          const page = await pdf.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          const cssWidth = Math.min(containerWidth, baseViewport.width);
          const scale = (cssWidth / baseViewport.width) * dpr;
          const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
          canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
          canvas.className = 'max-w-full rounded-lg border border-dark-border bg-white shadow-sm';

          const wrapper = document.createElement('div');
          wrapper.className = 'flex justify-center mb-3 last:mb-0';
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);

          // pdf.js v5+/v6: prefer `canvas` (not canvasContext alone).
          await page.render({ canvas, viewport }).promise;
        }
      } catch (err) {
        console.error('PDF preview render failed', err);
        if (cancelled) return;
        // Native browser PDF viewer as fallback (works well on desktop Chrome/Edge).
        objectUrl = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
        setFallbackUrl(objectUrl);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    render();

    return () => {
      cancelled = true;
      container.innerHTML = '';
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data]);

  if (error && fallbackUrl) {
    return (
      <div className={className}>
        <iframe
          title="PDF preview"
          src={fallbackUrl}
          className="w-full h-[70vh] rounded-lg border border-dark-border bg-white"
        />
        <p className="text-2xs text-text-muted text-center mt-3">
          Showing browser PDF viewer. If this is blank, use Download.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-400 text-center py-8">
        Could not render PDF preview. Please download the file to view it.
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
      <div ref={containerRef} className="space-y-3 min-h-[2rem]" />
      {!loading && pageCount > 0 && (
        <p className="text-2xs text-text-muted text-center mt-3">
          {pageCount} page{pageCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
