import { jsx as _jsx } from "react/jsx-runtime";
import { TasksWorkspace } from '../components/tasks/TasksWorkspace';
import { useAuth } from '../contexts/AuthContext';
export default function HomePage() {
    const { user } = useAuth();
    return (_jsx(TasksWorkspace, { title: "Tasks", subtitle: user ? `Welcome back, ${user.first_name}` : undefined, queryKey: ['tasks'], showViewSelector: true, fullWidth: true, showQuickFilters: true }));
}
