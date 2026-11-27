import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { tasksApi } from '../../services/endpoints';
import { formatDueNoonForApi, toDateInput } from '../../lib/weeklyPlanParse';
export function OverdueRevisionModal({ item, onClose, }) {
    const qc = useQueryClient();
    const [reason, setReason] = useState('');
    const [dueDate, setDueDate] = useState(toDateInput(item?.due_date));
    useEffect(() => {
        setReason('');
        setDueDate(toDateInput(item?.due_date));
    }, [item]);
    const mutation = useMutation({
        mutationFn: () => {
            if (!item?.task_id)
                throw new Error('Missing task');
            if (!reason.trim())
                throw new Error('A reason is required');
            if (!dueDate)
                throw new Error('A revised deadline is required');
            return tasksApi.reviseDeadline(item.task_id, {
                reason: reason.trim(),
                new_due_date: formatDueNoonForApi(dueDate),
            });
        },
        onSuccess: () => {
            toast.success('Deadline revised');
            qc.invalidateQueries({ queryKey: ['weekly-updates'] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            onClose();
        },
        onError: (err) => {
            const message = err
                ?.response?.data?.detail
                || err?.response?.data?.message
                || err.message
                || 'Could not revise deadline';
            toast.error(typeof message === 'string' ? message : 'Could not revise deadline');
        },
    });
    return (_jsx(Modal, { isOpen: Boolean(item), onClose: onClose, title: "Revise overdue deadline", size: "md", children: item && (_jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm text-text-primary", children: item.title }), _jsx("p", { className: "text-xs text-text-muted", children: "Original deadline stays on record. This only updates the current due date." }), _jsx(Input, { label: "Revised due date", type: "date", value: dueDate, onChange: (e) => setDueDate(e.target.value) }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "block text-xs font-medium text-text-secondary mb-1.5", children: "Reason for the delay" }), _jsx("textarea", { className: "input min-h-[88px]", value: reason, onChange: (e) => setReason(e.target.value), placeholder: "What slipped, and what is the new plan?" })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: onClose, children: "Cancel" }), _jsx(Button, { type: "button", loading: mutation.isPending, onClick: () => mutation.mutate(), children: "Save revision" })] })] })) }));
}
