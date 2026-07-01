import { TasksWorkspace } from '../components/tasks/TasksWorkspace';
import { tasksApi } from '../services/endpoints';
import { useAuth } from '../contexts/AuthContext';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <TasksWorkspace
      title="Tasks"
      subtitle={user ? `Welcome back, ${user.first_name}` : undefined}
      queryKey={['tasks']}
      fetchTasks={() => tasksApi.list({ page_size: 200 }).then((r) => r.data.data.items)}
      showProject
      showViewSelector
      fullWidth
      showQuickFilters
    />
  );
}
