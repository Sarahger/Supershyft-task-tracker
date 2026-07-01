import { TasksWorkspace } from '../components/tasks/TasksWorkspace';
import { tasksApi } from '../services/endpoints';

export default function AllTasksPage() {
  return (
    <TasksWorkspace
      title="All tasks"
      queryKey={['tasks']}
      fetchTasks={() => tasksApi.list({ page_size: 200 }).then((r) => r.data.data.items)}
      showProject
      showViewSelector
    />
  );
}
