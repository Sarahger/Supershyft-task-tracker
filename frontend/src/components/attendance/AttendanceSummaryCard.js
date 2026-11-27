import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from 'clsx';
function Bar({ label, value, max, color }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-xs mb-1", children: [_jsx("span", { className: "text-text-secondary", children: label }), _jsx("span", { className: "tabular-nums text-text-primary font-medium", children: value })] }), _jsx("div", { className: "h-1.5 rounded-full bg-dark-muted overflow-hidden", children: _jsx("div", { className: clsx('h-full rounded-full transition-all duration-500', color), style: { width: `${pct}%` } }) })] }));
}
export function AttendanceSummaryCard({ summary, loading }) {
    if (loading || !summary) {
        return (_jsxs("div", { className: "card h-full p-4 animate-pulse space-y-3", children: [_jsx("div", { className: "h-3 w-28 bg-dark-muted rounded" }), _jsx("div", { className: "h-2 bg-dark-muted rounded" }), _jsx("div", { className: "h-2 bg-dark-muted rounded" }), _jsx("div", { className: "h-2 bg-dark-muted rounded" })] }));
    }
    const max = Math.max(summary.working_days, summary.wfo_count
        + summary.wfh_count
        + summary.leave_count
        + (summary.half_day_count ?? 0)
        + (summary.camp_count ?? 0), 1);
    return (_jsxs("section", { className: "card h-full min-h-0 p-3 flex flex-col", children: [_jsx("h2", { className: "workspace-section-title !mb-2 !px-0 shrink-0", children: "Monthly summary" }), _jsxs("div", { className: "flex-1 min-h-0 flex flex-col justify-center space-y-2 overflow-y-auto", children: [_jsx(Bar, { label: "Present (WFO)", value: summary.wfo_count, max: max, color: "bg-emerald-500" }), _jsx(Bar, { label: "WFH", value: summary.wfh_count, max: max, color: "bg-sky-500" }), _jsx(Bar, { label: "Leave", value: summary.leave_count, max: max, color: "bg-amber-500" }), _jsx(Bar, { label: "Half Day", value: summary.half_day_count ?? 0, max: max, color: "bg-violet-500" }), _jsx(Bar, { label: "Camp/Meeting", value: summary.camp_count ?? 0, max: max, color: "bg-orange-500" })] }), _jsxs("div", { className: "mt-2 pt-2 border-t border-dark-border flex items-center justify-between shrink-0", children: [_jsx("span", { className: "text-xs text-text-muted", children: "Attendance %" }), _jsxs("span", { className: "text-base font-semibold tabular-nums metric-emerald", children: [summary.attendance_percent, "%"] })] })] }));
}
