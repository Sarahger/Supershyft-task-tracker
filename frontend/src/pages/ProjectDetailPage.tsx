import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import { projectsApi } from '../services/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { TasksWorkspace } from '../components/tasks/TasksWorkspace';
import { DeleteProjectModal } from '../components/projects/DeleteProjectModal';
import { HealthBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { TaskDatabaseSkeleton } from '../components/tasks/TaskDatabase';
import { toast } from '../components/ui/Toast';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<'table' | 'kanban' | 'my-tasks'>('table');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const projectId = Number(id);

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(projectId).then((r) => r.data.data),
    enabled: Number.isFinite(projectId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.remove(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
      navigate('/projects');
    },
    onError: (error: { response?: { data?: { detail?: string; message?: string } } }) => {
      const detail = error.response?.data?.detail || error.response?.data?.message;
      toast.error(typeof detail === 'string' ? detail : 'Failed to delete project');
    },
  });

  if (!project) return <div className="max-w-5xl mx-auto"><TaskDatabaseSkeleton /></div>;

  const canDelete = (project.tasks_count ?? 0) === 0;

  const tabs = [
    { id: 'table' as const, label: 'Table' },
    { id: 'kanban' as const, label: 'Board' },
    { id: 'my-tasks' as const, label: 'My Tasks' },
  ];

  const listFilters: Record<string, unknown> = { project_id: projectId };
  if (tab === 'my-tasks' && user?.id) {
    listFilters.assignee_id = user.id;
  }

  return (
    <div className="pb-8 w-full">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">{project.name}</h1>
            {project.description && <p className="text-sm text-text-muted mt-1 max-w-2xl">{project.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canDelete && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                className="gap-1.5 text-accent-danger hover:text-accent-danger hover:bg-red-500/10 border-red-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
            <HealthBadge health={project.health} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted mt-4">
          <span>{project.open_tasks_count} open</span>
          <span>·</span>
          <span>{project.completed_tasks_count} done</span>
          {project.overdue_tasks_count > 0 && (<><span>·</span><span className="text-red-400">{project.overdue_tasks_count} overdue</span></>)}
          <span>·</span>
          <span>{project.progress}% complete</span>
        </div>
      </header>

      <div className="flex items-center gap-1 mb-6 border-b border-dark-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-hover',
              tab === t.id ? 'border-text-primary text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <TasksWorkspace
        key={tab}
        title=""
        queryKey={tab === 'my-tasks' ? ['project-my-tasks', id!] : ['project-tasks', id!]}
        listFilters={listFilters}
        showViewSelector={tab !== 'my-tasks'}
        defaultView={tab === 'kanban' ? 'kanban' : 'table'}
      />

      <DeleteProjectModal
        isOpen={showDeleteModal}
        projectName={project.name}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
