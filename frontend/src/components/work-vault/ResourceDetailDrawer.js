import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Copy, Download, ExternalLink, Pencil, Trash2, Upload } from 'lucide-react';
import { Drawer } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';
import { Avatar } from '../ui/Avatar';
import { toast } from '../ui/Toast';
import { PdfViewer } from '../tasks/PdfViewer';
import { departmentsApi, usersApi, workVaultApi } from '../../services/endpoints';
import { apiErrorMessage, FILE_KIND_LABELS, formatFileSize, isPreviewable, previewMedia, uploadErrorMessage, uploaderName, validateWorkVaultFile, WORK_VAULT_ACCEPT, WORK_VAULT_API_CATEGORY, WORK_VAULT_CATEGORIES, WORK_VAULT_HTTP_METHODS, } from '../../lib/workVault';
import { ResourceIcon } from './ResourceIcon';
import { TagMentionInput } from './TagMentionInput';
export function ResourceDetailDrawer({ resource, onClose, onChanged }) {
    const qc = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [tags, setTags] = useState([]);
    const [url, setUrl] = useState('');
    const [httpMethod, setHttpMethod] = useState('GET');
    const [previewUrl, setPreviewUrl] = useState(null);
    const [textContent, setTextContent] = useState(null);
    const [previewError, setPreviewError] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: () => usersApi.list({ page_size: 100, status: 'active' }).then((r) => r.data.data.items),
        enabled: !!resource && editing,
        staleTime: 5 * 60 * 1000,
    });
    const { data: teams } = useQuery({
        queryKey: ['departments'],
        queryFn: () => departmentsApi.list().then((r) => r.data.data ?? []),
        enabled: !!resource && editing,
        staleTime: 5 * 60 * 1000,
    });
    useEffect(() => {
        if (!resource) {
            setEditing(false);
            setConfirmDelete(false);
            return;
        }
        setTitle(resource.title);
        setDescription(resource.description);
        setCategory(resource.category);
        setTags(resource.tags);
        setUrl(resource.url || '');
        setHttpMethod(resource.http_method || 'GET');
        setEditing(false);
        setConfirmDelete(false);
    }, [resource]);
    useEffect(() => {
        if (!resource || resource.resource_type !== 'file' || !isPreviewable(resource.file_kind, resource.mime_type, resource.filename)) {
            setPreviewUrl(null);
            setTextContent(null);
            setPreviewError(null);
            setPreviewLoading(false);
            return;
        }
        let active = true;
        let objectUrl = null;
        const load = async () => {
            setPreviewLoading(true);
            setPreviewError(null);
            setPreviewUrl(null);
            setTextContent(null);
            try {
                const response = await workVaultApi.fileBlob(resource.id);
                if (!active)
                    return;
                const mime = resource.mime_type || response.data.type || 'application/octet-stream';
                const blob = new Blob([response.data], { type: mime || 'application/octet-stream' });
                const media = previewMedia(resource.file_kind, mime, resource.filename);
                if (media === 'text') {
                    setTextContent(await blob.text());
                }
                else if (media === 'pdf') {
                    objectUrl = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
                    setPreviewUrl(objectUrl);
                }
                else {
                    objectUrl = window.URL.createObjectURL(blob);
                    setPreviewUrl(objectUrl);
                }
            }
            catch (err) {
                if (active)
                    setPreviewError(apiErrorMessage(err, 'Preview is unavailable.'));
            }
            finally {
                if (active)
                    setPreviewLoading(false);
            }
        };
        void load();
        return () => {
            active = false;
            if (objectUrl)
                window.URL.revokeObjectURL(objectUrl);
        };
    }, [resource]);
    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['work-vault'] });
    };
    const updateMutation = useMutation({
        mutationFn: () => workVaultApi.update(resource.id, {
            title: title.trim(),
            description: description.trim(),
            category,
            tags: tags.join(', '),
            ...(resource?.resource_type === 'link' ? { url: url.trim() } : {}),
            ...(category === WORK_VAULT_API_CATEGORY || resource?.file_kind === 'api'
                ? { http_method: httpMethod }
                : {}),
        }),
        onSuccess: (res) => {
            invalidate();
            setEditing(false);
            toast.success('Resource updated');
            if (res.data.data)
                onChanged?.(res.data.data);
        },
        onError: (err) => toast.error(apiErrorMessage(err, 'Could not update resource')),
    });
    const deleteMutation = useMutation({
        mutationFn: () => workVaultApi.remove(resource.id),
        onSuccess: () => {
            invalidate();
            toast.success('Resource deleted');
            onClose();
        },
        onError: (err) => toast.error(apiErrorMessage(err, 'Could not delete resource')),
    });
    const replaceMutation = useMutation({
        mutationFn: (file) => {
            const reason = validateWorkVaultFile(file);
            if (reason)
                return Promise.reject(new Error(reason));
            return workVaultApi.replaceFile(resource.id, file);
        },
        onSuccess: (res) => {
            invalidate();
            toast.success('File replaced');
            if (res.data.data)
                onChanged?.(res.data.data);
        },
        onError: (err) => toast.error(uploadErrorMessage(err)),
    });
    if (!resource)
        return null;
    const name = uploaderName(resource.uploaded_by);
    const media = previewMedia(resource.file_kind, resource.mime_type, resource.filename);
    const copyLink = async () => {
        const link = `${window.location.origin}/work-vault?resource=${resource.id}`;
        try {
            await navigator.clipboard.writeText(link);
            toast.success('Link copied');
        }
        catch {
            toast.error('Could not copy link');
        }
    };
    const endpointLabel = resource.http_method && resource.url
        ? `${resource.http_method} ${resource.url}`
        : resource.url || '';
    const openExternal = async () => {
        if (!resource.url)
            return;
        if (/^https?:\/\//i.test(resource.url)) {
            window.open(resource.url, '_blank', 'noopener,noreferrer');
            return;
        }
        try {
            await navigator.clipboard.writeText(endpointLabel);
            toast.success('API path copied');
        }
        catch {
            toast.error('Could not copy API path');
        }
    };
    return (_jsx(Drawer, { isOpen: !!resource, onClose: onClose, children: _jsxs("div", { className: "p-6 space-y-5", children: [_jsxs("div", { className: "pr-8", children: [_jsxs("div", { className: "flex items-center gap-2 text-2xs text-text-muted mb-2", children: [_jsx(ResourceIcon, { kind: resource.file_kind }), _jsx("span", { children: FILE_KIND_LABELS[resource.file_kind] }), _jsx("span", { className: "chip badge-neutral", children: resource.category })] }), _jsx("h2", { className: "text-lg font-semibold text-text-primary leading-snug", children: resource.title }), _jsxs("div", { className: "mt-3 flex items-center gap-2", children: [_jsx(Avatar, { name: name, src: resource.uploaded_by.profile_picture, size: "sm" }), _jsxs("p", { className: "text-xs text-text-secondary", children: [name, _jsxs("span", { className: "text-text-muted", children: [" \u00B7 ", format(parseISO(resource.created_at), 'MMM d, yyyy')] })] })] })] }), resource.resource_type === 'file' && (_jsxs("div", { className: "rounded-lg border border-dark-border p-3", children: [previewLoading && _jsx("p", { className: "text-xs text-text-muted", children: "Loading preview\u2026" }), previewError && _jsx("p", { className: "text-sm text-red-400", children: previewError }), previewUrl && media === 'image' && (_jsx("img", { src: previewUrl, alt: resource.title, className: "max-h-[70vh] w-full object-contain rounded" })), previewUrl && media === 'pdf' && (_jsx(PdfViewer, { url: previewUrl, filename: resource.filename || resource.title, className: "min-h-[50vh]" })), previewUrl && media === 'video' && (_jsx("video", { src: previewUrl, controls: true, playsInline: true, preload: "metadata", className: "max-h-[70vh] w-full rounded bg-black", children: "Your browser cannot play this video. Download it to watch." })), textContent != null && (_jsx("pre", { className: "text-2xs text-text-secondary overflow-auto max-h-[60vh] whitespace-pre-wrap", children: textContent })), !previewLoading && !previewError && !previewUrl && textContent == null && (_jsx("p", { className: "text-xs text-text-muted", children: "Preview is not available for this file type. Download it to open." }))] })), editing ? (_jsxs("form", { className: "space-y-3", onSubmit: (e) => {
                        e.preventDefault();
                        updateMutation.mutate();
                    }, children: [_jsx(Input, { label: "Title", value: title, onChange: (e) => setTitle(e.target.value), required: true }), _jsx(Textarea, { label: "Description (optional)", value: description, onChange: (e) => setDescription(e.target.value), rows: 4 }), resource.resource_type === 'file' && resource.filename ? (_jsxs("p", { className: "text-2xs text-text-muted", children: ["Original file name stays ", _jsx("span", { className: "text-text-secondary", children: resource.filename }), " and is not renamed."] })) : null, _jsx(Select, { label: "Category", value: category, onChange: (e) => setCategory(e.target.value), options: WORK_VAULT_CATEGORIES.map((name) => ({ value: name, label: name })) }), _jsx(TagMentionInput, { value: tags, onChange: setTags, users: users ?? [], teams: teams ?? [] }), category === WORK_VAULT_API_CATEGORY || resource.file_kind === 'api' ? (_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2", children: [_jsx(Select, { label: "Choose method", value: httpMethod, onChange: (e) => setHttpMethod(e.target.value), options: WORK_VAULT_HTTP_METHODS.map((method) => ({ value: method, label: method })) }), _jsx(Input, { label: "API path", value: url, onChange: (e) => setUrl(e.target.value), placeholder: "/users or the rest of the URL" })] })) : resource.resource_type === 'link' ? (_jsx(Input, { label: "URL", value: url, onChange: (e) => setUrl(e.target.value) })) : null, _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { type: "button", variant: "secondary", onClick: () => setEditing(false), children: "Cancel" }), _jsx(Button, { type: "submit", loading: updateMutation.isPending, children: "Save" })] })] })) : (_jsxs(_Fragment, { children: [resource.description ? (_jsx("p", { className: "text-sm text-text-secondary whitespace-pre-wrap", children: resource.description })) : (_jsx("p", { className: "text-sm text-text-muted", children: "No description yet." })), resource.tags.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1", children: resource.tags.map((tag) => (_jsx("span", { className: "chip badge-neutral", children: tag }, tag))) })), _jsxs("dl", { className: "grid grid-cols-2 gap-3 text-xs", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-text-muted", children: "Type" }), _jsxs("dd", { className: "text-text-primary mt-0.5", children: [resource.file_kind === 'api'
                                                    ? endpointLabel
                                                    : resource.resource_type === 'link'
                                                        ? 'External link'
                                                        : resource.filename || 'File', resource.file_size ? ` · ${formatFileSize(resource.file_size)}` : ''] })] }), resource.resource_type === 'file' && resource.filename && resource.filename !== resource.title ? (_jsxs("div", { children: [_jsx("dt", { className: "text-text-muted", children: "File name" }), _jsx("dd", { className: "text-text-primary mt-0.5 truncate", children: resource.filename })] })) : null] })] })), _jsxs("div", { className: "flex flex-wrap gap-2", children: [resource.resource_type === 'link' ? (_jsxs(Button, { size: "sm", className: "gap-1.5", onClick: () => { void openExternal(); }, children: [_jsx(ExternalLink, { className: "h-3.5 w-3.5" }), resource.file_kind === 'api' && !/^https?:\/\//i.test(resource.url || '') ? 'Copy API' : 'Open link'] })) : (_jsxs(Button, { size: "sm", className: "gap-1.5", onClick: () => workVaultApi.download(resource.id, resource.filename || resource.title), children: [_jsx(Download, { className: "h-3.5 w-3.5" }), " Download"] })), _jsxs(Button, { size: "sm", variant: "secondary", className: "gap-1.5", onClick: copyLink, children: [_jsx(Copy, { className: "h-3.5 w-3.5" }), " Copy link"] }), resource.can_edit && !editing && (_jsxs(Button, { size: "sm", variant: "secondary", className: "gap-1.5", onClick: () => setEditing(true), children: [_jsx(Pencil, { className: "h-3.5 w-3.5" }), " Edit"] })), resource.can_edit && resource.resource_type === 'file' && (_jsxs("label", { className: "btn btn-secondary px-2.5 py-1 text-xs gap-1.5 inline-flex items-center cursor-pointer", children: [_jsx(Upload, { className: "h-3.5 w-3.5" }), replaceMutation.isPending ? 'Replacing…' : 'Replace file', _jsx("input", { type: "file", accept: WORK_VAULT_ACCEPT, className: "hidden", onChange: (e) => {
                                        const file = e.target.files?.[0];
                                        if (file)
                                            replaceMutation.mutate(file);
                                        e.target.value = '';
                                    } })] })), resource.can_delete && (confirmDelete ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { size: "sm", variant: "danger", loading: deleteMutation.isPending, onClick: () => deleteMutation.mutate(), children: "Confirm delete" }), _jsx(Button, { size: "sm", variant: "ghost", onClick: () => setConfirmDelete(false), children: "Cancel" })] })) : (_jsxs(Button, { size: "sm", variant: "ghost", className: "gap-1.5 text-red-400", onClick: () => setConfirmDelete(true), children: [_jsx(Trash2, { className: "h-3.5 w-3.5" }), " Delete"] })))] })] }) }));
}
