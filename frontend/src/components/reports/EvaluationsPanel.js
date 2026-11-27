import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, endOfMonth, format, getDaysInMonth, parseISO, startOfMonth, } from 'date-fns';
import { reportsApi } from '../../services/endpoints';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { toast } from '../ui/Toast';
const FALLBACK_PARAMETERS = [
    { key: 'deadline_adherence', name: 'Deadline Adherence', weight: 30 },
    { key: 'quality_of_work', name: 'Quality of Work', weight: 25 },
    { key: 'discipline_process', name: 'Discipline & Process Adherence', weight: 15 },
    { key: 'ownership_accountability', name: 'Ownership & Accountability', weight: 15 },
    { key: 'teamwork_collaboration', name: 'Teamwork & Collaboration', weight: 10 },
    { key: 'punctuality', name: 'Punctuality', weight: 5 },
];
const RATING_PILL = {
    5: { selected: 'border border-emerald-400/50 bg-emerald-500/30 text-emerald-300', idle: 'border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15', text: 'text-emerald-400' },
    4: { selected: 'border border-lime-400/50 bg-lime-500/30 text-lime-300', idle: 'border border-lime-500/40 text-lime-400 hover:bg-lime-500/15', text: 'text-lime-400' },
    3: { selected: 'border border-amber-400/50 bg-amber-400/30 text-amber-200', idle: 'border border-amber-400/40 text-amber-300 hover:bg-amber-400/15', text: 'text-amber-300' },
    2: { selected: 'border border-orange-400/50 bg-orange-500/30 text-orange-300', idle: 'border border-orange-500/40 text-orange-400 hover:bg-orange-500/15', text: 'text-orange-400' },
    1: { selected: 'border border-red-400/50 bg-red-500/30 text-red-300', idle: 'border border-red-500/40 text-red-400 hover:bg-red-500/15', text: 'text-red-400' },
};
function ratingTone(rating) {
    return rating != null ? RATING_PILL[rating] : undefined;
}
/** Map overall /100 into the same 5 color bands as ratings 1–5. */
function scoreBand(score) {
    if (score == null || Number.isNaN(score))
        return null;
    if (score <= 20)
        return 1;
    if (score <= 40)
        return 2;
    if (score <= 60)
        return 3;
    if (score <= 80)
        return 4;
    return 5;
}
function scoreTone(score) {
    return ratingTone(scoreBand(score));
}
const FALLBACK_SCALE = [
    { rating: 5, meaning: 'Exceptional', interpretation: 'Consistently exceeds agreed expectations' },
    { rating: 4, meaning: 'Very Good', interpretation: 'Frequently exceeds expectations' },
    { rating: 3, meaning: 'Meets Expectations', interpretation: 'Reliably delivers what is expected' },
    { rating: 2, meaning: 'Needs Improvement', interpretation: 'Inconsistently meets expectations' },
    { rating: 1, meaning: 'Unsatisfactory', interpretation: 'Frequently falls significantly short of expectations' },
];
function currentMonth() {
    return format(new Date(), 'yyyy-MM');
}
function monthStart(month) {
    return `${month}-01`;
}
function monthLabel(value) {
    if (!value)
        return '—';
    try {
        return format(parseISO(value.slice(0, 10)), 'MMMM yyyy');
    }
    catch {
        return value;
    }
}
function dateLabel(value) {
    if (!value)
        return '—';
    try {
        return format(parseISO(value), 'd MMM yyyy');
    }
    catch {
        return value;
    }
}
function rangeLabel(start, end) {
    if (!start)
        return '—';
    const endValue = end || start;
    try {
        const a = parseISO(start.slice(0, 10));
        const b = parseISO(endValue.slice(0, 10));
        if (format(a, 'yyyy-MM-dd') === format(b, 'yyyy-MM-dd')) {
            return format(a, 'd MMM yyyy');
        }
        if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
            return `${format(a, 'd')} – ${format(b, 'd MMM yyyy')}`;
        }
        return `${format(a, 'd MMM')} – ${format(b, 'd MMM yyyy')}`;
    }
    catch {
        return `${start} – ${endValue}`;
    }
}
function previewScore(rating, weight) {
    if (rating == null)
        return null;
    return Math.round((rating / 5) * weight * 100) / 100;
}
function errorMessage(err, fallback) {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string')
        return detail;
    if (err instanceof Error && err.message)
        return err.message;
    return fallback;
}
function fullMonthRange(month) {
    const begin = startOfMonth(parseISO(monthStart(month)));
    return {
        start: format(begin, 'yyyy-MM-dd'),
        end: format(endOfMonth(begin), 'yyyy-MM-dd'),
    };
}
function isFullMonthRange(startIso, endIso) {
    try {
        const start = parseISO(startIso.slice(0, 10));
        const end = parseISO(endIso.slice(0, 10));
        return (format(start, 'yyyy-MM-dd') === format(startOfMonth(start), 'yyyy-MM-dd')
            && format(end, 'yyyy-MM-dd') === format(endOfMonth(start), 'yyyy-MM-dd'));
    }
    catch {
        return false;
    }
}
/** Keep week ranges inside one calendar month, at least 7 days. */
function clampWeekRange(startIso, endIso) {
    let start = parseISO(startIso);
    let end = parseISO(endIso);
    const monthBegin = startOfMonth(start);
    const monthFinish = endOfMonth(start);
    if (end.getMonth() !== start.getMonth() || end.getFullYear() !== start.getFullYear()) {
        end = monthFinish;
    }
    if (end < start)
        end = start;
    const minEnd = addDays(start, 6);
    if (end < minEnd) {
        end = minEnd > monthFinish ? monthFinish : minEnd;
    }
    if (end > monthFinish)
        end = monthFinish;
    const maxStart = addDays(monthFinish, -6);
    if (start > maxStart && getDaysInMonth(monthBegin) >= 7) {
        start = maxStart < monthBegin ? monthBegin : maxStart;
        end = monthFinish;
    }
    return {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
    };
}
function defaultWeekRange(month) {
    const begin = startOfMonth(parseISO(monthStart(month)));
    return clampWeekRange(format(begin, 'yyyy-MM-dd'), format(addDays(begin, 6), 'yyyy-MM-dd'));
}
function blankScores(parameters) {
    return parameters.map((row) => ({
        parameter_key: row.key,
        name: row.name,
        weight: row.weight,
        rating: null,
        remarks: '',
    }));
}
function scoresFromRecord(record, parameters) {
    return parameters.map((row) => {
        const existing = record.scores.find((score) => score.parameter_key === row.key);
        return {
            parameter_key: row.key,
            name: row.name,
            weight: row.weight,
            rating: existing?.rating ?? null,
            remarks: existing?.remarks ?? '',
        };
    });
}
function statusLabel(status) {
    return status.replace('_', ' ');
}
function shortLeaveDay(value) {
    try {
        return format(parseISO(value.slice(0, 10)), 'd MMM');
    }
    catch {
        return value;
    }
}
function leaveTableLine(days) {
    if (!days?.length)
        return null;
    const leave = days.filter((d) => d.status === 'LEAVE').map((d) => shortLeaveDay(d.date));
    const half = days.filter((d) => d.status === 'HALF_DAY').map((d) => shortLeaveDay(d.date));
    const parts = [];
    if (leave.length)
        parts.push(`Leave: ${leave.join(', ')}`);
    if (half.length)
        parts.push(`Half day: ${half.join(', ')}`);
    return parts.join(' · ') || null;
}
export function EvaluationsPanel({ departmentId, initialEvaluationId, onConsumedInitial, }) {
    const qc = useQueryClient();
    const [month, setMonth] = useState(currentMonth());
    const [employeeFilter, setEmployeeFilter] = useState('');
    const [editing, setEditing] = useState(null);
    const [startUserId, setStartUserId] = useState(null);
    const [viewId, setViewId] = useState(null);
    const [expanded, setExpanded] = useState({});
    const { data: list, isLoading } = useQuery({
        queryKey: ['evaluations', month, departmentId ?? null],
        queryFn: () => reportsApi.evaluations({
            period_start: monthStart(month),
            ...(departmentId ? { department_id: departmentId } : {}),
        }).then((r) => r.data.data),
    });
    const parameters = list?.parameters?.length ? list.parameters : FALLBACK_PARAMETERS;
    const scale = list?.rating_scale?.length ? list.rating_scale : FALLBACK_SCALE;
    const items = useMemo(() => {
        const rows = list?.items ?? [];
        if (!employeeFilter)
            return rows;
        return rows.filter((row) => row.user_id === Number(employeeFilter));
    }, [list, employeeFilter]);
    useEffect(() => {
        if (!initialEvaluationId)
            return;
        setViewId(initialEvaluationId);
        setEditing(null);
        onConsumedInitial?.();
    }, [initialEvaluationId, onConsumedInitial]);
    const refresh = () => {
        qc.invalidateQueries({ queryKey: ['evaluations'] });
        qc.invalidateQueries({ queryKey: ['evaluation'] });
        qc.invalidateQueries({ queryKey: ['evaluation-history'] });
        qc.invalidateQueries({ queryKey: ['reports-analytics'] });
    };
    const toggleExpanded = (userId) => {
        setExpanded((prev) => ({ ...prev, [userId]: !prev[userId] }));
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-sm font-medium text-text-primary", children: "Employee Evaluations" }), _jsx("p", { className: "text-xs text-text-muted mt-1", children: "Evaluate weekly, bi-weekly, or monthly (same calendar month, no overlapping periods). The monthly score is the average of all submitted period scores." })] }), _jsx(Button, { type: "button", onClick: () => { setStartUserId(null); setEditing('new'); setViewId(null); }, children: "New Evaluation" })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("select", { className: "input py-1.5 text-sm w-auto", value: employeeFilter, onChange: (e) => setEmployeeFilter(e.target.value), "aria-label": "Filter by employee", children: [_jsx("option", { value: "", children: "All employees" }), (list?.items ?? []).map((row) => (_jsx("option", { value: row.user_id, children: row.name }, row.user_id)))] }), _jsx("input", { type: "month", className: "input py-1.5 text-sm w-auto", value: month, onChange: (e) => setMonth(e.target.value || currentMonth()), "aria-label": "Comparison month" })] }), _jsx(Modal, { isOpen: Boolean(editing), onClose: () => setEditing(null), title: editing && editing !== 'new' ? 'Edit evaluation' : 'New evaluation', size: "2xl", children: editing && (_jsx(EvaluationForm, { mode: editing, month: month, employees: list?.items ?? [], initialUserId: startUserId, parameters: parameters, scale: scale, onClose: () => setEditing(null), onSaved: (record) => {
                        refresh();
                        setEditing(null);
                        setViewId(record.id);
                    } })) }), _jsx(Modal, { isOpen: viewId != null && !editing, onClose: () => setViewId(null), title: "Evaluation", size: "2xl", children: viewId != null && !editing && (_jsx(EvaluationDetail, { evaluationId: viewId, onEdit: (record) => setEditing(record) })) }), _jsx("section", { className: "card overflow-hidden", children: isLoading ? (_jsx("p", { className: "text-sm text-text-muted p-6", children: "Loading evaluations\u2026" })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-dark-border text-left", children: [_jsx("th", { className: "px-4 py-3 text-2xs font-medium text-text-muted uppercase", children: "Employee" }), _jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase", children: "Periods" }), _jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase", children: "Monthly avg" }), _jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase", children: "Status" }), _jsx("th", { className: "px-3 py-3 text-2xs font-medium text-text-muted uppercase", children: "Last evaluated" }), _jsx("th", { className: "px-4 py-3 text-2xs font-medium text-text-muted uppercase", children: "Action" })] }) }), _jsxs("tbody", { children: [items.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-4 py-8 text-center text-text-muted", children: "No employees match these filters." }) })), items.map((row) => {
                                        const periods = row.evaluations ?? [];
                                        const isOpen = Boolean(expanded[row.user_id]);
                                        const leaveLine = leaveTableLine(row.leave_days);
                                        const deptLine = row.departments.length ? row.departments.join(', ') : null;
                                        return (_jsxs(Fragment, { children: [_jsxs("tr", { className: "border-b border-dark-border", children: [_jsxs("td", { className: "px-4 py-3", children: [_jsx("p", { className: "text-text-primary", children: row.name }), (deptLine || leaveLine) && (_jsxs("div", { className: "mt-0.5 space-y-0.5 text-xs", children: [deptLine && _jsx("p", { className: "text-text-muted", children: deptLine }), leaveLine && _jsx("p", { className: "text-amber-400", children: leaveLine })] }))] }), _jsx("td", { className: "px-3 py-3 text-text-secondary", children: row.evaluation_count ? (_jsxs("button", { type: "button", className: "text-accent-primary hover:underline", onClick: () => toggleExpanded(row.user_id), children: [row.submitted_count ?? 0, "/", row.evaluation_count, " \u00B7 ", isOpen ? 'Hide' : 'Show'] })) : ('None') }), _jsx("td", { className: `px-3 py-3 tabular-nums font-medium ${scoreTone(row.monthly_average ?? row.overall_score)?.text ?? 'text-text-muted'}`, children: (row.monthly_average ?? row.overall_score) == null
                                                                ? '—'
                                                                : `${row.monthly_average ?? row.overall_score}/100` }), _jsx("td", { className: "px-3 py-3 capitalize", children: statusLabel(row.status) }), _jsx("td", { className: "px-3 py-3 text-text-secondary", children: dateLabel(row.last_evaluated_at) }), _jsx("td", { className: "px-4 py-3", children: _jsx("button", { type: "button", className: "text-accent-primary hover:underline", onClick: () => { setStartUserId(row.user_id); setEditing('new'); setViewId(null); }, children: "Start" }) })] }), isOpen && periods.map((period) => (_jsxs("tr", { className: "border-b border-dark-border bg-dark-elevated/40", children: [_jsx("td", { className: "px-4 py-2 text-text-muted text-xs", children: "Period score" }), _jsx("td", { className: "px-3 py-2 text-text-secondary text-xs", children: rangeLabel(period.period_start, period.period_end) }), _jsx("td", { className: `px-3 py-2 tabular-nums text-xs ${scoreTone(period.overall_score)?.text ?? 'text-text-muted'}`, children: period.overall_score == null ? '—' : `${period.overall_score}/100` }), _jsx("td", { className: "px-3 py-2 capitalize text-xs", children: statusLabel(period.status) }), _jsx("td", { className: "px-3 py-2 text-text-secondary text-xs", children: dateLabel(period.submitted_at) }), _jsx("td", { className: "px-4 py-2", children: _jsx("button", { type: "button", className: "text-accent-primary hover:underline text-xs", onClick: () => { setViewId(period.evaluation_id); setEditing(null); }, children: "Open" }) })] }, `${row.user_id}-${period.evaluation_id}`)))] }, row.user_id));
                                    })] })] }) })) })] }));
}
function EvaluationForm({ mode, month, employees, initialUserId, parameters, scale, onClose, onSaved, }) {
    const existing = mode === 'new' ? null : mode;
    const initialRange = existing
        ? {
            start: existing.period_start.slice(0, 10),
            end: (existing.period_end || existing.period_start).slice(0, 10),
        }
        : defaultWeekRange(month);
    const initialMode = existing
        ? (isFullMonthRange(initialRange.start, initialRange.end) ? 'month' : 'week')
        : 'week';
    const [userId, setUserId] = useState(existing ? String(existing.user_id) : initialUserId ? String(initialUserId) : '');
    const [periodMode, setPeriodMode] = useState(initialMode);
    const [calendarMonth, setCalendarMonth] = useState(existing ? existing.period_start.slice(0, 7) : month);
    const [periodStart, setPeriodStart] = useState(initialRange.start);
    const [periodEnd, setPeriodEnd] = useState(initialRange.end);
    const [comment, setComment] = useState(existing?.overall_comment ?? '');
    const [scores, setScores] = useState(existing ? scoresFromRecord(existing, parameters) : blankScores(parameters));
    const [confirming, setConfirming] = useState(false);
    const [showRatingChart, setShowRatingChart] = useState(false);
    const appliedLeaveNote = useRef(existing?.overall_comment?.startsWith('Leave / half days in this period:')
        ? existing.overall_comment
        : null);
    const total = scores.reduce((sum, row) => sum + (previewScore(row.rating, row.weight) ?? 0), 0);
    const complete = scores.every((row) => row.rating != null);
    const locked = Boolean(existing);
    const { data: leaveContext } = useQuery({
        queryKey: ['evaluation-leave-context', userId, periodStart, periodEnd],
        queryFn: () => reportsApi.evaluationLeaveContext({
            user_id: Number(userId),
            period_start: periodStart,
            period_end: periodEnd,
        }).then((r) => r.data.data),
        enabled: Boolean(userId && periodStart && periodEnd),
    });
    const fullyOnLeave = Boolean(leaveContext?.fully_on_leave);
    const leaveLine = leaveTableLine(leaveContext?.leave_days);
    useEffect(() => {
        if (!userId || locked)
            return;
        const suggested = leaveContext?.suggested_comment ?? '';
        setComment((current) => {
            const untouched = !current.trim() || current === appliedLeaveNote.current;
            if (!untouched)
                return current;
            appliedLeaveNote.current = suggested || null;
            return suggested;
        });
    }, [userId, locked, leaveContext?.suggested_comment, leaveContext?.fully_on_leave, periodStart, periodEnd]);
    const switchMode = (next) => {
        setPeriodMode(next);
        if (next === 'month') {
            const range = fullMonthRange(calendarMonth);
            setPeriodStart(range.start);
            setPeriodEnd(range.end);
            return;
        }
        const range = defaultWeekRange(calendarMonth);
        setPeriodStart(range.start);
        setPeriodEnd(range.end);
    };
    const payload = () => ({
        user_id: Number(userId),
        period_start: periodStart,
        period_end: periodEnd,
        overall_comment: comment.trim() || null,
        scores: scores.map((row) => ({
            parameter_key: row.parameter_key,
            rating: row.rating,
            remarks: row.remarks.trim() || null,
        })),
    });
    const save = useMutation({
        mutationFn: async (submit) => {
            if (!userId)
                throw new Error('Select an employee');
            if (!periodStart || !periodEnd)
                throw new Error('Select an evaluation period');
            if (fullyOnLeave) {
                throw new Error('Cannot evaluate — employee was on leave for every working day in this period');
            }
            const body = payload();
            if (!existing) {
                const created = await reportsApi.createEvaluation(body);
                if (!submit)
                    return created.data.data;
                const submitted = await reportsApi.submitEvaluation(created.data.data.id, body);
                return submitted.data.data;
            }
            if (!submit) {
                const saved = await reportsApi.saveEvaluation(existing.id, body);
                return saved.data.data;
            }
            const submitted = await reportsApi.submitEvaluation(existing.id, body);
            return submitted.data.data;
        },
        onSuccess: (record, submit) => {
            toast.success(submit ? 'Evaluation submitted' : 'Draft saved');
            setConfirming(false);
            onSaved(record);
        },
        onError: (err) => toast.error(errorMessage(err, 'Could not save evaluation')),
    });
    return (_jsxs("div", { className: "space-y-5", children: [_jsx("div", { className: "flex justify-end", children: _jsx("button", { type: "button", onClick: () => setShowRatingChart((open) => !open), className: "text-sm text-accent-primary hover:underline", children: "Rating Chart" }) }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4", children: [_jsxs("div", { className: "shrink-0", children: [_jsx("span", { className: "block text-2xs uppercase tracking-wider text-text-muted mb-1.5", children: "Time frame" }), _jsx("div", { className: "flex flex-wrap gap-2", children: [
                                            ['week', 'Week'],
                                            ['month', 'Month'],
                                        ].map(([value, label]) => (_jsx("button", { type: "button", disabled: locked, onClick: () => switchMode(value), className: `rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${periodMode === value
                                                ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
                                                : 'border-dark-border text-text-secondary hover:bg-dark-hover'}`, children: label }, value))) })] }), periodMode === 'month' ? (_jsxs("label", { className: "block min-w-0 sm:max-w-xs flex-1", children: [_jsx("span", { className: "block text-2xs uppercase tracking-wider text-text-muted mb-1.5", children: "Month" }), _jsx("input", { type: "month", className: "input w-full text-sm", value: calendarMonth, disabled: locked, onChange: (e) => {
                                            const next = e.target.value || currentMonth();
                                            setCalendarMonth(next);
                                            const range = fullMonthRange(next);
                                            setPeriodStart(range.start);
                                            setPeriodEnd(range.end);
                                        } })] })) : (_jsxs("div", { className: "grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2", children: [_jsxs("label", { className: "block", children: [_jsx("span", { className: "block text-2xs uppercase tracking-wider text-text-muted mb-1.5", children: "Start date" }), _jsx("input", { type: "date", className: "input w-full text-sm", value: periodStart, disabled: locked, onChange: (e) => {
                                                    const nextStart = e.target.value;
                                                    const monthKey = nextStart.slice(0, 7);
                                                    setCalendarMonth(monthKey);
                                                    const clamped = clampWeekRange(nextStart, periodEnd.slice(0, 7) === monthKey ? periodEnd : format(addDays(parseISO(nextStart), 6), 'yyyy-MM-dd'));
                                                    setPeriodStart(clamped.start);
                                                    setPeriodEnd(clamped.end);
                                                } })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "block text-2xs uppercase tracking-wider text-text-muted mb-1.5", children: "End date" }), _jsx("input", { type: "date", className: "input w-full text-sm", value: periodEnd, min: periodStart, max: format(endOfMonth(parseISO(periodStart)), 'yyyy-MM-dd'), disabled: locked, onChange: (e) => {
                                                    const clamped = clampWeekRange(periodStart, e.target.value);
                                                    setPeriodStart(clamped.start);
                                                    setPeriodEnd(clamped.end);
                                                    setCalendarMonth(clamped.start.slice(0, 7));
                                                } })] })] }))] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "block text-2xs uppercase tracking-wider text-text-muted mb-1.5", children: "Employee" }), _jsxs("select", { className: "input w-full text-sm", value: userId, onChange: (e) => setUserId(e.target.value), disabled: locked, children: [_jsx("option", { value: "", children: "Select an employee" }), employees.map((row) => (_jsx("option", { value: row.user_id, children: row.name }, row.user_id)))] })] })] }), _jsxs("p", { className: "text-xs text-text-muted", children: [periodMode === 'month'
                        ? `Evaluating ${monthLabel(monthStart(calendarMonth))}.`
                        : `Evaluating ${rangeLabel(periodStart, periodEnd)}. Pick 1–3 weeks in the same month (at least 7 days).`, ' ', "Periods cannot overlap for the same person."] }), fullyOnLeave && (_jsx("p", { className: "rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300", children: "This employee was on leave for every working day in the selected time frame, so an evaluation cannot be created for it." })), !fullyOnLeave && leaveLine && (_jsxs("p", { className: "text-xs text-text-muted", children: ["Attendance in this time frame \u2014 ", leaveLine, ". This is added to overall comments by default."] })), showRatingChart && (_jsx("div", { className: "rounded-xl border border-dark-border overflow-x-auto", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-dark-border text-left", children: [_jsx("th", { className: "px-3 py-2 text-text-muted", children: "Rating" }), _jsx("th", { className: "px-3 py-2 text-text-muted", children: "Meaning" }), _jsx("th", { className: "px-3 py-2 text-text-muted", children: "Interpretation" })] }) }), _jsx("tbody", { children: scale.map((row) => (_jsxs("tr", { className: "border-b border-dark-border last:border-0", children: [_jsx("td", { className: "px-3 py-2 tabular-nums", children: row.rating }), _jsx("td", { className: "px-3 py-2", children: row.meaning }), _jsx("td", { className: "px-3 py-2 text-text-secondary", children: row.interpretation })] }, row.rating))) })] }) })), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("p", { className: "shrink-0 text-sm text-text-primary", children: ["Overall score", ' ', _jsx("span", { className: `tabular-nums font-medium ${complete ? (scoreTone(total)?.text ?? 'text-text-primary') : 'text-text-muted'}`, children: complete ? `${total}/100` : '—/100' })] }), _jsx("input", { className: "input w-full text-sm", placeholder: "Overall comments", value: comment, onChange: (e) => setComment(e.target.value) })] }), _jsx("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-3", children: scores.map((row, index) => (_jsxs("div", { className: "rounded-lg border border-dark-border px-3 py-2.5 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("p", { className: "text-sm text-text-primary leading-tight", children: row.name }), _jsx("div", { className: "flex shrink-0 gap-1", children: scale.map((choice) => (_jsx("button", { type: "button", className: `inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 ${row.rating === choice.rating ? ratingTone(choice.rating)?.selected : ratingTone(choice.rating)?.idle}`, onClick: () => setScores((prev) => prev.map((item, i) => i === index ? { ...item, rating: choice.rating } : item)), children: choice.rating }, choice.rating))) })] }), _jsx("input", { className: "input w-full text-xs py-1", placeholder: "Remarks", value: row.remarks, onChange: (e) => setScores((prev) => prev.map((item, i) => i === index ? { ...item, remarks: e.target.value } : item)) })] }, row.parameter_key))) }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: onClose, children: "Cancel" }), _jsx(Button, { type: "button", variant: "secondary", loading: save.isPending && !confirming, disabled: !userId || fullyOnLeave, onClick: () => save.mutate(false), children: "Save as Draft" }), _jsx(Button, { type: "button", onClick: () => setConfirming(true), disabled: !complete || !userId || fullyOnLeave, children: "Submit Evaluation" })] }), _jsx(Modal, { isOpen: confirming, onClose: () => setConfirming(false), title: "Submit evaluation", size: "sm", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("p", { className: "text-sm text-text-secondary", children: ["Submit this scorecard for ", rangeLabel(periodStart, periodEnd), "? The period score is ", total, "/100. It will count toward the ", monthLabel(monthStart(calendarMonth)), " average."] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: () => setConfirming(false), children: "Cancel" }), _jsx(Button, { type: "button", loading: save.isPending, onClick: () => save.mutate(true), children: "Submit" })] })] }) })] }));
}
function EvaluationDetail({ evaluationId, onEdit, }) {
    const { data } = useQuery({
        queryKey: ['evaluation', evaluationId],
        queryFn: () => reportsApi.evaluation(evaluationId).then((r) => r.data.data),
    });
    const userId = data?.user_id;
    const { data: history } = useQuery({
        queryKey: ['evaluation-history', userId],
        queryFn: () => reportsApi.evaluationHistory(userId).then((r) => r.data.data),
        enabled: userId != null,
    });
    if (!data)
        return _jsx("p", { className: "text-sm text-text-muted", children: "Loading evaluation\u2026" });
    const submitted = (history?.evaluations ?? []).filter((row) => row.status === 'submitted');
    const monthKey = data.period_start.slice(0, 7);
    const monthSubmitted = submitted.filter((row) => row.period_start.slice(0, 7) === monthKey);
    const monthlyAvg = monthSubmitted.length
        ? Math.round((monthSubmitted.reduce((sum, row) => sum + (row.overall_score ?? 0), 0) / monthSubmitted.length) * 100) / 100
        : null;
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-text-primary", children: data.employee?.name ?? 'Evaluation' }), _jsxs("p", { className: "text-xs text-text-muted mt-1", children: [data.department_snapshot || data.departments.join(', ') || 'No department', " \u00B7 ", rangeLabel(data.period_start, data.period_end), " \u00B7 ", data.status] }), _jsxs("p", { className: "text-xs text-text-muted mt-1", children: ["Evaluator ", data.evaluator?.name ?? '—', " \u00B7 Submitted ", dateLabel(data.submitted_at)] }), monthlyAvg != null && (_jsxs("p", { className: "text-xs text-text-muted mt-1", children: [monthLabel(data.period_start), " average (", monthSubmitted.length, " period", monthSubmitted.length === 1 ? '' : 's', "): ", monthlyAvg, "/100"] }))] }), _jsx("button", { type: "button", className: "text-sm text-accent-primary hover:underline", onClick: () => onEdit(data), children: "Edit" })] }), _jsxs("div", { className: "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", children: [_jsx("p", { className: `text-2xl font-semibold tabular-nums ${scoreTone(data.overall_score)?.text ?? 'text-text-muted'}`, children: data.overall_score == null ? '—' : `${data.overall_score}/100` }), _jsx("p", { className: "text-sm text-text-secondary sm:max-w-xl sm:text-right", children: data.overall_comment || 'No overall remarks' })] }), _jsx("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-3", children: data.scores.map((score) => (_jsxs("div", { className: "flex items-center justify-between gap-3 rounded-lg border border-dark-border px-3 py-2.5", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm text-text-primary leading-tight", children: score.name }), _jsxs("p", { className: `mt-0.5 text-xs ${ratingTone(score.rating)?.text ?? 'text-text-muted'}`, children: [score.rating ?? '—', "/5"] }), _jsx("p", { className: "mt-1 text-xs text-text-secondary", children: score.remarks || '—' })] }), _jsx("p", { className: `shrink-0 text-2xl font-semibold tabular-nums ${ratingTone(score.rating)?.text ?? 'text-text-primary'}`, children: score.weighted_score ?? '—' })] }, score.parameter_key))) }), submitted.length > 1 && (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wider text-text-muted", children: "Score comparison" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-dark-border text-left", children: [_jsx("th", { className: "px-3 py-2 text-text-muted", children: "Parameter" }), submitted.map((row) => (_jsx("th", { className: "px-3 py-2 text-text-muted whitespace-nowrap", children: rangeLabel(row.period_start, row.period_end) }, row.id)))] }) }), _jsxs("tbody", { children: [FALLBACK_PARAMETERS.map((parameter) => (_jsxs("tr", { className: "border-b border-dark-border", children: [_jsx("td", { className: "px-3 py-2", children: parameter.name }), submitted.map((row) => {
                                                    const score = row.scores.find((item) => item.parameter_key === parameter.key);
                                                    return _jsx("td", { className: "px-3 py-2 tabular-nums", children: score?.rating ?? '—' }, row.id);
                                                })] }, parameter.key))), _jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 font-medium", children: "Overall" }), submitted.map((row) => (_jsxs("td", { className: "px-3 py-2 tabular-nums", children: [row.overall_score ?? '—', "/100"] }, row.id)))] })] })] }) })] })), (data.revisions?.length ?? 0) > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wider text-text-muted", children: "Previous versions" }), data.revisions?.map((revision) => (_jsxs("div", { className: "rounded-xl border border-dark-border p-3 text-sm", children: [_jsxs("p", { className: "text-text-secondary", children: [revision.editor?.name ?? 'Someone', " changed this on ", dateLabel(revision.created_at), ". Previous score ", revision.snapshot.overall_score ?? '—', "/100."] }), revision.snapshot.overall_comment && (_jsx("p", { className: "text-text-muted mt-1", children: revision.snapshot.overall_comment }))] }, revision.id)))] }))] }));
}
