export const OPTIONAL_TASK_VIEWS = [
    { id: 'kanban', label: 'Board', description: 'Kanban columns by status' },
    { id: 'calendar', label: 'Calendar', description: 'Month view by due date' },
    { id: 'weekly', label: 'Week', description: 'Weekly schedule grid' },
];
const STORAGE_KEY = 'task-view-preferences';
export const DEFAULT_TASK_VIEW_PREFERENCES = {
    enabledViews: [],
};
export function getStoredTaskViewPreferences() {
    if (typeof window === 'undefined')
        return DEFAULT_TASK_VIEW_PREFERENCES;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return DEFAULT_TASK_VIEW_PREFERENCES;
        const parsed = JSON.parse(raw);
        const valid = new Set(['kanban', 'calendar', 'weekly']);
        const enabledViews = (parsed.enabledViews ?? []).filter((v) => valid.has(v));
        return { enabledViews };
    }
    catch {
        return DEFAULT_TASK_VIEW_PREFERENCES;
    }
}
export function saveTaskViewPreferences(prefs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
export function getEnabledViewModes(prefs) {
    return ['table', ...prefs.enabledViews];
}
export function isViewModeEnabled(prefs, mode) {
    if (mode === 'table')
        return true;
    return prefs.enabledViews.includes(mode);
}
export function normalizeViewMode(mode, prefs) {
    return isViewModeEnabled(prefs, mode) ? mode : 'table';
}
