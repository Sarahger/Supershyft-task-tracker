import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Bar, BarChart, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
import { reportsApi } from '../../services/endpoints';
import { useTheme } from '../../contexts/ThemeContext';
import { getChartTheme } from '../../lib/chartTheme';
import { STATUS_LABELS } from '../../types';
const STATUS_COLORS = {
    unassigned: '#94a3b8',
    backlog: '#64748b',
    to_do: '#60a5fa',
    in_progress: '#fbbf24',
    blocked: '#ef4444',
    ready_for_review: '#a78bfa',
    in_review: '#c084fc',
    changes_requested: '#fb923c',
    approved: '#34d399',
    testing: '#22d3ee',
    bugs_found: '#fb7185',
    completed: '#10b981',
    cancelled: '#71717a',
};
function periodLabel(start) {
    return format(parseISO(start), 'MMM yyyy');
}
function ChartCard({ title, description, children, }) {
    return (_jsxs("section", { className: "card p-6 min-h-[280px]", children: [_jsx("h3", { className: "text-sm font-medium text-text-primary", children: title }), description && _jsx("p", { className: "text-xs text-text-muted mt-1 mb-4", children: description }), children] }));
}
function EmptyChart({ text }) {
    return _jsx("p", { className: "text-sm text-text-muted py-16 text-center", children: text });
}
export function OverviewCharts({ departmentId, start, end, people, onOpenEvaluation, }) {
    const { theme } = useTheme();
    const chartTheme = getChartTheme(theme);
    const { data, isLoading, isError } = useQuery({
        queryKey: ['reports-analytics', start, end, departmentId ?? null],
        queryFn: () => reportsApi.analytics({
            start_date: start,
            end_date: end,
            ...(departmentId ? { department_id: departmentId } : {}),
        }).then((r) => r.data.data),
        enabled: Boolean(start && end),
    });
    if (isLoading) {
        return (_jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: Array.from({ length: 3 }).map((_, i) => (_jsx("div", { className: "h-72 bg-dark-muted rounded-lg animate-pulse" }, i))) }));
    }
    if (isError || !data) {
        return _jsx("p", { className: "text-sm text-text-muted", children: "Could not load report charts." });
    }
    return (_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [_jsx(PerformersChart, { data: data, chartTheme: chartTheme, onOpen: onOpenEvaluation }), _jsx(StatusChart, { data: data, chartTheme: chartTheme }), _jsx("div", { className: "lg:col-span-2", children: _jsx(PendingWorkChart, { people: people, chartTheme: chartTheme }) })] }));
}
function StatusChart({ data, chartTheme, }) {
    const rows = data.by_status.map((row) => ({
        ...row,
        name: STATUS_LABELS[row.status] || row.status.replace(/_/g, ' '),
        fill: STATUS_COLORS[row.status] || '#71717a',
    }));
    return (_jsx(ChartCard, { title: "Tasks by Status", description: "How many current tasks sit in each status.", children: rows.length === 0 ? _jsx(EmptyChart, { text: "No tasks yet." }) : (_jsx(ResponsiveContainer, { width: "100%", height: Math.max(220, rows.length * 32), children: _jsxs(BarChart, { data: rows, layout: "vertical", margin: { left: 8, right: 16 }, children: [_jsx(XAxis, { type: "number", allowDecimals: false, tick: { fill: chartTheme.axisTick, fontSize: 11 }, axisLine: { stroke: chartTheme.axisLine }, tickLine: false }), _jsx(YAxis, { type: "category", dataKey: "name", width: 110, tick: { fill: chartTheme.axisTick, fontSize: 11 }, axisLine: false, tickLine: false }), _jsx(Tooltip, { contentStyle: chartTheme.tooltip, cursor: { fill: chartTheme.cursor } }), _jsx(Bar, { dataKey: "count", radius: [0, 4, 4, 0], barSize: 14, children: rows.map((row) => (_jsx(Cell, { fill: row.fill }, row.status))) })] }) })) }));
}
function chartFirstName(name, taken) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0] || name;
    if ((taken.get(first) ?? 0) < 2)
        return first;
    const last = parts[1];
    return last ? `${first} ${last[0]}` : first;
}
function PendingWorkChart({ people, chartTheme, }) {
    const ranked = people
        .filter((person) => person.pending > 0)
        .slice()
        .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));
    const firstCounts = new Map();
    ranked.forEach((person) => {
        const first = person.name.trim().split(/\s+/)[0] || person.name;
        firstCounts.set(first, (firstCounts.get(first) ?? 0) + 1);
    });
    const rows = ranked.map((person) => ({
        name: chartFirstName(person.name, firstCounts),
        fullName: person.name,
        pending: Math.max(0, person.pending - person.overdue),
        overdue: person.overdue,
    }));
    return (_jsx(ChartCard, { title: "Who has the most pending work?", description: "Blue = pending \u00B7 Red segment = overdue within pending", children: rows.length === 0 ? _jsx(EmptyChart, { text: "Nobody has pending work." }) : (_jsx(ResponsiveContainer, { width: "100%", height: 280, children: _jsxs(BarChart, { data: rows, margin: { left: 0, right: 8, top: 8 }, children: [_jsx(XAxis, { dataKey: "name", tick: { fill: chartTheme.axisTick, fontSize: 12 }, axisLine: { stroke: chartTheme.axisLine }, tickLine: false }), _jsx(YAxis, { allowDecimals: false, tick: { fill: chartTheme.axisTick, fontSize: 11 }, axisLine: false, tickLine: false, width: 32 }), _jsx(Tooltip, { contentStyle: chartTheme.tooltip, cursor: { fill: chartTheme.cursor }, content: ({ active, payload }) => {
                            if (!active || !payload?.length)
                                return null;
                            const row = payload[0].payload;
                            return (_jsxs("div", { style: chartTheme.tooltip, className: "px-3 py-2", children: [_jsx("p", { children: row.fullName }), _jsxs("p", { children: ["Pending ", row.pending + row.overdue] }), _jsxs("p", { children: ["Overdue ", row.overdue] })] }));
                        } }), _jsx(Legend, { iconType: "square", formatter: (value) => _jsx("span", { style: { color: chartTheme.axisTick }, children: value }) }), _jsx(Bar, { dataKey: "pending", name: "Pending", stackId: "work", fill: "#3b82f6", maxBarSize: 56 }), _jsx(Bar, { dataKey: "overdue", name: "Overdue", stackId: "work", fill: "#ef4444", maxBarSize: 56, radius: [4, 4, 0, 0] })] }) })) }));
}
function PerformersChart({ data, chartTheme, onOpen, }) {
    const rows = data.top_performers.map((row) => ({
        ...row,
        label: `${row.name} · ${periodLabel(row.period_start)} avg`,
    }));
    return (_jsx(ChartCard, { title: "Top-Performing Employees", description: "Monthly average of finalized period scores. Drafts are not included.", children: rows.length === 0 ? _jsx(EmptyChart, { text: "No finalized evaluations for this period." }) : (_jsx(ResponsiveContainer, { width: "100%", height: Math.max(240, rows.length * 36), children: _jsxs(BarChart, { data: rows, layout: "vertical", margin: { left: 8, right: 24 }, children: [_jsx(XAxis, { type: "number", domain: [0, 100], tick: { fill: chartTheme.axisTick, fontSize: 11 }, axisLine: { stroke: chartTheme.axisLine }, tickLine: false }), _jsx(YAxis, { type: "category", dataKey: "name", width: 120, tick: { fill: chartTheme.axisTick, fontSize: 11 }, axisLine: false, tickLine: false }), _jsx(Tooltip, { contentStyle: chartTheme.tooltip, formatter: (value, _name, item) => {
                            const row = item.payload;
                            const count = row.evaluation_count ?? 1;
                            return [
                                `${value}/100 · ${periodLabel(row.period_start)} avg (${count} period${count === 1 ? '' : 's'})`,
                                'Monthly avg',
                            ];
                        } }), _jsx(Bar, { dataKey: "score", fill: "#a78bfa", radius: [0, 4, 4, 0], barSize: 16, cursor: "pointer", onClick: (bar) => {
                            const row = bar.payload;
                            if (row?.evaluation_id)
                                onOpen(row.evaluation_id);
                        } })] }) })) }));
}
