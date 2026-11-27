import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { workVaultApi } from '../services/endpoints';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { UploadResourceModal } from '../components/work-vault/UploadResourceModal';
import { ResourceDetailDrawer } from '../components/work-vault/ResourceDetailDrawer';
import { PeopleFolders } from '../components/work-vault/PeopleFolders';
import { PeriodFilter } from '../components/work-vault/PeriodFilter';
import { FILE_KIND_LABELS, periodLabel, periodRange, uploaderName } from '../lib/workVault';
export default function WorkVaultPage() {
    const qc = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [category, setCategory] = useState('');
    const [fileKind, setFileKind] = useState('');
    const [uploaderId, setUploaderId] = useState('');
    const [sort, setSort] = useState('recent');
    const [period, setPeriod] = useState('');
    const [periodValue, setPeriodValue] = useState('');
    const [showUpload, setShowUpload] = useState(false);
    const [uploadFolder, setUploadFolder] = useState(null);
    const [selected, setSelected] = useState(null);
    const [openFolderId, setOpenFolderId] = useState(null);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);
    useEffect(() => {
        setOpenFolderId(uploaderId ? Number(uploaderId) : null);
    }, [debounced, category, fileKind, uploaderId]);
    useEffect(() => {
        workVaultApi.markSeen().then(() => {
            qc.setQueryData(['work-vault', 'unread'], 0);
        }).catch(() => undefined);
    }, [qc]);
    const dateRange = periodRange(period, periodValue);
    const facetParams = {
        q: debounced || undefined,
        category: category || undefined,
        file_kind: fileKind || undefined,
        uploaded_by_id: uploaderId ? Number(uploaderId) : undefined,
        created_from: dateRange.created_from,
        created_to: dateRange.created_to,
    };
    const { data: facets } = useQuery({
        queryKey: ['work-vault', 'facets', facetParams],
        queryFn: () => workVaultApi.facets(facetParams).then((r) => r.data.data),
    });
    const { data: people, isLoading: peopleLoading, isFetching } = useQuery({
        queryKey: ['work-vault', 'people', facetParams],
        queryFn: () => workVaultApi.people(facetParams).then((r) => r.data.data.items),
    });
    const resourceId = searchParams.get('resource');
    const { data: linkedResource } = useQuery({
        queryKey: ['work-vault', 'resource', resourceId],
        queryFn: () => workVaultApi.get(Number(resourceId)).then((r) => r.data.data),
        enabled: !!resourceId && Number.isFinite(Number(resourceId)),
    });
    useEffect(() => {
        if (linkedResource)
            setSelected(linkedResource);
    }, [linkedResource]);
    const total = (people ?? []).reduce((sum, folder) => sum + folder.count, 0);
    const openResource = (resource) => {
        setSelected(resource);
        setSearchParams({ resource: String(resource.id) }, { replace: true });
    };
    const closeResource = () => {
        setSelected(null);
        setSearchParams({}, { replace: true });
    };
    const categoryOptions = useMemo(() => (facets?.categories ?? []).filter((row) => row.count > 0 || row.value === category), [facets, category]);
    const kindOptions = useMemo(() => (facets?.file_kinds ?? []).filter((row) => row.count > 0 || row.value === fileKind), [facets, fileKind]);
    const uploaderOptions = facets?.uploaders ?? [];
    return (_jsxs("div", { className: "max-w-workspace mx-auto pb-12", children: [_jsx(PageHeader, { title: "Work Vault", subtitle: "Your team's shared space for documents, designs and work resources.", action: _jsxs(Button, { size: "sm", onClick: () => { setUploadFolder(null); setShowUpload(true); }, className: "gap-1.5", children: [_jsx(Plus, { className: "h-3.5 w-3.5" }), " Upload Resource"] }) }), _jsxs("div", { className: "flex items-center justify-between gap-3 mb-3", children: [_jsxs("p", { className: "text-sm text-text-secondary min-w-0", children: [_jsx("span", { className: "text-text-muted", children: "Showing " }), _jsx("span", { className: "font-medium text-text-primary", children: periodLabel(period, periodValue) })] }), _jsx(PeriodFilter, { mode: period, value: periodValue, onChange: (nextMode, nextValue) => {
                            setPeriod(nextMode);
                            setPeriodValue(nextValue);
                        } })] }), _jsxs("div", { className: "relative mb-4", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" }), _jsx("input", { className: "input pl-10 py-2.5 text-sm w-full h-11", placeholder: "Search documents, APIs, designs, reports and more...", value: search, onChange: (e) => setSearch(e.target.value) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 mb-4", children: [_jsxs("select", { className: "input py-1 text-xs w-auto", value: category, onChange: (e) => setCategory(e.target.value), children: [_jsx("option", { value: "", children: "All categories" }), categoryOptions.map((row) => (_jsx("option", { value: row.value, children: row.label }, row.value)))] }), _jsxs("select", { className: "input py-1 text-xs w-auto", value: fileKind, onChange: (e) => setFileKind(e.target.value), children: [_jsx("option", { value: "", children: "All file types" }), kindOptions.map((row) => (_jsx("option", { value: row.value, children: FILE_KIND_LABELS[row.value] || row.label }, row.value)))] }), _jsxs("select", { className: "input py-1 text-xs w-auto", value: uploaderId, onChange: (e) => setUploaderId(e.target.value), children: [_jsx("option", { value: "", children: "All people" }), uploaderOptions.map((row) => (_jsx("option", { value: row.id, children: uploaderName(row) }, row.id)))] }), _jsxs("select", { className: "input py-1 text-xs w-auto", value: sort, onChange: (e) => setSort(e.target.value), children: [_jsx("option", { value: "recent", children: "Recently added" }), _jsx("option", { value: "oldest", children: "Oldest first" }), _jsx("option", { value: "title", children: "Title A\u2013Z" })] }), _jsx("span", { className: "text-2xs text-text-muted ml-auto", children: isFetching && !peopleLoading ? 'Updating…' : `${total} resources` })] }), _jsx(PeopleFolders, { folders: people ?? [], isLoading: peopleLoading, emptyTitle: debounced ? 'No matching people' : 'No people folders yet', openFolderId: openFolderId, onOpenFolder: setOpenFolderId, listParams: { ...facetParams, sort }, onOpenResource: openResource, onUpload: (folder) => {
                    setUploadFolder(folder ?? null);
                    setShowUpload(true);
                } }), _jsx(UploadResourceModal, { isOpen: showUpload, folder: uploadFolder, onClose: () => { setShowUpload(false); setUploadFolder(null); }, onUploaded: () => { qc.invalidateQueries({ queryKey: ['work-vault'] }); } }), _jsx(ResourceDetailDrawer, { resource: selected, onClose: closeResource, onChanged: setSelected })] }));
}
