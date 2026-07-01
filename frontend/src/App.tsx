import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TaskDrawerProvider, useTaskDrawer } from './contexts/TaskDrawerContext';
import { AppLayout } from './components/layout/AppLayout';
import { TaskDrawer } from './components/tasks/TaskDrawer';
import { CreateTaskModal } from './components/tasks/CreateTaskModal';
import { ToastContainer } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import MyTasksPage from './pages/MyTasksPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import UsersPage from './pages/UsersPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import { useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});

function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { selectedTaskId, closeTask, isCreateOpen, closeCreate, openCreate } = useTaskDrawer();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        openCreate();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [openCreate]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#191919] gap-3">
        <div className="animate-spin h-8 w-8 border-2 border-zinc-600 border-t-zinc-200 rounded-full" />
        <p className="text-sm text-zinc-400">Loading workspace…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <AppLayout />
      <TaskDrawer taskId={selectedTaskId} onClose={closeTask} />
      <CreateTaskModal isOpen={isCreateOpen} onClose={closeCreate} />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TaskDrawerProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<ProtectedLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="my-tasks" element={<MyTasksPage />} />
                  <Route path="tasks" element={<Navigate to="/" replace />} />
                  <Route path="kanban" element={<Navigate to="/" replace />} />
                  <Route path="dashboard" element={<Navigate to="/reports" replace />} />
                  <Route path="projects" element={<ProjectsPage />} />
                  <Route path="projects/:id" element={<ProjectDetailPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
              <ToastContainer />
            </BrowserRouter>
          </TaskDrawerProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
