import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
function useIsMobilePreview() {
    const [mobile, setMobile] = useState(() => typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false);
    useEffect(() => {
        const media = window.matchMedia('(max-width: 767px)');
        const onChange = () => setMobile(media.matches);
        onChange();
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);
    return mobile;
}
function MobilePdfPages({ url }) {
    const hostRef = useRef(null);
    const [status, setStatus] = useState('loading');
    useEffect(() => {
        let cancelled = false;
        const host = hostRef.current;
        const render = async () => {
            if (!host)
                return;
            host.innerHTML = '';
            setStatus('loading');
            try {
                const pdfjs = await import('pdfjs-dist');
                const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
                pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
                const bytes = await fetch(url).then((res) => res.arrayBuffer());
                const pdf = await pdfjs.getDocument({ data: bytes }).promise;
                if (cancelled)
                    return;
                const pageCount = Math.min(pdf.numPages, 20);
                for (let i = 1; i <= pageCount; i += 1) {
                    const page = await pdf.getPage(i);
                    if (cancelled)
                        return;
                    const base = page.getViewport({ scale: 1 });
                    const width = host.clientWidth || window.innerWidth - 32;
                    const viewport = page.getViewport({ scale: width / base.width });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    if (!context)
                        throw new Error('Canvas is not available');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    canvas.className = 'w-full rounded-lg border border-dark-border bg-white mb-2';
                    host.appendChild(canvas);
                    await page.render({ canvasContext: context, viewport, canvas }).promise;
                }
                if (!cancelled)
                    setStatus('ready');
            }
            catch {
                if (!cancelled)
                    setStatus('error');
            }
        };
        void render();
        return () => {
            cancelled = true;
            if (host)
                host.innerHTML = '';
        };
    }, [url]);
    return (_jsxs("div", { children: [status === 'loading' && _jsx("p", { className: "text-xs text-text-muted mb-2", children: "Loading preview\u2026" }), _jsx("div", { ref: hostRef, className: "min-h-[40vh]" }), status === 'error' && (_jsx("iframe", { title: "PDF preview", src: url, className: "w-full h-[60vh] rounded-lg border border-dark-border bg-white" }))] }));
}
export function PdfViewer({ url, filename, className }) {
    const isMobile = useIsMobilePreview();
    return (_jsxs("div", { className: className, children: [isMobile ? (_jsx(MobilePdfPages, { url: url })) : (_jsx("object", { data: url, type: "application/pdf", title: filename || 'PDF preview', className: "w-full h-[70vh] rounded-lg border border-dark-border bg-white", children: _jsx("iframe", { title: filename || 'PDF preview', src: url, className: "w-full h-[70vh] rounded-lg border border-dark-border bg-white" }) })), _jsxs("div", { className: "mt-3 flex flex-col sm:flex-row items-center justify-center gap-2", children: [_jsx("p", { className: "text-2xs text-text-muted text-center", children: "If the preview is blank on this device, open it in a new tab." }), _jsxs(Button, { type: "button", variant: "secondary", size: "sm", className: "gap-1.5 shrink-0", onClick: () => window.open(url, '_blank', 'noopener,noreferrer'), children: [_jsx(ExternalLink, { className: "h-3.5 w-3.5" }), "Open in new tab"] })] })] }));
}
