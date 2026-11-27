import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ArrowLeft, Folder, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { workVaultApi } from '../../services/endpoints';
import { EmptyState } from '../ui/Skeleton';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { toast } from '../ui/Toast';
import { ResourceGrid, ResourceGridSkeleton, ResourceRow } from './ResourceRow';
import { apiErrorMessage, uploaderName } from '../../lib/workVault';
import { useAuth } from '../../contexts/AuthContext';
const DESCRIPTION_COLLAPSE_AT = 160;
function ExpandableDescription({ text, className, clampClass = 'line-clamp-3', }) {
    const [expanded, setExpanded] = useState(false);
    const long = text.length > DESCRIPTION_COLLAPSE_AT || text.split('\n').length > 3;
    return (_jsxs("div", { className: className, children: [_jsx("p", { className: clsx('text-2xs text-text-secondary whitespace-pre-wrap break-words', !expanded && long && clampClass), children: text }), long ? (_jsx("button", { type: "button", onClick: (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpanded((v) => !v);
                }, className: "text-2xs text-accent-primary mt-0.5 hover:underline", children: expanded ? 'See less' : 'See more' })) : null] }));
}
export function PeopleFolders({ folders, isLoading, emptyTitle, openFolderId, onOpenFolder, listParams, onOpenResource, onUpload, }) {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [openTitleId, setOpenTitleId] = useState(null);
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null);
    const [folderName, setFolderName] = useState('');
    const [folderDescription, setFolderDescription] = useState('');
    const openFolder = folders.find((folder) => folder.id === openFolderId) ?? null;
    const isOwn = !!user && openFolderId === user.id;
    const { data: titleFolders, isLoading: loadingFolders } = useQuery({
        queryKey: ['work-vault', 'folders', openFolderId, listParams],
        queryFn: () => workVaultApi.folders({
            owner_id: openFolderId,
            q: listParams.q,
            category: listParams.category,
            file_kind: listParams.file_kind,
            created_from: listParams.created_from,
            created_to: listParams.created_to,
        }).then((r) => r.data.data.items),
        enabled: openFolderId != null,
    });
    const openTitle = (titleFolders ?? []).find((folder) => folder.id === openTitleId) ?? null;
    const { data, isLoading: loadingFiles } = useQuery({
        queryKey: ['work-vault', 'folder-items', openTitleId, listParams],
        queryFn: () => workVaultApi.list({
            ...listParams,
            uploaded_by_id: openFolderId,
            folder_id: openTitleId,
            sort: listParams.sort || 'recent',
            page: 1,
            page_size: 100,
        }).then((r) => r.data.data),
        enabled: openTitleId != null,
    });
    const { data: ungrouped, isLoading: loadingUngrouped } = useQuery({
        queryKey: ['work-vault', 'ungrouped', openFolderId, listParams],
        queryFn: () => workVaultApi.list({
            ...listParams,
            uploaded_by_id: openFolderId,
            folder_id: 0,
            sort: listParams.sort || 'recent',
            page: 1,
            page_size: 100,
        }).then((r) => r.data.data),
        enabled: openFolderId != null && openTitleId == null,
    });
    const resetFolderForm = () => {
        setFolderName('');
        setFolderDescription('');
        setShowNewFolder(false);
        setEditingFolder(null);
    };
    const createFolder = useMutation({
        mutationFn: () => {
            const name = folderName.trim() || 'New folder';
            return workVaultApi.createFolder(name, folderDescription.trim(), name.toLowerCase() === 'new folder');
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-vault'] });
            toast.success('Folder created');
            resetFolderForm();
        },
        onError: (err) => toast.error(apiErrorMessage(err, 'Could not create folder')),
    });
    const updateFolder = useMutation({
        mutationFn: () => workVaultApi.updateFolder(editingFolder.id, {
            name: folderName.trim(),
            description: folderDescription.trim(),
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-vault'] });
            toast.success('Folder updated');
            resetFolderForm();
        },
        onError: (err) => toast.error(apiErrorMessage(err, 'Could not update folder')),
    });
    const deleteFolder = useMutation({
        mutationFn: (id) => workVaultApi.removeFolder(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['work-vault'] });
            toast.success('Folder deleted');
        },
        onError: (err) => toast.error(apiErrorMessage(err, 'Could not delete folder')),
    });
    const openEditFolder = (folder) => {
        setEditingFolder(folder);
        setFolderName(folder.name);
        setFolderDescription(folder.description || '');
        setShowNewFolder(false);
    };
    if (isLoading) {
        return (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2", children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "h-16 rounded-lg bg-dark-muted animate-pulse" }, i))) }));
    }
    if (openFolder && openTitle) {
        return (_jsxs("div", { children: [_jsxs("button", { type: "button", onClick: () => setOpenTitleId(null), className: "flex items-center gap-2 mb-3 text-sm text-text-secondary hover:text-text-primary min-h-[40px]", children: [_jsx(ArrowLeft, { className: "h-4 w-4" }), uploaderName(openFolder)] }), _jsxs("div", { className: "flex items-start gap-3 mb-4 px-1", children: [_jsx(FolderOpen, { className: "h-6 w-6 text-text-muted shrink-0 mt-0.5" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary truncate", children: openTitle.name }), openTitle.description ? (_jsx(ExpandableDescription, { text: openTitle.description, className: "mt-0.5", clampClass: "line-clamp-4" })) : null, _jsxs("p", { className: "text-2xs text-text-muted mt-0.5", children: [openTitle.count, " ", openTitle.count === 1 ? 'item' : 'items'] })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [openTitle.can_edit && (_jsxs(Button, { size: "sm", variant: "secondary", onClick: () => openEditFolder(openTitle), className: "gap-1.5", children: [_jsx(Pencil, { className: "h-3.5 w-3.5" }), " Edit"] })), isOwn && (_jsxs(Button, { size: "sm", onClick: () => onUpload(openTitle), className: "gap-1.5", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), " Add items"] }))] })] }), loadingFiles ? (_jsx(ResourceGridSkeleton, { count: 7 })) : !(data?.items.length) ? (_jsx(EmptyState, { title: "This folder is empty", description: isOwn ? 'Upload files or links into this folder when you need them.' : 'No resources match the current filters.', action: isOwn ? (_jsxs(Button, { size: "sm", onClick: () => onUpload(openTitle), className: "gap-1.5", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), " Upload"] })) : undefined })) : (_jsx(ResourceGrid, { children: data.items.map((resource) => (_jsx(ResourceRow, { resource: resource, onOpen: onOpenResource }, resource.id))) })), _jsx(Modal, { isOpen: !!editingFolder, onClose: resetFolderForm, title: "Edit folder", size: "sm", children: _jsxs("form", { className: "space-y-4", onSubmit: (e) => {
                            e.preventDefault();
                            if (folderName.trim())
                                updateFolder.mutate();
                        }, children: [_jsx(Input, { label: "Folder title", value: folderName, onChange: (e) => setFolderName(e.target.value), placeholder: "App screens", required: true }), _jsx(Textarea, { label: "Description (optional)", value: folderDescription, onChange: (e) => setFolderDescription(e.target.value), placeholder: "What this folder contains", rows: 3 }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { type: "button", variant: "secondary", onClick: resetFolderForm, children: "Cancel" }), _jsx(Button, { type: "submit", loading: updateFolder.isPending, children: "Save" })] })] }) })] }));
    }
    if (openFolder) {
        const name = uploaderName(openFolder);
        const hasFolders = !!(titleFolders ?? []).length;
        const hasUngrouped = !!(ungrouped?.items.length);
        const loadingPerson = loadingFolders || loadingUngrouped;
        const openNewFolder = () => {
            setShowNewFolder(true);
            setEditingFolder(null);
            setFolderName('New folder');
            setFolderDescription('');
        };
        return (_jsxs("div", { children: [_jsxs("button", { type: "button", onClick: () => onOpenFolder(null), className: "flex items-center gap-2 mb-3 text-sm text-text-secondary hover:text-text-primary min-h-[40px]", children: [_jsx(ArrowLeft, { className: "h-4 w-4" }), "All people"] }), _jsxs("div", { className: "flex items-center gap-3 mb-4 px-1", children: [_jsx(FolderOpen, { className: "h-6 w-6 text-text-muted" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("h2", { className: "text-sm font-semibold text-text-primary truncate", children: name }), _jsxs("p", { className: "text-2xs text-text-muted", children: [openFolder.job_title ? `${openFolder.job_title} · ` : '', openFolder.count, " ", openFolder.count === 1 ? 'resource' : 'resources'] })] }), isOwn && (_jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsxs(Button, { size: "sm", variant: "secondary", onClick: openNewFolder, className: "gap-1.5", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), " New folder"] }), _jsxs(Button, { size: "sm", onClick: () => onUpload(), className: "gap-1.5", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), " Upload"] })] }))] }), loadingPerson ? (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2", children: Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "h-16 rounded-lg bg-dark-muted animate-pulse" }, i))) })) : !hasFolders && !hasUngrouped ? (_jsx(EmptyState, { title: "Nothing here yet", description: isOwn ? 'Upload files, or create a folder first and add items into it.' : 'This person has no resources in the selected period.', action: isOwn ? (_jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { size: "sm", variant: "secondary", onClick: openNewFolder, className: "gap-1.5", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), " New folder"] }), _jsxs(Button, { size: "sm", onClick: () => onUpload(), className: "gap-1.5", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), " Upload"] })] })) : undefined })) : (_jsxs("div", { className: "space-y-5", children: [hasFolders ? (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2", children: (titleFolders ?? []).map((folder) => (_jsxs("div", { className: "flex items-stretch rounded-lg border border-dark-border hover:bg-dark-hover", children: [_jsxs("button", { type: "button", onClick: () => setOpenTitleId(folder.id), className: "flex items-center gap-3 px-3 py-3 text-left min-w-0 flex-1", children: [_jsx(Folder, { className: "h-8 w-8 text-text-muted shrink-0" }), _jsxs("span", { className: "min-w-0", children: [_jsx("span", { className: "block text-sm font-medium text-text-primary truncate", children: folder.name }), _jsxs("span", { className: "block text-2xs text-text-muted", children: [folder.count, " ", folder.count === 1 ? 'item' : 'items'] })] })] }), _jsxs("div", { className: "flex flex-col border-l border-dark-border", children: [folder.can_edit && (_jsx("button", { type: "button", className: "px-3 flex-1 text-text-muted hover:text-text-primary", onClick: () => openEditFolder(folder), "aria-label": `Edit ${folder.name}`, children: _jsx(Pencil, { className: "h-4 w-4" }) })), folder.can_delete && (_jsx("button", { type: "button", className: "px-3 flex-1 text-text-muted hover:text-red-400", onClick: () => deleteFolder.mutate(folder.id), "aria-label": `Delete ${folder.name}`, children: _jsx(Trash2, { className: "h-4 w-4" }) }))] })] }, folder.id))) })) : null, hasUngrouped ? (_jsxs("div", { children: [_jsx("p", { className: "text-2xs font-medium text-text-muted uppercase tracking-wide mb-2 px-1", children: "Files" }), _jsx(ResourceGrid, { children: ungrouped.items.map((resource) => (_jsx(ResourceRow, { resource: resource, onOpen: onOpenResource }, resource.id))) })] })) : null] })), _jsx(Modal, { isOpen: showNewFolder || !!editingFolder, onClose: resetFolderForm, title: editingFolder ? 'Edit folder' : 'New folder', size: "sm", children: _jsxs("form", { className: "space-y-4", onSubmit: (e) => {
                            e.preventDefault();
                            if (editingFolder) {
                                if (!folderName.trim())
                                    return;
                                updateFolder.mutate();
                            }
                            else {
                                createFolder.mutate();
                            }
                        }, children: [_jsx(Input, { label: "Folder title", value: folderName, onChange: (e) => setFolderName(e.target.value), placeholder: "New folder" }), _jsx(Textarea, { label: "Description (optional)", value: folderDescription, onChange: (e) => setFolderDescription(e.target.value), placeholder: "What this folder contains", rows: 3 }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { type: "button", variant: "secondary", onClick: resetFolderForm, children: "Cancel" }), _jsx(Button, { type: "submit", loading: createFolder.isPending || updateFolder.isPending, children: editingFolder ? 'Save' : 'Create' })] })] }) })] }));
    }
    if (!folders.length) {
        return _jsx(EmptyState, { title: emptyTitle, description: "People folders appear here as the team uploads resources." });
    }
    return (_jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2", children: folders.map((folder) => {
            const name = uploaderName(folder);
            return (_jsxs("button", { type: "button", onClick: () => {
                    setOpenTitleId(null);
                    onOpenFolder(folder.id);
                }, className: "flex items-center gap-3 px-3 py-3 rounded-lg border border-dark-border hover:bg-dark-hover text-left transition-colors", children: [_jsxs("span", { className: "relative shrink-0", children: [_jsx(Folder, { className: "h-8 w-8 text-text-muted" }), folder.has_new && (_jsx("span", { className: "absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-400", "aria-label": "New uploads" }))] }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block text-sm font-medium text-text-primary truncate", children: name }), _jsxs("span", { className: "block text-2xs text-text-muted truncate", children: [folder.count, " ", folder.count === 1 ? 'resource' : 'resources', folder.job_title ? ` · ${folder.job_title}` : ''] })] })] }, folder.id));
        }) }));
}
