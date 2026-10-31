import { ArrowLeft, Folder, FolderOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { workVaultApi } from '../../services/endpoints';
import { EmptyState } from '../ui/Skeleton';
import { ResourceGrid, ResourceGridSkeleton, ResourceRow } from './ResourceRow';
import { uploaderName } from '../../lib/workVault';
import type { WorkVaultPersonFolder, WorkVaultResource } from '../../types';

export function PeopleFolders({
  folders,
  isLoading,
  emptyTitle,
  openFolderId,
  onOpenFolder,
  listParams,
  onOpenResource,
}: {
  folders: WorkVaultPersonFolder[];
  isLoading: boolean;
  emptyTitle: string;
  openFolderId: number | null;
  onOpenFolder: (id: number | null) => void;
  listParams: Record<string, unknown>;
  onOpenResource: (resource: WorkVaultResource) => void;
}) {
  const openFolder = folders.find((folder) => folder.id === openFolderId) ?? null;
  const { data, isLoading: loadingFiles } = useQuery({
    queryKey: ['work-vault', 'folder', openFolderId, listParams],
    queryFn: () => workVaultApi.list({
      ...listParams,
      uploaded_by_id: openFolderId,
      sort: listParams.sort || 'recent',
      page: 1,
      page_size: 50,
    }).then((r) => r.data.data),
    enabled: openFolderId != null,
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
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary truncate">{name}</h2>
            <p className="text-2xs text-text-muted">
              {openFolder.job_title ? `${openFolder.job_title} · ` : ''}
              {openFolder.count} {openFolder.count === 1 ? 'resource' : 'resources'}
            </p>
          </div>
        </div>
        {loadingFiles ? (
          <ResourceGridSkeleton count={7} />
        ) : !(data?.items.length) ? (
          <EmptyState title="This folder is empty" description="No resources match the current filters." />
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
            onClick={() => onOpenFolder(folder.id)}
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
