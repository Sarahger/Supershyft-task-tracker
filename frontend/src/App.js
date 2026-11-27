import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
// AI Task Assistant plugin (disabled — see plugins/ai-task-assistant/ locally)
// import { AiAssistantPlugin } from './plugins/ai-task-assistant';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
const MyTasksPage = lazy(() => import('./pages/MyTasksPage'));
const WeeklyUpdatesPage = lazy(() => import('./pages/WeeklyUpdatesPage'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'));
const WorkVaultPage = lazy(() => import('./pages/WorkVaultPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const MeetingsPage = lazy(() => import('./pages/MeetingsPage'));
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const AttendanceHrPage = lazy(() => import('./pages/AttendanceHrPage'));
const STALE_REFERENCE_MS = 5 * 60 * 1000;
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30000,
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});
function PageLoader() {
    return (_jsx("div", { className: "flex items-center justify-center py-16", children: _jsx("div", { className: "animate-spin h-7 w-7 border-2 border-dark-border border-t-text-primary rounded-full" }) }));
}
function DashboardRedirect() {
    const { user } = useAuth();
    return _jsx(Navigate, { to: canAccessManagerFeatures(user) ? '/reports' : '/', replace: true });
}
function ProtectedLayout() {
    const { isAuthenticated, isLoading } = useAuth();
    const { selectedTaskId, closeTask, isCreateOpen, closeCreate, openCreate } = useTaskDrawer();
    const { selectedUserId, closeUser } = useUserDrawer();
    useEffect(() => {
        const openNewTask = () => {
            openCreate();
        };
        const handler = (e) => {
            const key = e.key.toLowerCase();
            const mod = e.ctrlKey || e.metaKey;
            const inField = document.activeElement?.tagName === 'INPUT'
                || document.activeElement?.tagName === 'TEXTAREA'
                || document.activeElement?.isContentEditable;
            // Ctrl/Cmd+C — create task when nothing is selected (so normal copy still works)
            if (mod && key === 'c' && !e.shiftKey && !e.altKey) {
                if (inField)
                    return;
                const selected = window.getSelection()?.toString() ?? '';
                if (selected.length > 0)
                    return;
                e.preventDefault();
                openNewTask();
                return;
            }
            // Plain "c" when not typing
            if (key === 'c' && !mod && !e.altKey && !inField) {
                openNewTask();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [openCreate]);
    if (isLoading) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-screen bg-dark-bg gap-3", children: [_jsx("div", { className: "animate-spin h-8 w-8 border-2 border-dark-border border-t-text-primary rounded-full" }), _jsx("p", { className: "text-sm text-text-secondary", children: "Loading workspace\u2026" })] }));
    }
    if (!isAuthenticated) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return (_jsxs(_Fragment, { children: [_jsx(AppLayout, {}), selectedUserId != null && _jsx(UserDrawer, { userId: selectedUserId, onClose: closeUser }), selectedTaskId != null && _jsx(TaskDrawer, { taskId: selectedTaskId, onClose: closeTask }), isCreateOpen && _jsx(CreateTaskModal, { isOpen: isCreateOpen, onClose: closeCreate })] }));
}
export default function App() {
    return (_jsx(ErrorBoundary, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(ThemeProvider, { children: _jsx(TaskViewPreferencesProvider, { children: _jsx(AuthProvider, { children: _jsx(BrowserRouter, { children: _jsx(TaskDrawerProvider, { children: _jsxs(UserDrawerProvider, { children: [_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsxs(Route, { element: _jsx(ProtectedLayout, {}), children: [_jsx(Route, { index: true, element: _jsx(HomePage, {}) }), _jsx(Route, { path: "my-tasks", element: _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(MyTasksPage, {}) }) }), _jsx(Route, { path: "weekly-updates", element: _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(WeeklyUpdatesPage, {}) }) }), _jsx(Route, { path: "announcements", element: _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(AnnouncementsPage, {}) }) }), _jsx(Route, { path: "work-vault", element: _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(WorkVaultPage, {}) }) }), _jsx(Route, { path: "daily-updates", element: _jsx(Navigate, { to: "/weekly-updates", replace: true }) }), _jsx(Route, { path: "tasks", element: _jsx(Navigate, { to: "/", replace: true }) }), _jsx(Route, { path: "kanban", element: _jsx(Navigate, { to: "/", replace: true }) }), _jsx(Route, { path: "dashboard", element: _jsx(DashboardRedirect, {}) }), _jsx(Route, { path: "projects", element: _jsx(Navigate, { to: "/", replace: true }) }), _jsx(Route, { path: "projects/:id", element: _jsx(Navigate, { to: "/", replace: true }) }), _jsx(Route, { path: "meetings", element: _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(MeetingsPage, {}) }) }), _jsx(Route, { path: "attendance", element: _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(AttendancePage, {}) }) }), _jsx(Route, { path: "attendance/hr", element: _jsx(RequireManager, { children: _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(AttendanceHrPage, {}) }) }) }), _jsx(Route, { path: "users", element: _jsx(RequireManager, { children: _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(UsersPage, {}) }) }) }), _jsx(Route, { path: "reports", element: _jsx(RequireManager, { children: _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(ReportsPage, {}) }) }) }), _jsx(Route, { path: "settings", element: _jsx(Suspense, { fallback: _jsx(PageLoader, {}), children: _jsx(SettingsPage, {}) }) }), _jsx(Route, { path: "*", element: _jsx(NotFoundPage, {}) })] })] }), _jsx(ToastContainer, {})] }) }) }) }) }) }) }) }));
}
