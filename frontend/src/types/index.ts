export interface NotificationPreferences {
  email_notifications_enabled: boolean;
  notify_task_assigned: boolean;
  notify_task_updates: boolean;
  notify_reviews: boolean;
  notify_comments: boolean;
}

export interface UserTaskStats {
  assigned_count: number;
  pending_count: number;
  completed_count: number;
  cancelled_count: number;
  total_estimated_hours: number;
  total_actual_hours: number;
  time_utilization_percent: number | null;
  on_track_count: number;
  over_budget_count: number;
  tasks_with_time_data: number;
}

export interface UserAssignedTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  project_name?: string | null;
  due_date?: string;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  updated_at: string;
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: 'administrator' | 'manager' | 'employee';
  status: string;
  job_title?: string;
  phone?: string;
  profile_picture?: string;
  manager_id?: number;
  departments: { id: number; name: string }[];
  last_login?: string;
  created_at: string;
  email_notifications_enabled?: boolean;
  notify_task_assigned?: boolean;
  notify_task_updates?: boolean;
  notify_reviews?: boolean;
  notify_comments?: boolean;
}

export interface UserProfile extends User {
  open_tasks_count: number;
  completed_tasks_count: number;
  pending_reviews_count: number;
  task_stats: UserTaskStats;
  assigned_tasks: UserAssignedTask[];
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  severity?: string;
  due_date?: string;
  start_date?: string;
  project_id?: number;
  project_name?: string;
  client_id?: number;
  review_required: boolean;
  testing_required: boolean;
  estimated_hours?: number;
  actual_hours?: number;
  assignees: TaskAssignee[];
  tags: { id: number; name: string; color?: string }[];
  departments?: { id: number; name: string }[];
  comment_count?: number;
  attachment_count?: number;
  checklist_progress?: string;
  is_blocked?: boolean;
  block_reason?: string;
  bug_notes?: string;
  reviewer_id?: number;
  reviewer?: UserBrief;
  creator?: UserBrief;
  task_type?: { id: number; name: string };
  task_type_id?: number;
  project?: { id: number; name: string };
  checklists?: Checklist[];
  dependencies?: {
    id: number;
    depends_on_id: number;
    depends_on_title?: string;
    depends_on_user_id?: number;
    depends_on_user?: UserBrief;
  }[];
  custom_field_values?: Record<string, string | null>;
  attachments?: TaskAttachment[];
  current_version?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface TaskAssignee {
  id: number;
  user_id: number;
  is_completed: boolean;
  completed_at?: string;
  user?: UserBrief;
}

export interface UserBrief {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
  profile_picture?: string;
  job_title?: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  status: string;
  health: string;
  start_date?: string;
  end_date?: string;
  open_tasks_count: number;
  completed_tasks_count: number;
  overdue_tasks_count: number;
  tasks_count: number;
  progress: number;
  created_at: string;
}

export interface Department {
  id: number;
  name: string;
  description?: string;
  manager_id?: number;
  member_count: number;
  open_tasks_count: number;
}

export interface Comment {
  id: number;
  task_id: number;
  author_id: number;
  content: string;
  is_edited: boolean;
  created_at: string;
  author?: UserBrief;
  replies?: Comment[];
}

export interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message?: string;
  link?: string;
  is_read: boolean;
  email_sent?: boolean;
  created_at: string;
}

export interface Checklist {
  id: number;
  title: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: number;
  title: string;
  is_completed: boolean;
  sort_order: number;
}

export interface TaskAttachment {
  id: number;
  filename: string;
  file_size?: number;
  mime_type?: string;
  attachment_type: string;
  created_at: string;
  uploaded_by?: UserBrief;
}

export interface ReportAssigneeStats {
  user_id: number;
  name: string;
  departments: string[];
  pending: number;
  in_progress: number;
  overdue: number;
  blocked: number;
  completed: number;
  due_this_week: number;
  total_assigned: number;
}

export interface TaskReportData {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
  blocked: number;
  in_progress: number;
  unassigned_pending: number;
  people_with_overdue: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_assignee: ReportAssigneeStats[];
}

export interface DashboardData {
  stats: {
    open_tasks: number;
    completed_tasks: number;
    blocked_tasks: number;
    overdue_tasks: number;
    pending_reviews: number;
    my_tasks_today: number;
    my_tasks_week: number;
  };
  recent_tasks: Task[];
  pending_reviews: Task[];
  recent_activity: ActivityItem[];
  projects: { id: number; name: string; health: string; status: string }[];
  status_distribution: Record<string, number>;
  priority_distribution: Record<string, number>;
  role: string;
}

export interface ActivityItem {
  id: number;
  activity_type: string;
  description: string;
  created_at: string;
  user: { id: number; name: string };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface APIResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface SearchResults {
  tasks: SearchResult[];
  projects: SearchResult[];
  users: SearchResult[];
  clients: SearchResult[];
  tags: SearchResult[];
  comments: SearchResult[];
}

export interface SearchResult {
  id: number;
  type: string;
  title: string;
  subtitle?: string;
  link?: string;
}

export const TASK_STATUSES = [
  'unassigned', 'backlog', 'to_do', 'in_progress', 'blocked',
  'ready_for_review', 'in_review', 'changes_requested', 'approved',
  'testing', 'bugs_found', 'completed', 'cancelled',
] as const;

export const STATUS_LABELS: Record<string, string> = {
  unassigned: 'Unassigned',
  backlog: 'Backlog',
  to_do: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  ready_for_review: 'Ready for Review',
  in_review: 'In Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  testing: 'Testing',
  bugs_found: 'Bugs Found',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const HEALTH_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  at_risk: 'At Risk',
  delayed: 'Delayed',
  completed: 'Completed',
};

export const USER_STATUSES = ['active', 'on_leave', 'inactive'] as const;

export const USER_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  inactive: 'Inactive',
};
