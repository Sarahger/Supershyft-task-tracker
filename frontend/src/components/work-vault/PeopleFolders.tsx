import { useState } from 'react';
import { ArrowLeft, Folder, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workVaultApi } from '../../services/endpoints';
import { EmptyState } from '../ui/Skeleton';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { toast } from '../ui/Toast';
import { ResourceGrid, ResourceGridSkeleton, ResourceRow } from './ResourceRow';
import { apiErrorMessage, uploaderName } from '../../lib/workVault';
import { useAuth } from '../../contexts/AuthContext';
import type { WorkVaultPersonFolder, WorkVaultResource, WorkVaultTitleFolder } from '../../types';

export function PeopleFolders({
  folders,
  isLoading,
  emptyTitle,
  openFolderId,
  onOpenFolder,
  listParams,
  onOpenResource,
  onUpload,
}: {
  folders: WorkVaultPersonFolder[];
  isLoading: boolean;
  emptyTitle: string;
  openFolderId: number | null;
  onOpenFolder: (id: number | null) => void;
  listParams: Record<string, unknown>;
  onOpenResource: (resource: WorkVaultResource) => void;
  onUpload: (folder?: WorkVaultTitleFolder) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openTitleId, setOpenTitleId] = useState<number | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

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

  const createFolder = useMutation({
    mutationFn: () => workVaultApi.createFolder(folderName.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-vault'] });
      toast.success('Folder created');
      setFolderName('');
      setShowNewFolder(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not create folder')),
  });

  const deleteFolder = useMutation({
    mutationFn: (id: number) => workVaultApi.removeFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-vault'] });
      toast.success('Folder deleted');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not delete folder')),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-dark-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (openFolder && openTitle) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpenTitleId(null)}
          className="flex items-center gap-2 mb-3 text-sm text-text-secondary hover:text-text-primary min-h-[40px]"
        >
          <ArrowLeft className="h-4 w-4" />
          {uploaderName(openFolder)}
        </button>
        <div className="flex items-center gap-3 mb-4 px-1">
          <FolderOpen className="h-6 w-6 text-text-muted" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-text-primary truncate">{openTitle.name}</h2>
            <p className="text-2xs text-text-muted">
              {openTitle.count} {openTitle.count === 1 ? 'item' : 'items'}
            </p>
          </div>
          {isOwn && (
            <Button size="sm" onClick={() => onUpload(openTitle)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add items
            </Button>
          )}
        </div>
        {loadingFiles ? (
          <ResourceGridSkeleton count={7} />
        ) : !(data?.items.length) ? (
          <EmptyState
            title="This folder is empty"
            description={isOwn ? 'Upload files or links into this folder when you need them.' : 'No resources match the current filters.'}
            action={isOwn ? (
              <Button size="sm" onClick={() => onUpload(openTitle)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Upload
              </Button>
            ) : undefined}
          />
        ) : (
          <ResourceGrid>
            {data.items.map((resource) => (
              <ResourceRow key={resource.id} resource={resource} onOpen={onOpenResource} />
            ))}
          </ResourceGrid>
        )}
      </div>
    );
  }

  if (openFolder) {
    const name = uploaderName(openFolder);
    return (
      <div>
        <button
          type="button"
          onClick={() => onOpenFolder(null)}
          className="flex items-center gap-2 mb-3 text-sm text-text-secondary hover:text-text-primary min-h-[40px]"
        >
          <ArrowLeft className="h-4 w-4" />
          All people
        </button>
        <div className="flex items-center gap-3 mb-4 px-1">
          <FolderOpen className="h-6 w-6 text-text-muted" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-text-primary truncate">{name}</h2>
            <p className="text-2xs text-text-muted">
              {openFolder.job_title ? `${openFolder.job_title} · ` : ''}
              {openFolder.count} {openFolder.count === 1 ? 'resource' : 'resources'}
            </p>
          </div>
          {isOwn && (
            <Button size="sm" variant="secondary" onClick={() => setShowNewFolder(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New folder
            </Button>
          )}
        </div>
        {loadingFolders ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-dark-muted animate-pulse" />
            ))}
          </div>
        ) : !(titleFolders ?? []).length ? (
          <EmptyState
            title="No folders yet"
            description={isOwn ? 'Create a folder now, or upload items with one title to group them.' : 'This person has no folders in the selected period.'}
            action={isOwn ? (
              <Button size="sm" onClick={() => setShowNewFolder(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New folder
              </Button>
            ) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(titleFolders ?? []).map((folder) => (
              <div key={folder.id} className="flex items-stretch rounded-lg border border-dark-border hover:bg-dark-hover">
                <button
                  type="button"
                  onClick={() => setOpenTitleId(folder.id)}
                  className="flex items-center gap-3 px-3 py-3 text-left min-w-0 flex-1"
                >
                  <Folder className="h-8 w-8 text-text-muted shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-text-primary truncate">{folder.name}</span>
                    <span className="block text-2xs text-text-muted">
                      {folder.count} {folder.count === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                </button>
                {folder.can_delete && (
                  <button
                    type="button"
                    className="px-3 text-text-muted hover:text-red-400"
                    onClick={() => deleteFolder.mutate(folder.id)}
                    aria-label={`Delete ${folder.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <Modal isOpen={showNewFolder} onClose={() => setShowNewFolder(false)} title="New folder" size="sm">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (folderName.trim()) createFolder.mutate();
            }}
          >
            <Input
              label="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="App screens"
              required
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowNewFolder(false)}>Cancel</Button>
              <Button type="submit" loading={createFolder.isPending}>Create</Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  if (!folders.length) {
    return <EmptyState title={emptyTitle} description="People folders appear here as the team uploads resources." />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {folders.map((folder) => {
        const name = uploaderName(folder);
        return (
          <button
            key={folder.id}
            type="button"
            onClick={() => {
              setOpenTitleId(null);
              onOpenFolder(folder.id);
            }}
            className="flex items-center gap-3 px-3 py-3 rounded-lg border border-dark-border hover:bg-dark-hover text-left transition-colors"
          >
            <span className="relative shrink-0">
              <Folder className="h-8 w-8 text-text-muted" />
              {folder.has_new && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-400" aria-label="New uploads" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-text-primary truncate">{name}</span>
              <span className="block text-2xs text-text-muted truncate">
                {folder.count} {folder.count === 1 ? 'resource' : 'resources'}
                {folder.job_title ? ` · ${folder.job_title}` : ''}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
