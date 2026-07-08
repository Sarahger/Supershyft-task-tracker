import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_TASK_VIEW_PREFERENCES,
  getEnabledViewModes,
  getStoredTaskViewPreferences,
  isViewModeEnabled,
  normalizeViewMode,
  saveTaskViewPreferences,
  type OptionalTaskView,
  type TaskViewPreferences,
} from '../lib/taskViewPreferences';
import type { ViewMode } from '../components/tasks/TaskToolbar';

interface TaskViewPreferencesContextType {
  preferences: TaskViewPreferences;
  enabledViewModes: ViewMode[];
  isViewEnabled: (mode: ViewMode) => boolean;
  normalizeView: (mode: ViewMode) => ViewMode;
  toggleView: (view: OptionalTaskView) => void;
  setEnabledViews: (views: OptionalTaskView[]) => void;
  hasOptionalViews: boolean;
}

const TaskViewPreferencesContext = createContext<TaskViewPreferencesContextType | undefined>(undefined);

export function TaskViewPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<TaskViewPreferences>(() => getStoredTaskViewPreferences());

  const persist = useCallback((next: TaskViewPreferences) => {
    setPreferencesState(next);
    saveTaskViewPreferences(next);
  }, []);

  const toggleView = useCallback((view: OptionalTaskView) => {
    setPreferencesState((prev) => {
      const enabled = prev.enabledViews.includes(view)
        ? prev.enabledViews.filter((v) => v !== view)
        : [...prev.enabledViews, view];
      const next = { enabledViews: enabled };
      saveTaskViewPreferences(next);
      return next;
    });
  }, []);

  const setEnabledViews = useCallback((views: OptionalTaskView[]) => {
    persist({ enabledViews: views });
  }, [persist]);

  const value = useMemo(() => ({
    preferences,
    enabledViewModes: getEnabledViewModes(preferences),
    isViewEnabled: (mode: ViewMode) => isViewModeEnabled(preferences, mode),
    normalizeView: (mode: ViewMode) => normalizeViewMode(mode, preferences),
    toggleView,
    setEnabledViews,
    hasOptionalViews: preferences.enabledViews.length > 0,
  }), [preferences, toggleView, setEnabledViews]);

  return (
    <TaskViewPreferencesContext.Provider value={value}>
      {children}
    </TaskViewPreferencesContext.Provider>
  );
}

export function useTaskViewPreferences() {
  const ctx = useContext(TaskViewPreferencesContext);
  if (!ctx) throw new Error('useTaskViewPreferences must be used within TaskViewPreferencesProvider');
  return ctx;
}

export { DEFAULT_TASK_VIEW_PREFERENCES };
