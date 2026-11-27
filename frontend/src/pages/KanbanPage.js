import { jsx as _jsx } from "react/jsx-runtime";
import { TasksWorkspace } from '../components/tasks/TasksWorkspace';
import { tasksApi } from '../services/endpoints';
export default function KanbanPage() {
    return (_jsx(TasksWorkspace, { title: "Board", queryKey: ['tasks-kanban'], fetchTasks: () => tasksApi.list({ page_size: 200 }).then((r) => r.data.data.items), defaultView: "kanban" }));
}
