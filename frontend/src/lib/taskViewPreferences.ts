import type { ViewMode } from '../components/tasks/TaskToolbar';

export type OptionalTaskView = Exclude<ViewMode, 'table'>;

export interface TaskViewPreferences {
  /** Optional views the user wants on the Tasks screen. List (table) is always available. */
  enabledViews: OptionalTaskView[];
}

export const OPTIONAL_TASK_VIEWS: {
  id: OptionalTaskView;
  label: string;
  description: string;
}[] = [
  { id: 'kanban', label: 'Board', description: 'Kanban columns by status' },
  { id: 'calendar', label: 'Calendar', description: 'Month view by due date' },
  { id: 'weekly', label: 'Week', description: 'Weekly schedule grid' },
];

const STORAGE_KEY = 'task-view-preferences';

export const DEFAULT_TASK_VIEW_PREFERENCES: TaskViewPreferences = {
  enabledViews: [],
};

export function getStoredTaskViewPreferences(): TaskViewPreferences {
  if (typeof window === 'undefined') return DEFAULT_TASK_VIEW_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TASK_VIEW_PREFERENCES;
    const parsed = JSON.parse(raw) as TaskViewPreferences;
    const valid = new Set<OptionalTaskView>(['kanban', 'calendar', 'weekly']);
    const enabledViews = (parsed.enabledViews ?? []).filter((v): v is OptionalTaskView => valid.has(v as OptionalTaskView));
    return { enabledViews };
  } catch {
    return DEFAULT_TASK_VIEW_PREFERENCES;
  }
}

export function saveTaskViewPreferences(prefs: TaskViewPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function getEnabledViewModes(prefs: TaskViewPreferences): ViewMode[] {
  return ['table', ...prefs.enabledViews];
}

export function isViewModeEnabled(prefs: TaskViewPreferences, mode: ViewMode): boolean {
  if (mode === 'table') return true;
  return prefs.enabledViews.includes(mode);
}

export function normalizeViewMode(mode: ViewMode, prefs: TaskViewPreferences): ViewMode {
  return isViewModeEnabled(prefs, mode) ? mode : 'table';
}
