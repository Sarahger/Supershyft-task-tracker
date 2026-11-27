import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../../contexts/ThemeContext';
export function ThemeToggle({ className, showLabel = false }) {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';
    return (_jsxs("button", { type: "button", onClick: toggleTheme, className: clsx('inline-flex items-center gap-2 rounded-md p-2 text-text-secondary hover:bg-dark-hover hover:text-text-primary transition-colors duration-hover', className), title: isDark ? 'Switch to light mode' : 'Switch to dark mode', "aria-label": isDark ? 'Switch to light mode' : 'Switch to dark mode', children: [isDark ? _jsx(Sun, { className: "h-4 w-4" }) : _jsx(Moon, { className: "h-4 w-4" }), showLabel && _jsx("span", { className: "text-sm", children: isDark ? 'Light mode' : 'Dark mode' })] }));
}
