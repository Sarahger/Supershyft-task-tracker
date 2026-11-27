import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, } from 'react';
const STORAGE_KEY = 'theme-preference';
const ThemeContext = createContext(undefined);
function getSystemTheme() {
    if (typeof window === 'undefined')
        return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function getStoredPreference() {
    if (typeof window === 'undefined')
        return 'dark';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system')
        return stored;
    const legacy = localStorage.getItem('theme');
    if (legacy === 'light' || legacy === 'dark')
        return legacy;
    return 'dark';
}
function resolveTheme(preference) {
    if (preference === 'system')
        return getSystemTheme();
    return preference;
}
export function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
}
export function ThemeProvider({ children }) {
    const [preference, setPreferenceState] = useState(() => {
        const initial = getStoredPreference();
        applyTheme(resolveTheme(initial));
        return initial;
    });
    const theme = useMemo(() => resolveTheme(preference), [preference]);
    useLayoutEffect(() => {
        applyTheme(theme);
        localStorage.setItem(STORAGE_KEY, preference);
        localStorage.removeItem('theme');
    }, [theme, preference]);
    useLayoutEffect(() => {
        if (preference !== 'system')
            return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => applyTheme(resolveTheme('system'));
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [preference]);
    const setPreference = useCallback((next) => setPreferenceState(next), []);
    const toggleTheme = useCallback(() => {
        setPreferenceState((current) => {
            const resolved = resolveTheme(current);
            return resolved === 'dark' ? 'light' : 'dark';
        });
    }, []);
    const value = useMemo(() => ({ preference, theme, setPreference, toggleTheme }), [preference, theme, setPreference, toggleTheme]);
    return _jsx(ThemeContext.Provider, { value: value, children: children });
}
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx)
        throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
