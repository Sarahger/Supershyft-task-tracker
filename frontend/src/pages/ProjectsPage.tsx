import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { projectsApi } from '../services/endpoints';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';
import { HealthBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/Skeleton';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ page_size: 100 }).then((r) => r.data.data.items),
  });

  return (
    <div className="max-w-workspace mx-auto pb-12">
      <PageHeader
        title="Projects"
        subtitle={`${data?.length ?? 0} workspaces`}
        action={
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New project
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-dark-muted animate-pulse" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState
          title="No projects yet"
          description="Create a project to organize tasks into workspaces."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New project
            </Button>
          }
        />
      ) : (
        <div className="space-y-0.5">
          {data.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-lg text-left hover:bg-dark-hover transition-colors duration-hover group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-text-primary group-hover:text-white transition-colors truncate">
                    {p.name}
                  </h3>
                  <HealthBadge health={p.health} />
                </div>
                {p.description && (
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{p.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted shrink-0">
                <span>{p.open_tasks_count} open</span>
                <span>{p.progress}%</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <CreateProjectModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
