import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TaskViewPreferencesProvider } from './contexts/TaskViewPreferencesContext';
import { TaskDrawerProvider, useTaskDrawer } from './contexts/TaskDrawerContext';
import { UserDrawerProvider, useUserDrawer } from './contexts/UserDrawerContext';
import { AppLayout } from './components/layout/AppLayout';
import { RequireManager } from './components/auth/RequireManager';
import { canAccessManagerFeatures } from './lib/roles';
import { TaskDrawer } from './components/tasks/TaskDrawer';
import { UserDrawer } from './components/users/UserDrawer';
import { CreateTaskModal } from './components/tasks/CreateTaskModal';
import { ToastContainer } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

const MyTasksPage = lazy(() => import('./pages/MyTasksPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const STALE_REFERENCE_MS = 5 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin h-7 w-7 border-2 border-dark-border border-t-text-primary rounded-full" />
    </div>
  );
}

function DashboardRedirect() {
  const { user } = useAuth();
  return <Navigate to={canAccessManagerFeatures(user) ? '/reports' : '/'} replace />;
}

function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { selectedTaskId, closeTask, isCreateOpen, closeCreate, openCreate } = useTaskDrawer();
  const { selectedUserId, closeUser } = useUserDrawer();

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
      <div className="flex flex-col items-center justify-center h-screen bg-dark-bg gap-3">
        <div className="animate-spin h-8 w-8 border-2 border-dark-border border-t-text-primary rounded-full" />
        <p className="text-sm text-text-secondary">Loading workspace…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <AppLayout />
      {selectedUserId != null && <UserDrawer userId={selectedUserId} onClose={closeUser} />}
      {selectedTaskId != null && <TaskDrawer taskId={selectedTaskId} onClose={closeTask} />}
      {isCreateOpen && <CreateTaskModal isOpen={isCreateOpen} onClose={closeCreate} />}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
        <TaskViewPreferencesProvider>
        <AuthProvider>
          <TaskDrawerProvider>
            <UserDrawerProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<ProtectedLayout />}>
                  <Route index element={<HomePage />} />
                  <Route
                    path="my-tasks"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <MyTasksPage />
                      </Suspense>
                    }
                  />
                  <Route path="tasks" element={<Navigate to="/" replace />} />
                  <Route path="kanban" element={<Navigate to="/" replace />} />
                  <Route path="dashboard" element={<DashboardRedirect />} />
                  <Route
                    path="projects"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <ProjectsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="projects/:id"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <ProjectDetailPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="users"
                    element={
                      <RequireManager>
                        <Suspense fallback={<PageLoader />}>
                          <UsersPage />
                        </Suspense>
                      </RequireManager>
                    }
                  />
                  <Route
                    path="reports"
                    element={
                      <RequireManager>
                        <Suspense fallback={<PageLoader />}>
                          <ReportsPage />
                        </Suspense>
                      </RequireManager>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <SettingsPage />
                      </Suspense>
                    }
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
              <ToastContainer />
            </BrowserRouter>
            </UserDrawerProvider>
          </TaskDrawerProvider>
        </AuthProvider>
        </TaskViewPreferencesProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
