import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { projectsApi, tasksApi } from '../services/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { TasksWorkspace } from '../components/tasks/TasksWorkspace';
import { HealthBadge } from '../components/ui/Badge';
import { TaskDatabaseSkeleton } from '../components/tasks/TaskDatabase';
import type { Task } from '../types';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState<'table' | 'kanban' | 'my-tasks'>('table');

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(Number(id)).then((r) => r.data.data),
  });

  if (!project) return <div className="max-w-5xl mx-auto"><TaskDatabaseSkeleton /></div>;

  const tabs = [
    { id: 'table' as const, label: 'Table' },
    { id: 'kanban' as const, label: 'Board' },
    { id: 'my-tasks' as const, label: 'My Tasks' },
  ];

  const fetchProjectTasks = () =>
    tasksApi.list({ project_id: Number(id), page_size: 200 }).then((r) => r.data.data.items);

  const fetchMyProjectTasks = async () => {
    const tasks = await fetchProjectTasks();
    return tasks.filter((t: Task) => t.assignees?.some((a) => a.user_id === user?.id));
  };

  return (
    <div className="pb-8 w-full">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">{project.name}</h1>
            {project.description && <p className="text-sm text-text-muted mt-1 max-w-2xl">{project.description}</p>}
          </div>
          <HealthBadge health={project.health} />
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
        fetchTasks={tab === 'my-tasks' ? fetchMyProjectTasks : fetchProjectTasks}
        showViewSelector={tab !== 'my-tasks'}
        defaultView={tab === 'kanban' ? 'kanban' : 'table'}
      />
    </div>
  );
}
