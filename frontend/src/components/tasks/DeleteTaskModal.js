import { jsxs as _jsxs, Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
export function DeleteTaskModal({ isOpen, taskTitle, onClose, onConfirm, isPending = false, }) {
    const [reason, setReason] = useState('');
    const handleClose = () => {
        setReason('');
        onClose();
    };
    const handleConfirm = () => {
        const trimmed = reason.trim();
        if (!trimmed)
            return;
        onConfirm(trimmed);
        setReason('');
    };
    return (_jsxs(Modal, { isOpen: isOpen, onClose: handleClose, title: "Delete task", size: "sm", children: [_jsx("p", { className: "text-sm text-text-secondary mb-1", children: taskTitle ? (_jsxs(_Fragment, { children: ["Delete ", _jsxs("span", { className: "text-text-primary font-medium", children: ["\u201C", taskTitle, "\u201D"] }), "?"] })) : ('Delete this task?') }), _jsx("p", { className: "text-sm text-text-muted mb-3", children: "This action cannot be undone. Please provide a reason." }), _jsx(Textarea, { value: reason, onChange: (e) => setReason(e.target.value), placeholder: "Why are you deleting this task?", rows: 3, className: "text-sm mb-4", autoFocus: true }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "secondary", onClick: handleClose, disabled: isPending, children: "Cancel" }), _jsx(Button, { onClick: handleConfirm, disabled: !reason.trim() || isPending, loading: isPending, className: "bg-accent-danger hover:opacity-90", children: "Delete task" })] })] }));
}
