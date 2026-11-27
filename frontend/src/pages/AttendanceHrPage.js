import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isAfter, startOfDay, startOfWeek, addDays } from 'date-fns';
import { CalendarDays, Download, X } from 'lucide-react';
import clsx from 'clsx';
import { attendanceApi } from '../services/endpoints';
import { AttendanceHrStats, ATTENDANCE_HR_STAT_LABELS } from '../components/attendance/AttendanceHrStats';
import { AttendanceHrPeopleModal } from '../components/attendance/AttendanceHrPeopleModal';
import { AttendanceHrDayTable } from '../components/attendance/AttendanceHrDayTable';
import { AttendanceHrWeekTable } from '../components/attendance/AttendanceHrWeekTable';
import { AttendanceEmployeeDrawer } from '../components/attendance/AttendanceEmployeeDrawer';
import { AttendanceCalendar } from '../components/attendance/AttendanceCalendar';
import { AttendanceMarkModal } from '../components/attendance/AttendanceMarkModal';
import { isAttendanceHrEditableDay } from '../components/attendance/attendanceUtils';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
function toIsoDate(d) {
    return format(d, 'yyyy-MM-dd');
}
export default function AttendanceHrPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
    const [calendarMonth, setCalendarMonth] = useState(() => startOfDay(new Date()));
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [view, setView] = useState('day');
    const [drawerUserId, setDrawerUserId] = useState(null);
    const [statKey, setStatKey] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [markTarget, setMarkTarget] = useState(null);
    const [markSuccess, setMarkSuccess] = useState(false);
    const dayIso = toIsoDate(selectedDay);
    const weekStart = startOfWeek(selectedDay, { weekStartsOn: 1 });
    const weekStartIso = toIsoDate(weekStart);
    const { data, isLoading } = useQuery({
        queryKey: ['attendance', 'day', dayIso],
        queryFn: () => attendanceApi.day({ day: dayIso }).then((r) => r.data.data),
    });
    const { data: weekData, isLoading: weekLoading } = useQuery({
        queryKey: ['attendance', 'week', weekStartIso],
        queryFn: () => attendanceApi.week({ week_start: weekStartIso }).then((r) => r.data.data),
        enabled: view === 'week',
    });
    const markMutation = useMutation({
        mutationFn: ({ status, date, userId, }) => attendanceApi.mark(status, date, userId).then((r) => r.data.data),
        onSuccess: () => {
            setMarkSuccess(true);
            toast.success('Attendance saved');
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            setTimeout(() => {
                setMarkSuccess(false);
                setMarkTarget(null);
            }, 900);
        },
        onError: (err) => {
            const msg = err?.response?.data?.detail ||
                'Could not save attendance';
            toast.error(typeof msg === 'string' ? msg : 'Could not save attendance');
        },
    });
    const openMark = (target) => {
        if (!isAttendanceHrEditableDay(target.day)) {
            toast.info('Future dates are not available.');
            return;
        }
        setMarkTarget(target);
    };
    const handleExport = async () => {
        setExporting(true);
        try {
            const response = await attendanceApi.exportCsv({
                year: selectedDay.getFullYear(),
                month: selectedDay.getMonth() + 1,
                status: 'ALL',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'attendance_export.csv';
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('Export downloaded');
        }
        catch {
            toast.error('Export failed');
        }
        finally {
            setExporting(false);
        }
    };
    const pickDay = (day) => {
        if (isAfter(startOfDay(day), startOfDay(new Date()))) {
            toast.info('Future dates are not available.');
            return;
        }
        setSelectedDay(startOfDay(day));
        setCalendarOpen(false);
        setStatKey(null);
    };
    const people = (statKey && data?.stats?.people?.[statKey]) || [];
    const peopleTitle = statKey
        ? `${ATTENDANCE_HR_STAT_LABELS[statKey]} · ${people.length}`
        : '';
    const dayLabel = format(selectedDay, 'EEE, MMM d');
    const weekLabel = `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 5), 'MMM d')}`;
    return (_jsxs("div", { className: "w-full pb-12", "data-testid": "attendance-hr-page", children: [_jsx(PageHeader, { title: "Attendance \u2014 HR", subtitle: "Daily and weekly organization overview. Mark or edit attendance for anyone on any past day.", onMobileBack: () => navigate('/attendance'), action: _jsxs(Button, { variant: "secondary", loading: exporting, onClick: handleExport, "data-testid": "export-csv", className: "gap-1.5", children: [_jsx(Download, { className: "h-3.5 w-3.5" }), _jsx("span", { className: "hidden sm:inline", children: "Export CSV" })] }) }), _jsx(AttendanceHrStats, { stats: data?.stats, loading: isLoading, activeKey: statKey, onSelect: setStatKey }), _jsx("div", { className: "sticky top-0 z-20 mt-6 mb-4 py-3 bg-dark-bg border-b border-dark-border", children: _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-xs font-medium text-text-secondary", children: view === 'day' ? 'Day' : 'Week' }), _jsx("p", { className: "text-sm font-semibold text-text-primary truncate", "data-testid": "hr-selected-day", children: view === 'day' ? dayLabel : weekLabel })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsxs("div", { className: "flex rounded-lg border border-dark-border overflow-hidden bg-dark-card", children: [_jsx("button", { type: "button", onClick: () => setView('day'), "data-testid": "hr-view-day", className: clsx('px-3 py-2 text-xs font-medium min-h-[36px] transition-colors duration-hover', view === 'day'
                                                ? 'bg-surface-highlight text-text-primary'
                                                : 'text-text-muted hover:text-text-secondary'), children: "Day" }), _jsx("button", { type: "button", onClick: () => setView('week'), "data-testid": "hr-view-week", className: clsx('px-3 py-2 text-xs font-medium min-h-[36px] transition-colors duration-hover', view === 'week'
                                                ? 'bg-surface-highlight text-text-primary'
                                                : 'text-text-muted hover:text-text-secondary'), children: "Week" })] }), _jsxs(Button, { type: "button", variant: "secondary", size: "sm", className: "gap-1.5", onClick: () => {
                                        setCalendarMonth(selectedDay);
                                        setCalendarOpen(true);
                                    }, "data-testid": "hr-open-calendar", "aria-label": view === 'day' ? 'Pick a day' : 'Pick a week', children: [_jsx(CalendarDays, { className: "h-3.5 w-3.5" }), _jsx("span", { className: "hidden sm:inline", children: view === 'day' ? 'Change day' : 'Change week' })] })] })] }) }), _jsxs("section", { className: "workspace-section !mb-0", children: [_jsxs("h2", { className: "workspace-section-title", children: ["Attendance \u00B7 ", view === 'day' ? dayLabel : weekLabel] }), view === 'day' ? (_jsx(AttendanceHrDayTable, { rows: data?.rows ?? [], loading: isLoading, selectedDay: selectedDay, onSelectUser: setDrawerUserId, onMarkUser: openMark })) : (_jsx(AttendanceHrWeekTable, { week: weekData, loading: weekLoading, onSelectUser: setDrawerUserId, onMarkCell: openMark }))] }), calendarOpen && (_jsxs("div", { className: "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4", children: [_jsx("div", { className: "fixed inset-0 bg-[var(--overlay-backdrop)]", onClick: () => setCalendarOpen(false) }), _jsxs("div", { className: clsx('relative w-full sm:max-w-md bg-dark-card border border-dark-border', 'rounded-t-2xl sm:rounded-2xl max-h-[min(90dvh,640px)] overflow-y-auto', 'pb-[env(safe-area-inset-bottom,0px)]'), role: "dialog", "aria-modal": "true", "aria-label": view === 'day' ? 'Select day' : 'Select week', "data-testid": "hr-calendar-popup", children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3 border-b border-dark-border", children: [_jsx("h2", { className: "text-base font-semibold text-text-primary", children: view === 'day' ? 'Select day' : 'Select a day in the week' }), _jsx("button", { type: "button", onClick: () => setCalendarOpen(false), className: "p-1.5 rounded-md text-text-muted hover:bg-dark-hover", "aria-label": "Close", children: _jsx(X, { className: "h-4 w-4" }) })] }), _jsx("div", { className: "p-3", children: _jsx(AttendanceCalendar, { month: calendarMonth, records: [], selected: selectedDay, onMonthChange: setCalendarMonth, onSelect: (day) => pickDay(day) }) })] })] })), _jsx(AttendanceHrPeopleModal, { open: !!statKey, title: peopleTitle, people: people, onClose: () => setStatKey(null), onSelectUser: setDrawerUserId }), _jsx(AttendanceEmployeeDrawer, { userId: drawerUserId, onClose: () => setDrawerUserId(null) }), _jsx(AttendanceMarkModal, { open: !!markTarget, loading: markMutation.isPending, success: markSuccess, date: markTarget?.day, currentStatus: markTarget?.status, isEdit: !!markTarget?.status, personName: markTarget?.userName, onSelect: (status) => markTarget &&
                    markMutation.mutate({
                        status,
                        date: toIsoDate(markTarget.day),
                        userId: markTarget.userId,
                    }), onClose: () => setMarkTarget(null) })] }));
}
