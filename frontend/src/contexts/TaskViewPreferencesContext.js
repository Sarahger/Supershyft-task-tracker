import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useMemo, useState, } from 'react';
import { DEFAULT_TASK_VIEW_PREFERENCES, getEnabledViewModes, getStoredTaskViewPreferences, isViewModeEnabled, normalizeViewMode, saveTaskViewPreferences, } from '../lib/taskViewPreferences';
const TaskViewPreferencesContext = createContext(undefined);
export function TaskViewPreferencesProvider({ children }) {
    const [preferences, setPreferencesState] = useState(() => getStoredTaskViewPreferences());
    const persist = useCallback((next) => {
        setPreferencesState(next);
        saveTaskViewPreferences(next);
    }, []);
    const toggleView = useCallback((view) => {
        setPreferencesState((prev) => {
            const enabled = prev.enabledViews.includes(view)
                ? prev.enabledViews.filter((v) => v !== view)
                : [...prev.enabledViews, view];
            const next = { enabledViews: enabled };
            saveTaskViewPreferences(next);
            return next;
        });
    }, []);
    const setEnabledViews = useCallback((views) => {
        persist({ enabledViews: views });
    }, [persist]);
    const value = useMemo(() => ({
        preferences,
        enabledViewModes: getEnabledViewModes(preferences),
        isViewEnabled: (mode) => isViewModeEnabled(preferences, mode),
        normalizeView: (mode) => normalizeViewMode(mode, preferences),
        toggleView,
        setEnabledViews,
        hasOptionalViews: preferences.enabledViews.length > 0,
    }), [preferences, toggleView, setEnabledViews]);
    return (_jsx(TaskViewPreferencesContext.Provider, { value: value, children: children }));
}
export function useTaskViewPreferences() {
    const ctx = useContext(TaskViewPreferencesContext);
    if (!ctx)
        throw new Error('useTaskViewPreferences must be used within TaskViewPreferencesProvider');
    return ctx;
}
export { DEFAULT_TASK_VIEW_PREFERENCES };
