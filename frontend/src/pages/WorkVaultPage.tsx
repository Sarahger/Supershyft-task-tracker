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
import { FILE_KIND_LABELS, uploaderName } from '../lib/workVault';
import type { WorkVaultResource } from '../types';

export default function WorkVaultPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [fileKind, setFileKind] = useState('');
  const [uploaderId, setUploaderId] = useState('');
  const [sort, setSort] = useState('recent');
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState<WorkVaultResource | null>(null);
  const [openFolderId, setOpenFolderId] = useState<number | null>(null);

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

  const facetParams = {
    q: debounced || undefined,
    category: category || undefined,
    file_kind: fileKind || undefined,
    uploaded_by_id: uploaderId ? Number(uploaderId) : undefined,
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
    if (linkedResource) setSelected(linkedResource);
  }, [linkedResource]);

  const total = (people ?? []).reduce((sum, folder) => sum + folder.count, 0);

  const openResource = (resource: WorkVaultResource) => {
    setSelected(resource);
    setSearchParams({ resource: String(resource.id) }, { replace: true });
  };

  const closeResource = () => {
    setSelected(null);
    setSearchParams({}, { replace: true });
  };

  const categoryOptions = useMemo(
    () => (facets?.categories ?? []).filter((row) => row.count > 0 || row.value === category),
    [facets, category],
  );
  const kindOptions = useMemo(
    () => (facets?.file_kinds ?? []).filter((row) => row.count > 0 || row.value === fileKind),
    [facets, fileKind],
  );
  const uploaderOptions = facets?.uploaders ?? [];

  return (
    <div className="max-w-workspace mx-auto pb-12">
      <PageHeader
        title="Work Vault"
        subtitle="Your team's shared space for documents, designs and work resources."
        action={
          <Button size="sm" onClick={() => setShowUpload(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Upload Resource
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          className="input pl-10 py-2.5 text-sm w-full h-11"
          placeholder="Search documents, APIs, designs, reports and more..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select className="input py-1 text-xs w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categoryOptions.map((row) => (
            <option key={row.value} value={row.value}>{row.label}</option>
          ))}
        </select>
        <select className="input py-1 text-xs w-auto" value={fileKind} onChange={(e) => setFileKind(e.target.value)}>
          <option value="">All file types</option>
          {kindOptions.map((row) => (
            <option key={row.value} value={row.value}>{FILE_KIND_LABELS[row.value as keyof typeof FILE_KIND_LABELS] || row.label}</option>
          ))}
        </select>
        <select className="input py-1 text-xs w-auto" value={uploaderId} onChange={(e) => setUploaderId(e.target.value)}>
          <option value="">All people</option>
          {uploaderOptions.map((row) => (
            <option key={row.id} value={row.id}>{uploaderName(row)}</option>
          ))}
        </select>
        <select className="input py-1 text-xs w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Recently added</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title A–Z</option>
        </select>
        <span className="text-2xs text-text-muted ml-auto">{isFetching && !peopleLoading ? 'Updating…' : `${total} resources`}</span>
      </div>

      <PeopleFolders
        folders={people ?? []}
        isLoading={peopleLoading}
        emptyTitle={debounced ? 'No matching people' : 'No people folders yet'}
        openFolderId={openFolderId}
        onOpenFolder={setOpenFolderId}
        listParams={{ ...facetParams, sort }}
        onOpenResource={openResource}
      />

      <UploadResourceModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={() => { qc.invalidateQueries({ queryKey: ['work-vault'] }); }}
      />
      <ResourceDetailDrawer resource={selected} onClose={closeResource} onChanged={setSelected} />
    </div>
  );
}
