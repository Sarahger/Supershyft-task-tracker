import api from './api';
import type { APIResponse, DashboardData, PaginatedResponse, Project, SearchResults, Task, TaskAttachment, TaskReportData, User } from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<APIResponse<{ access_token: string; refresh_token: string; user: User }>>('/auth/login', { email, password }),
  logout: (refresh_token: string) => api.post('/auth/logout', { refresh_token }),
  me: () => api.get<APIResponse<User>>('/auth/me'),
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
  getComments: (id: number) => api.get(`/tasks/${id}/comments`),
  addComment: (id: number, content: string, parent_id?: number) =>
    api.post(`/tasks/${id}/comments`, { content, parent_id }),
  getActivity: (id: number) => api.get(`/tasks/${id}/activity`),
  uploadAttachment: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/tasks/${id}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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
  updateChecklistItem: (itemId: number, data: { is_completed?: boolean; title?: string }) =>
    api.patch(`/checklist-items/${itemId}`, data),
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
};

export const usersApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<APIResponse<PaginatedResponse<User>>>('/users', { params }),
  get: (id: number) => api.get<APIResponse<User>>(`/users/${id}`),
  create: (data: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    role?: string;
    job_title?: string;
    department_ids?: number[];
  }) => api.post<APIResponse<User>>('/users', data),
  update: (id: number, data: Partial<User> & { password?: string }) =>
    api.put<APIResponse<User>>(`/users/${id}`, data),
  deactivate: (id: number) => api.delete(`/users/${id}`),
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
};

export const miscApi = {
  taskTypes: () => api.get('/task-types'),
  tags: () => api.get('/tags'),
};

export interface CustomFieldDefinition {
  id: number;
  name: string;
  field_key: string;
  field_type: 'text' | 'number' | 'select' | 'date' | 'checkbox';
  applies_to: string;
  options: string[];
  sort_order: number;
  is_active: boolean;
}

export const customFieldsApi = {
  list: (appliesTo = 'task') =>
    api.get<APIResponse<CustomFieldDefinition[]>>('/custom-fields', { params: { applies_to: appliesTo } }),
  create: (data: {
    name: string;
    field_type?: string;
    applies_to?: string;
    options?: string[];
    field_key?: string;
  }) => api.post<APIResponse<CustomFieldDefinition>>('/custom-fields', data),
  update: (id: number, data: Partial<CustomFieldDefinition>) =>
    api.put<APIResponse<CustomFieldDefinition>>(`/custom-fields/${id}`, data),
  remove: (id: number) => api.delete(`/custom-fields/${id}`),
  updateTaskValues: (taskId: number, values: Record<string, string | null>) =>
    api.put(`/custom-fields/tasks/${taskId}/values`, { values }),
};

export const reportsApi = {
  tasks: (filters: Record<string, unknown>) =>
    api.post<APIResponse<TaskReportData>>('/reports/tasks', filters),
  exportCsv: (filters: Record<string, unknown>) =>
    api.post('/reports/export/csv', filters, { responseType: 'blob' }),
};
