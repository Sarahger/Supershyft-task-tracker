import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from 'clsx';
import { formatRecordedTime, normalizeStatus, statusDotClass, statusLabel, statusShort } from './attendanceUtils';
const sizes = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3.5 w-3.5',
    lg: 'h-5 w-5',
};
export function AttendanceStatusDot({ status, recordedAt, size = 'md', showLabel = false, className, }) {
    const normalized = normalizeStatus(status ?? undefined);
    const label = statusLabel(normalized);
    const time = formatRecordedTime(recordedAt);
    const title = time ? `${label} · ${time}` : label;
    return (_jsxs("span", { className: clsx('inline-flex items-center gap-1.5', className), title: title, "aria-label": title, children: [_jsx("span", { className: clsx('rounded-full shrink-0', sizes[size], statusDotClass(normalized)), "aria-hidden": true }), showLabel && (_jsx("span", { className: "text-xs text-text-secondary", children: statusShort(normalized) }))] }));
}
