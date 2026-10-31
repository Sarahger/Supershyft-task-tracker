import type { ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { ResourceIcon, resourceIconTone } from './ResourceIcon';
import { uploaderName } from '../../lib/workVault';
import type { WorkVaultResource } from '../../types';

export function ResourceGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-1.5">
      {children}
    </div>
  );
}

export function ResourceRow({
  resource,
  onOpen,
}: {
  resource: WorkVaultResource;
  onOpen: (resource: WorkVaultResource) => void;
}) {
  const name = uploaderName(resource.uploaded_by);
  const date = format(parseISO(resource.created_at), 'MMM d');
  const subtitle = resource.http_method && resource.url
    ? `${resource.http_method} ${resource.url}`
    : name;

  return (
    <button
      type="button"
      onClick={() => onOpen(resource)}
      title={`${resource.title} · ${subtitle} · ${date}`}
      className="min-w-0 rounded-lg px-1.5 py-2.5 text-center hover:bg-dark-hover transition-colors duration-hover"
    >
      <div className={`mx-auto mb-2 h-9 w-9 rounded-md flex items-center justify-center ${resourceIconTone(resource.file_kind).well}`}>
        <ResourceIcon kind={resource.file_kind} />
      </div>
      <p className="text-xs font-medium text-text-primary truncate">{resource.title}</p>
      <p className="text-2xs text-text-muted truncate mt-0.5">{subtitle}</p>
    </button>
  );
}

export function ResourceGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <ResourceGrid>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[88px] rounded-lg bg-dark-muted animate-pulse" />
      ))}
    </ResourceGrid>
  );
}
