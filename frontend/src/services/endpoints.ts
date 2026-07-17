import api from './api';
import type { APIResponse, DashboardData, NotificationPreferences, PaginatedResponse, Project, SearchResults, Task, TaskAttachment, TaskReportData, User, UserProfile } from '../types';

export const authApi = {
  requestOtp: (email: string) =>
    api.post<APIResponse<unknown>>('/auth/request-otp', { email }),
  verifyOtp: (email: string, code: string) =>
    api.post<APIResponse<{ access_token: string; refresh_token: string; user: User }>>('/auth/verify-otp', { email, code }),
  logout: (refresh_token: string) => api.post('/auth/logout', { refresh_token }),
  me: () => api.get<APIResponse<User>>('/auth/me'),
  uploadProfilePicture: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<APIResponse<User>>('/auth/me/profile-picture', form);
  },
  removeProfilePicture: () => api.delete<APIResponse<User>>('/auth/me/profile-picture'),
};

export const tasksApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<APIResponse<PaginatedResponse<Task>>>('/tasks', { params }),
  my: () => api.get<APIResponse<Task[]>>('/tasks/my'),
  get: (id: number) => api.get<APIResponse<Task>>(`/tasks/${id}`),
  create: (data: Partial<Task> & { assignee_ids?: number[]; department_ids?: number[]; tag_ids?: number[] }) =>
    api.post<APIResponse<Task>>('/tasks', data),
  update: (id: number, data: Record<string, unknown>) => api.put<APIResponse<Task>>(`/tasks/${id}`, data),
  updateStatus: (id: number, status: string, extra?: { block_reason?: string; bug_notes?: string }) =>
    api.patch<APIResponse<Task>>(`/tasks/${id}/status`, { status, ...extra }),
  block: (id: number, block_reason: string) => api.post<APIResponse<Task>>(`/tasks/${id}/block`, { block_reason }),
  unblock: (id: number) => api.post<APIResponse<Task>>(`/tasks/${id}/unblock`),
  markComplete: (id: number, userId: number, is_completed: boolean) =>
    api.patch<APIResponse<Task>>(`/tasks/${id}/assignees/${userId}/complete`, { is_completed }),
  review: (id: number, action: string, review_comments?: string) =>
    api.post<APIResponse<Task>>(`/tasks/${id}/review`, { action, review_comments }),
  reopen: (id: number) => api.post<APIResponse<Task>>(`/tasks/${id}/reopen`),
  delete: (id: number, reason: string) => api.post<APIResponse<null>>(`/tasks/${id}/delete`, { reason }),
  getComments: (id: number) => api.get(`/tasks/${id}/comments`),
  addComment: (id: number, content: string, parent_id?: number, mentioned_user_ids?: number[]) =>
    api.post(`/tasks/${id}/comments`, { content, parent_id, mentioned_user_ids }),
  updateComment: (commentId: number, content: string) =>
    api.put(`/comments/${commentId}`, { content }),
  deleteComment: (commentId: number) => api.delete(`/comments/${commentId}`),
  getActivity: (id: number) => api.get(`/tasks/${id}/activity`),
  uploadAttachment: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/tasks/${id}/attachments`, form);
  },
  getAttachments: (taskId: number) =>
    api.get<APIResponse<TaskAttachment[]>>(`/tasks/${taskId}/attachments`),
  downloadAttachment: async (attachmentId: number, filename: string) => {
    const response = await api.get(`/attachments/${attachmentId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  },
  deleteAttachment: (attachmentId: number) => api.delete(`/attachments/${attachmentId}`),
  updateChecklistItem: (itemId: number, data: { is_completed?: boolean; title?: string }) =>
    api.patch(`/checklist-items/${itemId}`, data),
  deleteChecklistItem: (itemId: number) => api.delete(`/checklist-items/${itemId}`),
  addChecklistItem: (taskId: number, title: string) =>
    api.post<APIResponse<{ id: number; title: string; is_completed: boolean; sort_order: number }>>(
      `/tasks/${taskId}/checklist-items`,
      { title },
    ),
  addDependency: (taskId: number, dependsOnId: number, dependsOnUserId?: number) =>
    api.post<APIResponse<{ id: number; depends_on_id: number; depends_on_title?: string; depends_on_user_id?: number }>>(
      `/tasks/${taskId}/dependencies/${dependsOnId}`,
      null,
      { params: dependsOnUserId ? { depends_on_user_id: dependsOnUserId } : undefined },
    ),
  removeDependency: (taskId: number, dependencyId: number) =>
    api.delete(`/tasks/${taskId}/dependencies/${dependencyId}`),
};

