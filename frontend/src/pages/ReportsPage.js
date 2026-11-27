import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, addMonths, endOfMonth, endOfQuarter, format, parseISO, startOfMonth, startOfQuarter } from 'date-fns';
import clsx from 'clsx';
import { reportsApi, departmentsApi } from '../services/endpoints';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { canAccessManagerFeatures } from '../lib/roles';
import { mondayOf } from '../lib/weeklyPlanParse';
import { OverviewCharts } from '../components/reports/OverviewCharts';
import { EvaluationsPanel } from '../components/reports/EvaluationsPanel';
function WorkloadBar({ person }) {
    const total = person.pending || 1;
    const segments = [
        { value: person.overdue, color: '#ef4444', label: 'Overdue' },
        { value: person.blocked, color: '#fb923c', label: 'Blocked' },
        { value: person.in_progress, color: '#fbbf24', label: 'In progress' },
        {
            value: Math.max(0, person.pending - person.overdue - person.blocked - person.in_progress),
            color: '#60a5fa',
            label: 'Other pending',
        },
    ].filter((s) => s.value > 0);
    return (_jsx("div", { className: "flex h-2 rounded-full overflow-hidden bg-dark-muted min-w-[80px]", title: `${person.pending} pending tasks`, children: segments.map((seg) => (_jsx("div", { style: { width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color } }, seg.label))) }));
}
function PersonWorkloadTable({ people }) {
    if (!people.length) {
        return _jsx("p", { className: "text-sm text-text-muted py-8 text-center", children: "No assigned tasks yet." });
    }
    return (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-dark-border text-left", children: [_jsx("th", { className: "px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider", children: "Person" }), _jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Pending" }), _jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "In progress" }), _jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Overdue" }), _jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Blocked" }), _jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Due this week" }), _jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider text-center", children: "Done" }), _jsx("th", { className: "px-4 py-3 text-2xs font-medium text-text-muted uppercase tracking-wider min-w-[120px]", children: "Load" })] }) }), _jsx("tbody", { children: people.map((person) => (_jsxs("tr", { className: "border-b border-dark-border hover:bg-dark-hover transition-colors", children: [_jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-center gap-3 min-w-[160px]", children: [_jsx(Avatar, { name: person.name, size: "sm" }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-medium text-text-primary truncate", children: person.name }), _jsx("p", { className: "text-xs text-text-muted truncate", children: person.departments?.length ? person.departments.join(', ') : 'No department' })] })] }) }), _jsx("td", { className: "px-3 py-3 text-center", children: _jsx("span", { className: clsx('font-semibold tabular-nums', person.pending > 0 ? 'metric-sky-strong' : 'text-text-muted'), children: person.pending }) }), _jsx("td", { className: "px-3 py-3 text-center tabular-nums metric-amber-strong", children: person.in_progress }), _jsx("td", { className: "px-3 py-3 text-center", children: _jsx("span", { className: clsx('tabular-nums font-medium', person.overdue > 0 ? 'metric-red' : 'text-text-muted'), children: person.overdue }) }), _jsx("td", { className: "px-3 py-3 text-center tabular-nums metric-orange-strong", children: person.blocked }), _jsx("td", { className: "px-3 py-3 text-center tabular-nums metric-purple-strong", children: person.due_this_week }), _jsx("td", { className: "px-3 py-3 text-center tabular-nums metric-emerald-strong", children: person.completed }), _jsx("td", { className: "px-4 py-3", children: _jsx(WorkloadBar, { person: person }) })] }, person.user_id))) })] }) }));
}
function iso(day) {
    return format(day, 'yyyy-MM-dd');
}
/** Inclusive span of at most one quarter (~3 calendar months). */
function clampToQuarterSpan(startStr, endStr) {
    const start = parseISO(startStr);
    let end = parseISO(endStr || startStr);
    if (Number.isNaN(start.getTime())) {
        const fallback = new Date();
        return { start: iso(fallback), end: iso(fallback) };
    }
    if (Number.isNaN(end.getTime()) || end < start)
        end = start;
    const maxEnd = addDays(addMonths(start, 3), -1);
    if (end > maxEnd)
        end = maxEnd;
    return { start: iso(start), end: iso(end) };
}
export default function ReportsPage() {
    const { user } = useAuth();
    const isManager = canAccessManagerFeatures(user);
    const [tab, setTab] = useState('overview');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [period, setPeriod] = useState('week');
    const [customStart, setCustomStart] = useState(iso(startOfMonth(new Date())));
    const [customEnd, setCustomEnd] = useState(iso(endOfMonth(new Date())));
    const [openEvaluationId, setOpenEvaluationId] = useState(null);
    const clearOpenedEvaluation = useCallback(() => setOpenEvaluationId(null), []);
    const reportFilters = useMemo(() => ({ department_id: departmentFilter ? Number(departmentFilter) : undefined }), [departmentFilter]);
    const departmentId = departmentFilter ? Number(departmentFilter) : undefined;
    const range = useMemo(() => {
        const now = new Date();
        if (period === 'week') {
            const start = mondayOf(now);
            return { start: iso(start), end: iso(addDays(start, 6)) };
        }
        if (period === 'quarter') {
            return { start: iso(startOfQuarter(now)), end: iso(endOfQuarter(now)) };
        }
        if (period === 'custom') {
            return clampToQuarterSpan(customStart, customEnd || customStart);
        }
        return { start: iso(startOfMonth(now)), end: iso(endOfMonth(now)) };
    }, [period, customStart, customEnd]);
    const customMaxEnd = useMemo(() => iso(addDays(addMonths(parseISO(customStart || iso(new Date())), 3), -1)), [customStart]);
    const { data, isLoading } = useQuery({
        queryKey: ['reports', reportFilters],
        queryFn: () => reportsApi.tasks(reportFilters).then((r) => r.data.data),
        enabled: isManager,
    });
    const { data: departments } = useQuery({
        queryKey: ['departments'],
        queryFn: () => departmentsApi.list().then((r) => r.data.data),
        enabled: isManager,
    });
    const handleExport = async () => {
        try {
            const response = await reportsApi.exportCsv(reportFilters);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'tasks_report.csv';
            a.click();
            toast.success('Report exported');
        }
        catch {
            toast.error('Export failed');
        }
    };
    if (!isManager) {
        return (_jsx("div", { className: "max-w-workspace mx-auto pb-12", children: _jsx(PageHeader, { title: "Reports", subtitle: "Reports are available to managers and admins." }) }));
    }
    if (isLoading) {
        return (_jsxs("div", { className: "max-w-workspace mx-auto pb-12 space-y-4", children: [_jsx("div", { className: "animate-pulse h-10 w-48 bg-dark-muted rounded-lg" }), _jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: Array.from({ length: 3 }).map((_, i) => (_jsx("div", { className: "h-72 bg-dark-muted rounded-lg animate-pulse" }, i))) })] }));
    }
    return (_jsxs("div", { className: "max-w-workspace mx-auto pb-12 space-y-8", children: [_jsx(PageHeader, { title: "Reports", subtitle: "See who has work pending, what needs attention, and how the team is progressing", action: _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [departments && departments.length > 0 && (_jsxs("select", { value: departmentFilter, onChange: (e) => setDepartmentFilter(e.target.value), className: "input py-1.5 text-sm w-auto", "aria-label": "Filter by department", children: [_jsx("option", { value: "", children: "All departments" }), departments.map((d) => (_jsx("option", { value: d.id, children: d.name }, d.id)))] })), tab === 'overview' && (_jsxs("select", { value: period, onChange: (e) => setPeriod(e.target.value), className: "input py-1.5 text-sm w-auto", "aria-label": "Reporting time frame", children: [_jsx("option", { value: "week", children: "This week" }), _jsx("option", { value: "month", children: "This month" }), _jsx("option", { value: "quarter", children: "This quarter" }), _jsx("option", { value: "custom", children: "Custom range" })] })), tab === 'overview' && period === 'custom' && (_jsxs(_Fragment, { children: [_jsx("input", { type: "date", className: "input py-1.5 text-sm w-auto", value: customStart, max: customEnd, onChange: (e) => {
                                        const next = clampToQuarterSpan(e.target.value, customEnd);
                                        setCustomStart(next.start);
                                        setCustomEnd(next.end);
                                    }, "aria-label": "Start date" }), _jsx("input", { type: "date", className: "input py-1.5 text-sm w-auto", value: customEnd, min: customStart, max: customMaxEnd, onChange: (e) => {
                                        const next = clampToQuarterSpan(customStart, e.target.value);
                                        setCustomStart(next.start);
                                        setCustomEnd(next.end);
                                    }, "aria-label": "End date" })] })), _jsx(Button, { variant: "secondary", onClick: handleExport, children: "Export CSV" })] }) }), _jsx("div", { className: "flex gap-2 border-b border-dark-border", children: [
                    ['overview', 'Overview'],
                    ['evaluations', 'Evaluations'],
                ].map(([id, label]) => (_jsx("button", { type: "button", onClick: () => setTab(id), className: clsx('px-3 py-2 text-sm border-b-2 -mb-px', tab === id ? 'border-accent-primary text-text-primary' : 'border-transparent text-text-muted'), children: label }, id))) }), tab === 'overview' ? (_jsxs(_Fragment, { children: [_jsx(OverviewCharts, { departmentId: departmentId, start: range.start, end: range.end, people: data?.by_assignee ?? [], onOpenEvaluation: (id) => {
                            setOpenEvaluationId(id);
                            setTab('evaluations');
                        } }), _jsxs("section", { className: "card overflow-hidden", children: [_jsxs("div", { className: "px-6 py-5 border-b border-dark-border", children: [_jsx("h2", { className: "text-sm font-medium text-text-primary", children: "Workload by person" }), _jsx("p", { className: "text-xs text-text-muted mt-1", children: "Pending tasks per team member \u2014 sorted by who has the most open work" })] }), _jsx(PersonWorkloadTable, { people: data?.by_assignee ?? [] })] })] })) : (_jsx(EvaluationsPanel, { departmentId: departmentId, initialEvaluationId: openEvaluationId, onConsumedInitial: clearOpenedEvaluation }))] }));
}
