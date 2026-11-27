import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format, parseISO } from 'date-fns';
import { ResourceIcon, resourceIconTone } from './ResourceIcon';
import { uploaderName } from '../../lib/workVault';
export function ResourceGrid({ children }) {
    return (_jsx("div", { className: "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-1.5", children: children }));
}
export function ResourceRow({ resource, onOpen, }) {
    const name = uploaderName(resource.uploaded_by);
    const date = format(parseISO(resource.created_at), 'MMM d');
    const subtitle = resource.http_method && resource.url
        ? `${resource.http_method} ${resource.url}`
        : name;
    return (_jsxs("button", { type: "button", onClick: () => onOpen(resource), title: `${resource.title} · ${subtitle} · ${date}`, className: "min-w-0 rounded-lg px-1.5 py-2.5 text-center hover:bg-dark-hover transition-colors duration-hover", children: [_jsx("div", { className: `mx-auto mb-2 h-9 w-9 rounded-md flex items-center justify-center ${resourceIconTone(resource.file_kind).well}`, children: _jsx(ResourceIcon, { kind: resource.file_kind }) }), _jsx("p", { className: "text-xs font-medium text-text-primary truncate", children: resource.title }), _jsx("p", { className: "text-2xs text-text-muted truncate mt-0.5", children: subtitle })] }));
}
export function ResourceGridSkeleton({ count = 12 }) {
    return (_jsx(ResourceGrid, { children: Array.from({ length: count }).map((_, i) => (_jsx("div", { className: "h-[88px] rounded-lg bg-dark-muted animate-pulse" }, i))) }));
}
