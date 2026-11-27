import api from './api';
export const authApi = {
    requestOtp: (email) => api.post('/auth/request-otp', { email }),
    verifyOtp: (email, code) => api.post('/auth/verify-otp', { email, code }),
    logout: (refresh_token) => api.post('/auth/logout', { refresh_token }),
    me: () => api.get('/auth/me'),
    uploadProfilePicture: (file) => {
        const form = new FormData();
        form.append('file', file);
        return api.post('/auth/me/profile-picture', form);
    },
    removeProfilePicture: () => api.delete('/auth/me/profile-picture'),
};
export const tasksApi = {
    list: (params) => api.get('/tasks', { params }),
    my: () => api.get('/tasks/my'),
    get: (id) => api.get(`/tasks/${id}`),
    create: (data) => api.post('/tasks', data),
    update: (id, data) => api.put(`/tasks/${id}`, data),
    updateStatus: (id, status, extra) => api.patch(`/tasks/${id}/status`, { status, ...extra }),
    block: (id, block_reason) => api.post(`/tasks/${id}/block`, { block_reason }),
    unblock: (id) => api.post(`/tasks/${id}/unblock`),
    markComplete: (id, userId, is_completed) => api.patch(`/tasks/${id}/assignees/${userId}/complete`, { is_completed }),
    review: (id, action, review_comments) => api.post(`/tasks/${id}/review`, { action, review_comments }),
    reopen: (id) => api.post(`/tasks/${id}/reopen`),
    delete: (id, reason) => api.post(`/tasks/${id}/delete`, { reason }),
    getComments: (id) => api.get(`/tasks/${id}/comments`),
    addComment: (id, content, parent_id, mentioned_user_ids) => api.post(`/tasks/${id}/comments`, { content, parent_id, mentioned_user_ids }),
    updateComment: (commentId, content) => api.put(`/comments/${commentId}`, { content }),
    deleteComment: (commentId) => api.delete(`/comments/${commentId}`),
    getActivity: (id) => api.get(`/tasks/${id}/activity`),
    reviseDeadline: (id, data) => api.post(`/tasks/${id}/deadline-revision`, data),
    getDeadlineRevisions: (id) => api.get(`/tasks/${id}/deadline-revisions`),
    uploadAttachment: (id, file) => {
        const form = new FormData();
        form.append('file', file);
        return api.post(`/tasks/${id}/attachments`, form);
    },
    getAttachments: (taskId) => api.get(`/tasks/${taskId}/attachments`),
    downloadAttachment: async (attachmentId, filename) => {
        const response = await api.get(`/attachments/${attachmentId}/download`, { responseType: 'blob' });
        const mime = response.data?.type || 'application/octet-stream';
        const url = window.URL.createObjectURL(new Blob([response.data], { type: mime }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
    },
    deleteAttachment: (attachmentId) => api.delete(`/attachments/${attachmentId}`),
    updateChecklistItem: (itemId, data) => api.patch(`/checklist-items/${itemId}`, data),
    deleteChecklistItem: (itemId) => api.delete(`/checklist-items/${itemId}`),
    addChecklistItem: (taskId, title) => api.post(`/tasks/${taskId}/checklist-items`, { title }),
    addDependency: (taskId, dependsOnId, dependsOnUserId) => api.post(`/tasks/${taskId}/dependencies/${dependsOnId}`, null, { params: dependsOnUserId ? { depends_on_user_id: dependsOnUserId } : undefined }),
    removeDependency: (taskId, dependencyId) => api.delete(`/tasks/${taskId}/dependencies/${dependencyId}`),
};
export const usersApi = {
    list: (params) => api.get('/users', { params }),
    get: (id) => api.get(`/users/${id}`),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    remove: (id) => api.delete(`/users/${id}`),
};
export const departmentsApi = {
    list: () => api.get('/departments'),
    create: (data) => api.post('/departments', data),
};
export const dashboardApi = {
    get: () => api.get('/dashboard'),
};
export const searchApi = {
    search: (q) => api.get('/search', { params: { q } }),
};
export const notificationsApi = {
    list: (unread_only) => api.get('/notifications', { params: { unread_only } }),
    markRead: (id) => api.patch(`/notifications/${id}/read`),
    markAllRead: () => api.patch('/notifications/read-all'),
    getPreferences: () => api.get('/notifications/preferences'),
    updatePreferences: (data) => api.patch('/notifications/preferences', data),
    sendTestEmail: () => api.post('/notifications/test-email'),
};
export const telegramApi = {
    status: () => api.get('/telegram/status'),
    createLinkCode: () => api.post('/telegram/link-codes'),
    unlink: () => api.delete('/telegram/link'),
    updatePreferences: (data) => api.patch('/telegram/preferences', data),
};
export const miscApi = {
    tags: () => api.get('/tags'),
};
export const meetingsApi = {
    joinMorning: () => api.post('/meetings/morning/join'),
    startInstant: (data) => api.post('/meetings/instant/start', data),
    endInstant: (pool_id) => api.post('/meetings/instant/end', { pool_id }),
    startTaskCall: (taskId) => api.post(`/meetings/task/${taskId}/start`),
    joinTaskCall: (taskId) => api.post(`/meetings/task/${taskId}/join`),
    endTaskCall: (taskId) => api.post(`/meetings/task/${taskId}/end`),
    leave: (log_id) => api.post('/meetings/leave', { log_id: log_id ?? null }),
    getDay: (date) => api.get('/meetings/day', { params: { date } }),
    getTaskLogs: (taskId) => api.get(`/meetings/task/${taskId}`),
    getActiveTaskCall: (taskId) => api.get(`/meetings/task/${taskId}/active`),
};
export const weeklyUpdatesApi = {
    overview: (params) => api.get('/weekly-updates/overview', { params }),
    employees: (params) => api.get('/weekly-updates/employees', { params }),
    userHistory: (userId, week_start) => api.get(`/weekly-updates/users/${userId}`, {
        params: week_start ? { week_start } : undefined,
    }),
    suggestions: (week_start) => api.get('/weekly-updates/suggestions', {
        params: week_start ? { week_start } : undefined,
    }),
    carryForward: (week_start) => api.get('/weekly-updates/carry-forward', { params: week_start ? { week_start } : undefined }),
    leaveContext: (params) => api.get('/weekly-updates/leave-context', { params }),
    upsert: (data) => api.put('/weekly-updates', data),
};
export const dailyUpdatesApi = {
    getDay: (date, userId) => api.get('/daily-updates/day', {
        params: { date, ...(userId != null ? { user_id: userId } : {}) },
    }),
    getCalendar: (year, month) => api.get('/daily-updates/calendar', {
        params: { year, month },
    }),
    upsert: (data) => api.put('/daily-updates', data),
};
export const reportsApi = {
    tasks: (filters) => api.post('/reports/tasks', filters),
    exportCsv: (filters) => api.post('/reports/export/csv', filters, { responseType: 'blob' }),
    analytics: (params) => api.get('/reports/analytics', { params }),
    evaluations: (params) => api.get('/reports/evaluations', { params }),
    evaluation: (id) => api.get(`/reports/evaluations/${id}`),
    evaluationHistory: (userId) => api.get('/reports/evaluations/history', { params: { user_id: userId } }),
    evaluationLeaveContext: (params) => api.get('/reports/evaluations/leave-context', { params }),
    createEvaluation: (data) => api.post('/reports/evaluations', data),
    saveEvaluation: (id, data) => api.put(`/reports/evaluations/${id}`, data),
    submitEvaluation: (id, data) => api.post(`/reports/evaluations/${id}/submit`, data),
};
export const attendanceApi = {
    mark: (status, attendance_date, user_id) => api.post('/attendance', {
        status,
        ...(attendance_date ? { attendance_date } : {}),
        ...(user_id != null ? { user_id } : {}),
    }),
    me: (params) => api.get('/attendance/me', { params }),
    today: () => api.get('/attendance/me/today'),
    list: (params) => api.get('/attendance', { params }),
    day: (params) => api.get('/attendance/day', { params }),
    week: (params) => api.get('/attendance/week', { params }),
    userDetail: (userId, params) => api.get(`/attendance/users/${userId}`, {
        params,
    }),
    exportCsv: (filters) => api.post('/attendance/export/csv', filters, { responseType: 'blob' }),
};
export const announcementsApi = {
    list: (params) => api.get('/announcements', { params }),
    unreadCount: () => api.get('/announcements/unread-count'),
    markSeen: () => api.post('/announcements/seen'),
    create: (data) => api.post('/announcements', data),
    addLink: (id, data) => api.post(`/announcements/${id}/links`, data),
    uploadAttachment: (id, file) => {
        const form = new FormData();
        form.append('file', file);
        return api.post(`/announcements/${id}/attachments`, form);
    },
    toggleReaction: (id) => api.post(`/announcements/${id}/reactions`),
    remove: (id) => api.delete(`/announcements/${id}`),
    downloadAttachment: async (attachmentId, filename) => {
        const response = await api.get(`/announcements/attachments/${attachmentId}/download`, { responseType: 'blob' });
        const mime = response.data?.type || 'application/octet-stream';
        const url = window.URL.createObjectURL(new Blob([response.data], { type: mime }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
    },
    attachmentBlob: (attachmentId) => api.get(`/announcements/attachments/${attachmentId}/download`, { responseType: 'blob' }),
};
export const workVaultApi = {
    list: (params) => api.get('/work-vault/resources', { params }),
    people: (params) => api.get('/work-vault/people', { params }),
    folders: (params) => api.get('/work-vault/folders', { params }),
    createFolder: (name, description, unique = false) => api.post('/work-vault/folders', {
        ...(name != null && name !== '' ? { name } : {}),
        ...(description != null ? { description } : {}),
        ...(unique ? { unique: true } : {}),
    }),
    updateFolder: (id, data) => api.patch(`/work-vault/folders/${id}`, data),
    removeFolder: (id) => api.delete(`/work-vault/folders/${id}`),
    unreadCount: () => api.get('/work-vault/unread-count'),
    markSeen: () => api.post('/work-vault/seen'),
    facets: (params) => api.get('/work-vault/facets', { params }),
    categories: () => api.get('/work-vault/categories'),
    get: (id) => api.get(`/work-vault/resources/${id}`),
    create: (form) => api.post('/work-vault/resources', form),
    update: (id, data) => api.patch(`/work-vault/resources/${id}`, data),
    replaceFile: (id, file) => {
        const form = new FormData();
        form.append('file', file);
        return api.post(`/work-vault/resources/${id}/file`, form);
    },
    remove: (id) => api.delete(`/work-vault/resources/${id}`),
    download: async (id, filename) => {
        const response = await api.get(`/work-vault/resources/${id}/download`, { responseType: 'blob' });
        const mime = response.data?.type || 'application/octet-stream';
        const url = window.URL.createObjectURL(new Blob([response.data], { type: mime }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(url);
    },
    fileBlob: (id) => api.get(`/work-vault/resources/${id}/download`, { responseType: 'blob' }),
};
