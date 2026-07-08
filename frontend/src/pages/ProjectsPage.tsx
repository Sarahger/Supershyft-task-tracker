import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { projectsApi } from '../services/endpoints';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';
import { DeleteProjectModal } from '../components/projects/DeleteProjectModal';
import { HealthBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import type { Project } from '../types';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ page_size: 100 }).then((r) => r.data.data.items),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeleteTarget(null);
      toast.success('Project deleted');
    },
    onError: (error: { response?: { data?: { detail?: string; message?: string } } }) => {
      const detail = error.response?.data?.detail || error.response?.data?.message;
      toast.error(typeof detail === 'string' ? detail : 'Failed to delete project');
    },
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
            <div
              key={p.id}
              className="w-full flex items-center gap-2 px-4 py-4 rounded-lg hover:bg-dark-hover transition-colors duration-hover group"
            >
              <button
                type="button"
                onClick={() => navigate(`/projects/${p.id}`)}
                className="flex-1 min-w-0 flex items-center gap-4 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-text-primary group-hover:text-text-primary transition-colors truncate">
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
              {(p.tasks_count ?? 0) === 0 && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(p)}
                  className="max-md:hidden shrink-0 p-2 rounded-lg text-text-muted hover:text-accent-danger hover:bg-red-500/10 transition-colors"
                  title="Delete project"
                  aria-label={`Delete ${p.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateProjectModal isOpen={showCreate} onClose={() => setShowCreate(false)} />

      <DeleteProjectModal
        isOpen={deleteTarget != null}
        projectName={deleteTarget?.name}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
