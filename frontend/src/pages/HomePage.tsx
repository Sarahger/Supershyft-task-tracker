import { TasksWorkspace } from '../components/tasks/TasksWorkspace';
import { useAuth } from '../contexts/AuthContext';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <TasksWorkspace
      title="Tasks"
      subtitle={user ? `Welcome back, ${user.first_name}` : undefined}
      queryKey={['tasks']}
      showProject
      showViewSelector
      fullWidth
      showQuickFilters
    />
  );
}
