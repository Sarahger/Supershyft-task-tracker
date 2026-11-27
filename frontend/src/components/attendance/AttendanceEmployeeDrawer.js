import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isToday, parseISO } from 'date-fns';
import { attendanceApi } from '../../services/endpoints';
import { Drawer } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { toast } from '../ui/Toast';
import { AttendanceCalendar } from './AttendanceCalendar';
import { AttendanceMarkModal } from './AttendanceMarkModal';
import { AttendanceSummaryCard } from './AttendanceSummaryCard';
import { formatRecordedTime, isAttendanceHrEditableDay, statusLabel, } from './attendanceUtils';
function toIsoDate(d) {
    return format(d, 'yyyy-MM-dd');
}
export function AttendanceEmployeeDrawer({ userId, onClose }) {
    const queryClient = useQueryClient();
    const now = new Date();
    const [month, setMonth] = useState(now);
    const [selected, setSelected] = useState(null);
    const [markTarget, setMarkTarget] = useState(null);
    const [markSuccess, setMarkSuccess] = useState(false);
    const { data, isLoading } = useQuery({
        queryKey: ['attendance', 'user', userId, month.getFullYear(), month.getMonth() + 1],
        queryFn: () => attendanceApi
            .userDetail(userId, { year: month.getFullYear(), month: month.getMonth() + 1 })
            .then((r) => r.data.data),
        enabled: userId != null,
    });
    const personName = data
        ? `${data.user.first_name} ${data.user.last_name}`.trim()
        : '';
    const markMutation = useMutation({
        mutationFn: ({ status, date }) => attendanceApi.mark(status, date, userId).then((r) => r.data.data),
        onSuccess: (record) => {
            setMarkSuccess(true);
            toast.success('Attendance saved');
            setSelected({
                day: markTarget?.day ?? parseISO(record.attendance_date),
                record,
            });
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
    const openEditor = (day, record) => {
        setSelected({ day, record });
        if (!isAttendanceHrEditableDay(day)) {
            return;
        }
        setMarkTarget({ day, record });
    };
    return (_jsxs(_Fragment, { children: [_jsx(Drawer, { isOpen: userId != null, onClose: onClose, children: _jsx("div", { className: "px-6 pt-14 pb-8 space-y-6", "data-testid": "attendance-employee-drawer", children: isLoading || !data ? (_jsxs("div", { className: "space-y-3", children: [_jsx(Skeleton, { className: "h-12 w-48" }), _jsx(Skeleton, { className: "h-72 w-full" })] })) : (_jsxs(_Fragment, { children: [_jsxs("header", { className: "flex items-start gap-3", children: [_jsx(Avatar, { name: `${data.user.first_name} ${data.user.last_name}`, src: data.user.profile_picture, size: "lg" }), _jsxs("div", { className: "min-w-0", children: [_jsxs("h2", { className: "text-lg font-semibold text-text-primary truncate", children: [data.user.first_name, " ", data.user.last_name] }), _jsx("p", { className: "text-sm text-text-muted truncate", children: (data.user.departments || []).join(', ') || 'No department' }), _jsxs("p", { className: "text-xs text-text-muted capitalize mt-0.5", children: [data.user.role || '—', data.user.job_title ? ` · ${data.user.job_title}` : ''] })] })] }), _jsx(AttendanceCalendar, { month: month, records: data.records, selected: selected?.day, onMonthChange: (m) => {
                                    setMonth(m);
                                    setSelected(null);
                                }, onSelect: (day, record) => openEditor(day, record) }), selected && (_jsxs("div", { className: "card p-4 text-sm bg-surface-subtle space-y-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-text-primary", children: format(selected.day, 'EEEE, MMM d, yyyy') }), _jsx("p", { className: "text-text-secondary mt-1", children: statusLabel(selected.record?.status) }), selected.record?.recorded_at && (_jsxs("p", { className: "text-text-muted text-xs mt-0.5", children: ["Recorded at ", formatRecordedTime(selected.record.recorded_at)] }))] }), isAttendanceHrEditableDay(selected.day) && (_jsx(Button, { size: "sm", variant: "secondary", className: "w-full", onClick: () => setMarkTarget({ day: selected.day, record: selected.record }), "data-testid": "drawer-mark-attendance", children: selected.record
                                            ? isToday(selected.day)
                                                ? 'Edit attendance'
                                                : 'Edit this day'
                                            : 'Mark attendance' }))] })), _jsx(AttendanceSummaryCard, { summary: data.summary }), _jsxs("div", { className: "card p-4 flex justify-between text-sm bg-surface-subtle", children: [_jsx("span", { className: "text-text-muted", children: "Late Count" }), _jsx("span", { className: "tabular-nums text-text-secondary", children: data.summary.late_count })] }), data.records.length === 0 && (_jsxs("p", { className: "text-sm text-text-muted text-center", children: ["No attendance found for ", format(month, 'MMMM yyyy'), "."] }))] })) }) }), _jsx(AttendanceMarkModal, { open: !!markTarget, loading: markMutation.isPending, success: markSuccess, date: markTarget?.day, currentStatus: markTarget?.record?.status, isEdit: !!markTarget?.record, personName: personName, onSelect: (status) => markTarget &&
                    userId != null &&
                    markMutation.mutate({ status, date: toIsoDate(markTarget.day) }), onClose: () => setMarkTarget(null) })] }));
}
