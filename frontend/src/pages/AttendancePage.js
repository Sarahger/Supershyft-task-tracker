import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isToday, parseISO, startOfWeek } from 'date-fns';
import { Shield } from 'lucide-react';
import { attendanceApi } from '../services/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { canAccessAttendanceHr } from '../lib/roles';
import { toast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { AttendanceTodayHero } from '../components/attendance/AttendanceTodayHero';
import { AttendanceWeekStrip } from '../components/attendance/AttendanceWeekStrip';
import { AttendanceSummaryCard } from '../components/attendance/AttendanceSummaryCard';
import { AttendanceCalendar } from '../components/attendance/AttendanceCalendar';
import { AttendanceMarkModal } from '../components/attendance/AttendanceMarkModal';
import { isAttendanceEditableDay } from '../components/attendance/attendanceUtils';
function toIsoDate(d) {
    return format(d, 'yyyy-MM-dd');
}
export default function AttendancePage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const now = new Date();
    const [month, setMonth] = useState(now);
    const [showTodayModal, setShowTodayModal] = useState(false);
    const [markSuccess, setMarkSuccess] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const year = month.getFullYear();
    const monthNum = month.getMonth() + 1;
    const { data, isLoading } = useQuery({
        queryKey: ['attendance', 'me', year, monthNum],
        queryFn: () => attendanceApi.me({ year, month: monthNum }).then((r) => r.data.data),
    });
    useEffect(() => {
        if (data && !data.today_record && !markSuccess && !editTarget) {
            setShowTodayModal(true);
        }
    }, [data, markSuccess, editTarget]);
    const markMutation = useMutation({
        mutationFn: ({ status, date }) => attendanceApi.mark(status, date).then((r) => r.data.data),
        onSuccess: (_record, vars) => {
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            const forToday = !vars.date || vars.date === (data?.today ?? toIsoDate(new Date()));
            setMarkSuccess(true);
            toast.success(forToday ? 'Attendance saved — See you today' : 'Attendance saved');
            setTimeout(() => {
                setMarkSuccess(false);
                setShowTodayModal(false);
                setEditTarget(null);
            }, 1000);
        },
        onError: (err) => {
            const msg = err?.response?.data?.detail ||
                'Could not save attendance';
            toast.error(typeof msg === 'string' ? msg : 'Could not save attendance');
        },
    });
    const handleMarkStatus = (status, date) => {
        markMutation.mutate({ status, date });
    };
    const weekStart = data?.today
        ? startOfWeek(parseISO(data.today), { weekStartsOn: 1 })
        : startOfWeek(now, { weekStartsOn: 1 });
    const openDayEditor = (day, record) => {
        if (!isAttendanceEditableDay(day)) {
            toast.info('You can only mark or edit today and yesterday.');
            return;
        }
        if (isToday(day)) {
            setEditTarget(null);
            setShowTodayModal(true);
            return;
        }
        setShowTodayModal(false);
        setEditTarget({ day, record });
    };
    return (_jsxs("div", { className: "w-full h-[calc(100dvh-5.25rem)] flex flex-col gap-3 overflow-hidden max-md:h-auto max-md:overflow-visible", "data-testid": "attendance-page", children: [_jsxs("header", { className: "shrink-0 flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h1", { className: "text-xl font-semibold text-text-primary tracking-tight", children: "Attendance" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5 truncate", children: "Mark or edit today and yesterday only." })] }), canAccessAttendanceHr(user) && (_jsx("div", { className: "flex items-center gap-2 shrink-0", children: _jsx(Link, { to: "/attendance/hr", "data-testid": "link-attendance-hr", children: _jsxs(Button, { variant: "secondary", size: "sm", className: "gap-1.5", children: [_jsx(Shield, { className: "h-3.5 w-3.5" }), _jsx("span", { className: "hidden sm:inline", children: "HR overview" })] }) }) }))] }), _jsxs("div", { className: "flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 md:grid-rows-[auto_minmax(0,1fr)] gap-2.5 max-md:grid-rows-none max-md:auto-rows-min max-md:gap-3", children: [_jsx("div", { className: "md:col-span-5 min-h-0", children: _jsx(AttendanceTodayHero, { todayRecord: data?.today_record, showMarkModal: showTodayModal && !editTarget, markSuccess: markSuccess && !editTarget, marking: markMutation.isPending, onMark: (status) => handleMarkStatus(status), onOpenMark: () => {
                                setEditTarget(null);
                                setShowTodayModal(true);
                            }, onCloseMark: () => setShowTodayModal(false), loading: isLoading }) }), _jsx("div", { className: "md:col-span-7 min-h-0", children: _jsx(AttendanceWeekStrip, { week: data?.week ?? [], weekStart: weekStart, loading: isLoading }) }), _jsx("div", { className: "md:col-span-4 min-h-0 max-md:min-h-[11rem]", children: _jsx(AttendanceSummaryCard, { summary: data?.summary, loading: isLoading }) }), _jsx("div", { className: "md:col-span-8 min-h-0 relative max-md:min-h-[18rem]", children: _jsx(AttendanceCalendar, { month: month, records: data?.records ?? [], onMonthChange: setMonth, onSelect: (day, record) => openDayEditor(day, record), loading: isLoading }) })] }), _jsx(AttendanceMarkModal, { open: !!editTarget || (markSuccess && !!editTarget), loading: markMutation.isPending, success: markSuccess && !!editTarget, date: editTarget?.day, currentStatus: editTarget?.record?.status, isEdit: !!editTarget?.record, onSelect: (status) => editTarget && handleMarkStatus(status, toIsoDate(editTarget.day)), onClose: () => setEditTarget(null) })] }));
}