export const projectsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<APIResponse<PaginatedResponse<Project>>>('/projects', { params }),
  get: (id: number) => api.get<APIResponse<Project>>(`/projects/${id}`),
  create: (data: Partial<Project>) => api.post<APIResponse<Project>>('/projects', data),
  update: (id: number, data: Partial<Project>) => api.put<APIResponse<Project>>(`/projects/${id}`, data),
  remove: (id: number) => api.delete<APIResponse<null>>(`/projects/${id}`),
};

export const usersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<APIResponse<PaginatedResponse<User>>>('/users', { params }),
  get: (id: number) => api.get<APIResponse<UserProfile>>(`/users/${id}`),
  create: (data: {
    first_name: string;
    last_name: string;
    email: string;
    role?: string;
    job_title?: string;
    department_ids?: number[];
  }) => api.post<APIResponse<User>>('/users', data),
  update: (
    id: number,
    data: Partial<Pick<User, 'first_name' | 'last_name' | 'email' | 'role' | 'status' | 'job_title' | 'phone'>> & {
      department_ids?: number[];
    },
  ) => api.put<APIResponse<User>>(`/users/${id}`, data),
  remove: (id: number) => api.delete(`/users/${id}`),
};

export const departmentsApi = {
  list: () => api.get<APIResponse<{ id: number; name: string; description?: string }[]>>('/departments'),
  create: (data: { name: string; description?: string }) =>
    api.post<APIResponse<{ id: number; name: string }>>('/departments', data),
};

export const dashboardApi = {
  get: () => api.get<APIResponse<DashboardData>>('/dashboard'),
};

export const searchApi = {
  search: (q: string) => api.get<APIResponse<SearchResults>>('/search', { params: { q } }),
};

export const notificationsApi = {
  list: (unread_only?: boolean) =>
    api.get('/notifications', { params: { unread_only } }),
  markRead: (id: number) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  getPreferences: () => api.get<APIResponse<NotificationPreferences>>('/notifications/preferences'),
  updatePreferences: (data: Partial<NotificationPreferences>) =>
    api.patch<APIResponse<NotificationPreferences>>('/notifications/preferences', data),
  sendTestEmail: () => api.post<APIResponse<unknown>>('/notifications/test-email'),
};

export const miscApi = {
  tags: () => api.get('/tags'),
};

export const meetingsApi = {
  joinMorning: () =>
    api.post<APIResponse<MeetingActionResult>>('/meetings/morning/join'),
  startInstant: (data: { invite_user_ids: number[] }) =>
    api.post<APIResponse<MeetingActionResult>>('/meetings/instant/start', data),
  endInstant: (pool_id: number) =>
    api.post<APIResponse<{ pool: import('../types').MeetPoolLink }>>('/meetings/instant/end', { pool_id }),
  startTaskCall: (taskId: number) =>
    api.post<APIResponse<MeetingActionResult>>(`/meetings/task/${taskId}/start`),
  joinTaskCall: (taskId: number) =>
    api.post<APIResponse<MeetingActionResult>>(`/meetings/task/${taskId}/join`),
  endTaskCall: (taskId: number) =>
    api.post<APIResponse<{ pool: import('../types').MeetPoolLink }>>(`/meetings/task/${taskId}/end`),
  leave: (log_id?: number) =>
    api.post<APIResponse<import('../types').MeetingLog>>('/meetings/leave', { log_id: log_id ?? null }),
  getDay: (date: string) =>
    api.get<APIResponse<import('../types').MeetingDaySummary>>('/meetings/day', { params: { date } }),
  getTaskLogs: (taskId: number) =>
    api.get<APIResponse<import('../types').MeetingLog[]>>(`/meetings/task/${taskId}`),
  getActiveTaskCall: (taskId: number) =>
    api.get<APIResponse<import('../types').MeetPoolLink | null>>(`/meetings/task/${taskId}/active`),
};

type MeetingActionResult = import('../types').MeetingActionResult;

export const reportsApi = {
  tasks: (filters: Record<string, unknown>) =>
    api.post<APIResponse<TaskReportData>>('/reports/tasks', filters),
  exportCsv: (filters: Record<string, unknown>) =>
    api.post('/reports/export/csv', filters, { responseType: 'blob' }),
};
