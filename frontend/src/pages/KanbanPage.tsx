import { TasksWorkspace } from '../components/tasks/TasksWorkspace';
import { tasksApi } from '../services/endpoints';

export default function KanbanPage() {
  return (
    <TasksWorkspace
      title="Board"
      queryKey={['tasks-kanban']}
      fetchTasks={() => tasksApi.list({ page_size: 200 }).then((r) => r.data.data.items)}
      showProject
      defaultView="kanban"
    />
  );
}
