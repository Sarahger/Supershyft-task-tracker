import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Send, GitBranch, Eye, Paperclip, Upload, RotateCcw, Unlock, Plus, Download, X, Trash2, Video, ExternalLink, PhoneOff, Pencil } from 'lucide-react';
import { Drawer, DrawerSection } from '../ui/Modal';
import { StatusBadge, PriorityBadge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Skeleton } from '../ui/Skeleton';
import { toast } from '../ui/Toast';
import { tasksApi, usersApi, meetingsApi } from '../../services/endpoints';
import { useTaskDrawer } from '../../contexts/TaskDrawerContext';
import { TaskPropertiesEditor } from './TaskPropertiesEditor';
import { CommentMentionTextarea } from './CommentMentionTextarea';
import { CommentMentionText } from './CommentMentionText';
import { DeleteTaskModal } from './DeleteTaskModal';
import { extractMentionedUserIds } from '../../lib/mentions';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { useDeleteTaskMutation } from '../../hooks/useDeleteTaskMutation';
import { useAuth } from '../../contexts/AuthContext';
import { canDeleteTasks } from '../../lib/roles';
import { getChecklistProgress } from '../../lib/checklist';
import { formatTimeTakenHours } from '../../lib/taskTiming';
import { startTaskCall, joinTaskCall, endTaskCall, openBlankMeetWindow, openMeetUrl } from '../../lib/meetings';
import { AttachmentInlinePreview } from './AttachmentInlinePreview';
import clsx from 'clsx';
function formatFileSize(bytes) {
    if (!bytes)
        return '';
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function TaskDrawer({ taskId, onClose }) {
    const [comment, setComment] = useState('');
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentContent, setEditingCommentContent] = useState('');
    const [checklistInput, setChecklistInput] = useState('');
    const [editingChecklistId, setEditingChecklistId] = useState(null);
    const [editingChecklistTitle, setEditingChecklistTitle] = useState('');
    const [dependencyPersonPick, setDependencyPersonPick] = useState('');
    const [dependencyPick, setDependencyPick] = useState('');
    const [previewAttachment, setPreviewAttachment] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const fileInputRef = useRef(null);
    const { openTask, closeTask } = useTaskDrawer();
    const { user } = useAuth();
    const qc = useQueryClient();
    const allowDelete = canDeleteTasks(user);
    const deleteMutation = useDeleteTaskMutation(() => {
        setShowDeleteModal(false);
        closeTask();
    });
    useEffect(() => {
        setChecklistInput('');
        setEditingChecklistId(null);
        setEditingChecklistTitle('');
        setDependencyPersonPick('');
        setDependencyPick('');
        setComment('');
        setEditingCommentId(null);
        setEditingCommentContent('');
        setPreviewAttachment(null);
        setShowDeleteModal(false);
    }, [taskId]);
    const { data: task, isLoading } = useQuery({
        queryKey: ['task', taskId],
        queryFn: () => tasksApi.get(taskId).then((r) => r.data.data),
        enabled: !!taskId,
        staleTime: 30000,
    });
    const { data: taskMeetingLogs } = useQuery({
        queryKey: ['task-meeting-logs', taskId],
        queryFn: () => meetingsApi.getTaskLogs(taskId).then((r) => r.data.data),
        enabled: !!taskId && !!task && !task.is_archived,
        staleTime: 30000,
    });
    const { data: activeTaskCall } = useQuery({
        queryKey: ['task-active-call', taskId],
        queryFn: () => meetingsApi.getActiveTaskCall(taskId).then((r) => r.data.data),
        enabled: !!taskId && !!task && !task.is_archived,
        refetchInterval: 30000,
    });
    const isAssignee = !!task?.assignees?.some((a) => a.user_id === user?.id);
    const isCallStarter = !!(activeTaskCall
        && taskMeetingLogs?.length
        && taskMeetingLogs
            .filter((l) => l.pool_id === activeTaskCall.id)
            .sort((a, b) => new Date(a.click_time).getTime() - new Date(b.click_time).getTime())[0]?.user_id === user?.id);
    const taskCallMutation = useMutation({
        mutationFn: (pendingWindow) => startTaskCall(taskId, pendingWindow),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task-meeting-logs', taskId] });
            qc.invalidateQueries({ queryKey: ['task-active-call', taskId] });
            qc.invalidateQueries({ queryKey: ['meetings-day'] });
            toast.success('Task call started — assignees notified');
        },
    });
    const joinTaskCallMutation = useMutation({
        mutationFn: (pendingWindow) => joinTaskCall(taskId, pendingWindow),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task-meeting-logs', taskId] });
            qc.invalidateQueries({ queryKey: ['meetings-day'] });
            toast.success('Joining task call…');
        },
    });
    const endTaskCallMutation = useMutation({
        mutationFn: () => endTaskCall(taskId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task-meeting-logs', taskId] });
            qc.invalidateQueries({ queryKey: ['task-active-call', taskId] });
            qc.invalidateQueries({ queryKey: ['meetings-day'] });
            toast.success('Call ended — link returned to pool');
        },
    });
    const attachments = task?.attachments ?? [];
    const { data: comments } = useQuery({
        queryKey: ['task-comments', taskId],
        queryFn: () => tasksApi.getComments(taskId).then((r) => r.data.data),
        enabled: !!taskId,
        staleTime: 60000,
    });
    const { data: activity } = useQuery({
        queryKey: ['task-activity', taskId],
        queryFn: () => tasksApi.getActivity(taskId).then((r) => r.data.data),
        enabled: !!taskId && (task?.current_version ?? 1) > 1,
        staleTime: 60000,
    });
    const { data: taskPickerOptions } = useQuery({
        queryKey: ['tasks-picker'],
        queryFn: () => tasksApi.list({ page_size: 100, sort_by: 'updated_at', sort_order: 'desc' }).then((r) => r.data.data.items),
        enabled: !!taskId && !!dependencyPersonPick,
        staleTime: 60000,
    });
    const commentMutation = useMutation({
        mutationFn: (payload) => tasksApi.addComment(taskId, payload.content, undefined, payload.mentioned_user_ids),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task-comments', taskId] });
            qc.invalidateQueries({ queryKey: ['task', taskId] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            setComment('');
        },
    });
    const editCommentMutation = useMutation({
        mutationFn: ({ commentId, content }) => tasksApi.updateComment(commentId, content),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task-comments', taskId] });
            setEditingCommentId(null);
            setEditingCommentContent('');
            toast.success('Comment updated');
        },
        onError: () => toast.error('Failed to update comment'),
    });
    const deleteCommentMutation = useMutation({
        mutationFn: (commentId) => tasksApi.deleteComment(commentId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task-comments', taskId] });
            qc.invalidateQueries({ queryKey: ['task', taskId] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            toast.success('Comment deleted');
        },
        onError: () => toast.error('Failed to delete comment'),
    });
    const completeMutation = useMutation({
        mutationFn: ({ userId, done }) => tasksApi.markComplete(taskId, userId, done),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['task', taskId] }),
    });
    const checklistMutation = useMutation({
        mutationFn: ({ itemId, done }) => tasksApi.updateChecklistItem(itemId, { is_completed: done }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task', taskId] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
        },
    });
    const editChecklistMutation = useMutation({
        mutationFn: ({ itemId, title }) => tasksApi.updateChecklistItem(itemId, { title }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task', taskId] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['my-tasks'] });
            setEditingChecklistId(null);
            setEditingChecklistTitle('');
            toast.success('Subtask updated');
        },
        onError: () => toast.error('Failed to update subtask'),
    });
    const deleteChecklistMutation = useMutation({
        mutationFn: (itemId) => tasksApi.deleteChecklistItem(itemId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task', taskId] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['my-tasks'] });
            toast.success('Subtask deleted');
        },
        onError: () => toast.error('Failed to delete subtask'),
    });
    const addChecklistMutation = useMutation({
        mutationFn: (title) => tasksApi.addChecklistItem(taskId, title),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task', taskId] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['my-tasks'] });
            setChecklistInput('');
            toast.success('Checklist item added');
        },
        onError: () => toast.error('Failed to add checklist item'),
    });
    const { data: usersList } = useQuery({
        queryKey: ['users-list'],
        queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
        enabled: !!taskId,
        staleTime: 5 * 60 * 1000,
    });
    const addDependencyMutation = useMutation({
        mutationFn: ({ dependsOnId, dependsOnUserId }) => tasksApi.addDependency(taskId, dependsOnId, dependsOnUserId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task', taskId] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.invalidateQueries({ queryKey: ['my-tasks'] });
            setDependencyPersonPick('');
            setDependencyPick('');
            toast.success('Dependency added');
        },
        onError: () => toast.error('Failed to add dependency'),
    });
    const removeDependencyMutation = useMutation({
        mutationFn: (dependencyId) => tasksApi.removeDependency(taskId, dependencyId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task', taskId] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            toast.success('Dependency removed');
        },
        onError: () => toast.error('Failed to remove dependency'),
    });
    const unblockMutation = useMutation({
        mutationFn: () => tasksApi.unblock(taskId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task', taskId] });
            toast.success('Task unblocked');
        },
    });
    const reopenMutation = useMutation({
        mutationFn: () => tasksApi.reopen(taskId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task', taskId] });
            toast.success('Task reopened');
        },
    });
    const uploadMutation = useMutation({
        mutationFn: (file) => tasksApi.uploadAttachment(taskId, file),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['task', taskId] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            toast.success('File uploaded');
        },
        onError: (error) => {
            const data = error.response?.data;
            const detail = typeof data?.detail === 'string' ? data.detail : data?.message;
            toast.error(detail || 'Upload failed');
        },
    });
    const deleteAttachmentMutation = useMutation({
        mutationFn: (attachmentId) => tasksApi.deleteAttachment(attachmentId),
        onSuccess: (_res, attachmentId) => {
            qc.invalidateQueries({ queryKey: ['task', taskId] });
            qc.invalidateQueries({ queryKey: ['tasks'] });
            qc.removeQueries({ queryKey: ['attachment-inline', attachmentId] });
            if (previewAttachment?.id === attachmentId)
                setPreviewAttachment(null);
            toast.success('Attachment removed');
        },
        onError: () => toast.error('Failed to remove attachment'),
    });
    const handleDownloadAttachment = async (attachmentId, filename) => {
        try {
            await tasksApi.downloadAttachment(attachmentId, filename);
        }
        catch {
            toast.error('Download failed');
        }
    };
    const openAttachmentPreview = (file) => {
        setPreviewAttachment(file);
    };
    const startChecklistEdit = (itemId, title) => {
        setEditingChecklistId(itemId);
        setEditingChecklistTitle(title);
    };
    const cancelChecklistEdit = () => {
        setEditingChecklistId(null);
        setEditingChecklistTitle('');
    };
    const saveChecklistEdit = (itemId, originalTitle) => {
        const title = editingChecklistTitle.trim();
        if (!title) {
            cancelChecklistEdit();
            return;
        }
        if (title === originalTitle) {
            cancelChecklistEdit();
            return;
        }
        editChecklistMutation.mutate({ itemId, title });
    };
    const existingDependencyIds = new Set(task?.dependencies?.map((d) => d.depends_on_id) ?? []);
    const personFilteredTasks = (taskPickerOptions ?? []).filter((t) => {
        if (t.id === taskId || existingDependencyIds.has(t.id))
            return false;
        if (!dependencyPersonPick)
            return true;
        const uid = Number(dependencyPersonPick);
        return t.assignees?.some((a) => a.user_id === uid);
    });
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const dependencyOptions = [...personFilteredTasks].sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));
    const submitComment = () => {
        const trimmed = comment.trim();
        if (!trimmed)
            return;
        const mentioned_user_ids = extractMentionedUserIds(trimmed, usersList ?? []);
        commentMutation.mutate({ content: trimmed, mentioned_user_ids });
    };
    const startCommentEdit = (commentId, content) => {
        setEditingCommentId(commentId);
        setEditingCommentContent(content);
    };
    const cancelCommentEdit = () => {
        setEditingCommentId(null);
        setEditingCommentContent('');
    };
    const saveCommentEdit = (commentId, originalContent) => {
        const trimmed = editingCommentContent.trim();
        if (!trimmed) {
            toast.error('Comment cannot be empty');
            return;
        }
        if (trimmed === originalContent.trim()) {
            cancelCommentEdit();
            return;
        }
        editCommentMutation.mutate({ commentId, content: trimmed });
    };
    return (_jsxs(_Fragment, { children: [_jsx(Drawer, { isOpen: !!taskId, onClose: onClose, children: isLoading ? (_jsxs("div", { className: "p-8 space-y-4", children: [_jsx(Skeleton, { className: "h-8 w-2/3" }), _jsx(Skeleton, { className: "h-24" }), _jsx(Skeleton, { className: "h-32" })] })) : task ? (task.is_archived ? (_jsxs("div", { className: "px-8 py-7 max-w-none", children: [_jsxs("div", { className: "pr-10 mb-6", children: [_jsx("h1", { className: "text-2xl font-semibold text-text-primary leading-snug tracking-tight", children: task.title }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 mt-3", children: [_jsx(StatusBadge, { status: task.status || 'completed' }), task.priority && _jsx(PriorityBadge, { priority: task.priority }), _jsxs("span", { className: "text-sm text-text-secondary", children: ["Time required ", formatTimeTakenHours(task.estimated_hours) ?? '—'] }), task.due_date && (_jsxs("span", { className: "text-sm text-text-secondary", children: ["Due ", format(new Date(task.due_date), 'MMM d, yyyy')] }))] })] }), _jsxs("div", { className: "space-y-5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wider text-text-muted mb-2", children: "Assignees" }), task.assignees?.length ? (_jsx("div", { className: "flex flex-wrap gap-2", children: task.assignees.map((a) => (_jsxs("div", { className: "flex items-center gap-2", children: [a.user && (_jsx(Avatar, { name: `${a.user.first_name} ${a.user.last_name}`, size: "sm" })), _jsx("span", { className: "text-sm text-text-primary", children: a.user
                                                            ? `${a.user.first_name} ${a.user.last_name}`
                                                            : 'Unknown' })] }, a.id))) })) : (_jsx("p", { className: "text-sm text-text-muted", children: "Unassigned" }))] }), task.due_date && (_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5", children: "Due date" }), _jsx("p", { className: "text-sm text-text-primary", children: format(new Date(task.due_date), 'MMM d, yyyy') })] })), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5", children: "Time" }), _jsx("p", { className: "text-sm text-text-primary", children: formatTimeTakenHours(task.estimated_hours) ?? '—' })] }), task.completed_at && (_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5", children: "Completed on" }), _jsx("p", { className: "text-sm text-text-primary", children: format(new Date(task.completed_at), 'MMM d, yyyy · h:mm a') })] })), task.description && (_jsxs("div", { children: [_jsx("p", { className: "text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5", children: "Description" }), _jsx("p", { className: "text-sm text-text-primary leading-relaxed whitespace-pre-wrap", children: task.description })] }))] })] })) : (_jsxs("div", { className: "px-8 py-7 max-w-none", children: [_jsxs("div", { className: "pr-10 mb-6", children: [_jsx("h1", { className: "text-2xl font-semibold text-text-primary leading-snug tracking-tight", children: task.title }), (() => {
                                    const checklistProgress = getChecklistProgress(task.checklists);
                                    if (!checklistProgress)
                                        return null;
                                    return (_jsxs("div", { className: "mt-3 max-w-md", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 mb-1.5", children: [_jsx("span", { className: "text-xs text-text-muted", children: "Subtask progress" }), _jsxs("span", { className: "text-xs font-medium text-text-secondary tabular-nums", children: [checklistProgress.done, "/", checklistProgress.total, " \u00B7 ", checklistProgress.percent, "%"] })] }), _jsx("div", { className: "h-1.5 rounded-full bg-dark-muted overflow-hidden", children: _jsx("div", { className: clsx('h-full rounded-full transition-all duration-300', checklistProgress.percent === 100
                                                        ? 'bg-emerald-500'
                                                        : checklistProgress.percent > 0
                                                            ? 'bg-amber-500'
                                                            : 'bg-dark-border'), style: { width: `${checklistProgress.percent}%` } }) })] }));
                                })(), _jsxs("div", { className: "flex flex-wrap items-center gap-2 mt-3", children: [_jsx(StatusBadge, { status: task.status }), _jsx(PriorityBadge, { priority: task.priority }), _jsxs("span", { className: "text-sm text-text-secondary", children: ["Time required ", formatTimeTakenHours(task.estimated_hours) ?? '—'] }), task.due_date && (_jsxs("span", { className: "text-sm text-text-secondary", children: ["Due ", format(new Date(task.due_date), 'MMM d, yyyy')] }))] }), _jsxs("div", { className: "flex flex-wrap gap-2 mt-4", children: [task.status === 'completed' && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => reopenMutation.mutate(), className: "gap-1.5", children: [_jsx(RotateCcw, { className: "h-3.5 w-3.5" }), " Reopen"] })), task.status === 'blocked' && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => unblockMutation.mutate(), className: "gap-1.5", children: [_jsx(Unlock, { className: "h-3.5 w-3.5" }), " Unblock"] })), isAssignee && !activeTaskCall && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => taskCallMutation.mutate(openBlankMeetWindow()), disabled: taskCallMutation.isPending, className: "gap-1.5", children: [_jsx(Video, { className: "h-3.5 w-3.5" }), " Start Impromptu Task Call"] })), isAssignee && activeTaskCall && (_jsxs(_Fragment, { children: [_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => joinTaskCallMutation.mutate(openBlankMeetWindow()), disabled: joinTaskCallMutation.isPending, className: "gap-1.5 border-emerald-500/30 text-emerald-400", children: [_jsx(Video, { className: "h-3.5 w-3.5" }), " Join Active Call"] }), isCallStarter && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => endTaskCallMutation.mutate(), disabled: endTaskCallMutation.isPending, className: "gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10", children: [_jsx(PhoneOff, { className: "h-3.5 w-3.5" }), " End Call"] }))] })), allowDelete && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => setShowDeleteModal(true), className: "gap-1.5 text-accent-danger hover:text-accent-danger hover:bg-red-500/10 border-red-500/20", children: [_jsx(Trash2, { className: "h-3.5 w-3.5" }), " Delete"] }))] })] }), _jsx(TaskPropertiesEditor, { task: task, taskId: task.id }, task.id), (taskMeetingLogs?.length ?? 0) > 0 && (_jsx(DrawerSection, { title: "Task calls", defaultOpen: true, children: _jsx("div", { className: "space-y-2", children: taskMeetingLogs.map((log) => (_jsxs("div", { className: "flex items-center justify-between gap-2 py-2 border-b border-dark-border last:border-0", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("p", { className: "text-sm text-text-primary", children: [log.user ? `${log.user.first_name} ${log.user.last_name}` : 'Someone', log.status ? ` · ${log.status}` : ''] }), _jsxs("p", { className: "text-xs text-text-muted", children: [format(new Date(log.click_time), 'MMM d, h:mm a'), log.left_at ? ` · Left ${format(new Date(log.left_at), 'h:mm a')}` : ''] })] }), log.meet_url && (_jsxs(Button, { variant: "secondary", size: "sm", className: "gap-1 shrink-0", onClick: () => openMeetUrl(log.meet_url), children: [_jsx(ExternalLink, { className: "h-3.5 w-3.5" }), " Join"] }))] }, log.id))) }) })), task.assignees && task.assignees.length > 1 && (_jsx(DrawerSection, { title: "Assignee progress", defaultOpen: false, children: _jsx("div", { className: "space-y-1.5", children: task.assignees.map((a) => (_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [a.user && _jsx(Avatar, { name: `${a.user.first_name} ${a.user.last_name}`, size: "sm" }), _jsxs("span", { className: "text-sm text-text-primary truncate", children: [a.user?.first_name, " ", a.user?.last_name] })] }), _jsx("button", { onClick: () => completeMutation.mutate({ userId: a.user_id, done: !a.is_completed }), className: "shrink-0 text-text-muted hover:text-emerald-400 transition-colors duration-hover", title: a.is_completed ? 'Mark incomplete' : 'Mark complete', children: a.is_completed ? _jsx(CheckCircle2, { className: "h-4 w-4 text-emerald-500" }) : _jsx(Circle, { className: "h-4 w-4" }) })] }, a.id))) }) })), task.block_reason && (_jsxs("div", { className: "my-4 px-3 py-2.5 rounded-lg bg-red-500/10 text-sm text-red-400 border border-red-500/20", children: [_jsx("span", { className: "font-medium", children: "Blocked" }), " \u2014 ", task.block_reason] })), _jsx(DrawerSection, { title: `Comments${comments?.length ? ` · ${comments.length}` : ''}`, children: _jsxs("div", { className: "space-y-4", children: [comments?.length ? comments.map((c) => {
                                        const isOwnComment = c.author_id === user?.id;
                                        return (_jsxs("div", { className: "flex gap-3 group", children: [c.author && _jsx(Avatar, { name: `${c.author.first_name} ${c.author.last_name}`, size: "sm" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-baseline gap-2 flex-wrap", children: [_jsxs("span", { className: "text-sm font-medium text-text-primary", children: [c.author?.first_name, " ", c.author?.last_name] }), _jsxs("span", { className: "text-2xs text-text-muted", children: [format(new Date(c.created_at), 'MMM d, h:mm a'), c.is_edited ? ' · edited' : ''] }), isOwnComment && editingCommentId !== c.id && (_jsxs("div", { className: "flex items-center gap-0.5 ml-auto opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity", children: [_jsx("button", { type: "button", onClick: () => startCommentEdit(c.id, c.content), className: "toolbar-btn text-text-muted hover:text-text-primary", title: "Edit comment", children: _jsx(Pencil, { className: "h-3.5 w-3.5" }) }), _jsx("button", { type: "button", onClick: () => deleteCommentMutation.mutate(c.id), disabled: deleteCommentMutation.isPending, className: "toolbar-btn text-text-muted hover:text-red-400", title: "Delete comment", children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) })] }))] }), editingCommentId === c.id ? (_jsxs("div", { className: "mt-2 space-y-2", children: [_jsx(CommentMentionTextarea, { value: editingCommentContent, onChange: setEditingCommentContent, users: usersList ?? [] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: cancelCommentEdit, children: "Cancel" }), _jsx(Button, { size: "sm", onClick: () => saveCommentEdit(c.id, c.content), disabled: !editingCommentContent.trim() || editCommentMutation.isPending, children: "Save" })] })] })) : (_jsx(CommentMentionText, { content: c.content }))] })] }, c.id));
                                    }) : (_jsx("p", { className: "text-sm text-text-muted", children: "No comments yet" })), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsx(CommentMentionTextarea, { value: comment, onChange: setComment, users: usersList ?? [] }), _jsx(Button, { variant: "secondary", onClick: submitComment, disabled: !comment.trim() || commentMutation.isPending, className: "self-end", children: _jsx(Send, { className: "h-4 w-4" }) })] })] }) }), _jsxs(DrawerSection, { title: `Checklist${task.checklists?.flatMap((cl) => cl.items).length
                                ? ` · ${task.checklists.flatMap((cl) => cl.items).filter((i) => i.is_completed).length}/${task.checklists.flatMap((cl) => cl.items).length}`
                                : ''}`, defaultOpen: true, children: [task.checklists?.flatMap((cl) => cl.items).length ? (_jsx("div", { className: "space-y-1", children: task.checklists.flatMap((cl) => cl.items).map((item) => (_jsxs("div", { className: "flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-dark-hover group", children: [_jsx("input", { type: "checkbox", checked: item.is_completed, onChange: (e) => checklistMutation.mutate({ itemId: item.id, done: e.target.checked }), className: "rounded border-dark-border text-text-primary focus:ring-[var(--focus-ring)] shrink-0" }), _jsx("div", { className: "flex-1 min-w-0", children: editingChecklistId === item.id ? (_jsx(Input, { value: editingChecklistTitle, onChange: (e) => setEditingChecklistTitle(e.target.value), onKeyDown: (e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            saveChecklistEdit(item.id, item.title);
                                                        }
                                                        if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            cancelChecklistEdit();
                                                        }
                                                    }, onBlur: () => {
                                                        if (editingChecklistId === item.id)
                                                            saveChecklistEdit(item.id, item.title);
                                                    }, autoFocus: true, className: "text-sm h-8" })) : (_jsx("span", { className: clsx('text-sm block truncate', item.is_completed ? 'line-through text-text-muted' : 'text-text-primary'), children: item.title })) }), editingChecklistId !== item.id && (_jsxs("div", { className: "flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity", children: [_jsx("button", { type: "button", onClick: () => startChecklistEdit(item.id, item.title), className: "toolbar-btn text-text-muted hover:text-text-primary", title: "Edit subtask", children: _jsx(Pencil, { className: "h-3.5 w-3.5" }) }), _jsx("button", { type: "button", onClick: () => deleteChecklistMutation.mutate(item.id), disabled: deleteChecklistMutation.isPending, className: "toolbar-btn text-text-muted hover:text-red-400", title: "Delete subtask", children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) })] }))] }, item.id))) })) : (_jsx("p", { className: "text-sm text-text-muted", children: "No checklist items yet" })), _jsxs("div", { className: "flex gap-2 pt-3", children: [_jsx(Input, { value: checklistInput, onChange: (e) => setChecklistInput(e.target.value), placeholder: "Add checklist item...", className: "flex-1 text-sm", onKeyDown: (e) => {
                                                if (e.key === 'Enter' && checklistInput.trim()) {
                                                    e.preventDefault();
                                                    addChecklistMutation.mutate(checklistInput.trim());
                                                }
                                            } }), _jsxs(Button, { variant: "secondary", onClick: () => addChecklistMutation.mutate(checklistInput.trim()), disabled: !checklistInput.trim() || addChecklistMutation.isPending, className: "gap-1.5 shrink-0", children: [_jsx(Plus, { className: "h-4 w-4" }), "Add"] })] })] }), _jsxs(DrawerSection, { title: `Attachments${attachments?.length ? ` · ${attachments.length}` : ''}`, defaultOpen: (attachments?.length ?? 0) > 0, children: [attachments?.length ? (_jsx("ul", { className: "space-y-3 mb-3", children: attachments.map((file) => (_jsxs("li", { className: "rounded-lg border border-dark-border bg-dark-card px-3 py-2.5", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Paperclip, { className: "h-4 w-4 text-sky-400 shrink-0" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("button", { type: "button", onClick: () => openAttachmentPreview(file), className: "link-sky", children: file.filename }), _jsx("p", { className: "text-2xs text-text-muted mt-0.5", children: [
                                                                    formatFileSize(file.file_size),
                                                                    file.uploaded_by ? `${file.uploaded_by.first_name} ${file.uploaded_by.last_name}` : null,
                                                                    format(new Date(file.created_at), 'MMM d, yyyy'),
                                                                ].filter(Boolean).join(' · ') })] }), _jsx(Button, { variant: "secondary", size: "sm", onClick: () => openAttachmentPreview(file), className: "gap-1.5 shrink-0", title: "Preview", children: _jsx(Eye, { className: "h-3.5 w-3.5" }) }), _jsx(Button, { variant: "secondary", size: "sm", onClick: () => handleDownloadAttachment(file.id, file.filename), className: "gap-1.5 shrink-0", title: "Download", children: _jsx(Download, { className: "h-3.5 w-3.5" }) }), _jsx(Button, { variant: "secondary", size: "sm", onClick: () => deleteAttachmentMutation.mutate(file.id), disabled: deleteAttachmentMutation.isPending, className: "gap-1.5 shrink-0 text-accent-danger hover:text-accent-danger hover:bg-red-500/10 border-red-500/20", title: "Remove attachment", children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) })] }), _jsx(AttachmentInlinePreview, { attachment: file, isSelected: previewAttachment?.id === file.id, onPreview: () => openAttachmentPreview(file) })] }, file.id))) })) : (_jsx("p", { className: "text-sm text-text-muted mb-3", children: "No attachments yet" })), _jsx("input", { ref: fileInputRef, type: "file", className: "hidden", onChange: (e) => {
                                        const file = e.target.files?.[0];
                                        if (file)
                                            uploadMutation.mutate(file);
                                        e.target.value = '';
                                    } }), _jsxs(Button, { variant: "secondary", size: "sm", onClick: () => fileInputRef.current?.click(), disabled: uploadMutation.isPending, className: "gap-1.5", children: [_jsx(Upload, { className: "h-3.5 w-3.5" }), uploadMutation.isPending ? 'Uploading…' : 'Upload file'] })] }), (task.current_version ?? 1) > 1 && (_jsxs(_Fragment, { children: [_jsxs(DrawerSection, { title: `Version History · v${task.current_version}`, defaultOpen: false, children: [_jsxs("p", { className: "text-sm text-text-secondary", children: ["Current version: ", _jsx("span", { className: "font-medium text-text-primary", children: task.current_version })] }), _jsx("p", { className: "text-2xs text-text-muted mt-1", children: "Previous versions are preserved after review cycles." })] }), _jsx(DrawerSection, { title: "Activity", defaultOpen: false, children: _jsx("div", { className: "space-y-3", children: activity?.length ? activity.map((a) => (_jsxs("div", { className: "flex gap-3 text-sm", children: [_jsx("div", { className: "w-1 h-1 rounded-full bg-text-muted mt-2 shrink-0" }), _jsxs("div", { children: [_jsx("p", { className: "text-text-secondary", children: a.description }), _jsxs("p", { className: "text-2xs text-text-muted mt-0.5", children: [a.user ? `${a.user.first_name} ${a.user.last_name} · ` : '', format(new Date(a.created_at), 'MMM d, h:mm a')] })] })] }, a.id))) : (_jsx("p", { className: "text-sm text-text-muted", children: "No activity yet" })) }) })] })), _jsxs(DrawerSection, { title: `Dependencies${task.dependencies?.length ? ` · ${task.dependencies.length}` : ''}`, defaultOpen: true, children: [task.dependencies?.length ? (_jsx("ul", { className: "space-y-2", children: task.dependencies.map((d) => (_jsxs("li", { className: "flex items-center gap-2 group", children: [_jsxs("button", { type: "button", onClick: () => openTask(d.depends_on_id), className: "flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors flex-1 min-w-0", children: [_jsx(GitBranch, { className: "h-3.5 w-3.5 text-purple-400 shrink-0" }), _jsxs("span", { className: "truncate", children: [d.depends_on_user
                                                                ? `${d.depends_on_user.first_name} ${d.depends_on_user.last_name} · `
                                                                : '', d.depends_on_title || `Task #${d.depends_on_id}`] })] }), _jsx("button", { type: "button", onClick: () => removeDependencyMutation.mutate(d.id), disabled: removeDependencyMutation.isPending, className: "opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all", "aria-label": "Remove dependency", children: _jsx(X, { className: "h-3.5 w-3.5" }) })] }, d.id))) })) : (_jsx("p", { className: "text-sm text-text-muted", children: "This task does not depend on any other tasks yet" })), _jsxs("div", { className: "flex flex-col gap-2 pt-3", children: [_jsxs("select", { value: dependencyPersonPick, onChange: (e) => {
                                                setDependencyPersonPick(e.target.value);
                                                setDependencyPick('');
                                            }, className: "input text-sm", "aria-label": "Select person", children: [_jsx("option", { value: "", children: "1. Select person (optional)\u2026" }), (usersList ?? []).map((u) => (_jsxs("option", { value: u.id, children: [u.first_name, " ", u.last_name] }, u.id)))] }), dependencyOptions.length > 0 ? (_jsxs("div", { className: "flex gap-2", children: [_jsxs("select", { value: dependencyPick, onChange: (e) => setDependencyPick(e.target.value), className: "input flex-1 text-sm", "aria-label": "Select task dependency", children: [_jsx("option", { value: "", children: "2. Depends on task\u2026" }), dependencyOptions.map((t) => (_jsxs("option", { value: t.id, children: ["[", t.priority, "] ", t.title] }, t.id)))] }), _jsxs(Button, { variant: "secondary", onClick: () => addDependencyMutation.mutate({
                                                        dependsOnId: Number(dependencyPick),
                                                        dependsOnUserId: dependencyPersonPick ? Number(dependencyPersonPick) : undefined,
                                                    }), disabled: !dependencyPick || addDependencyMutation.isPending, className: "gap-1.5 shrink-0", children: [_jsx(Plus, { className: "h-4 w-4" }), "Add"] })] })) : (_jsx("p", { className: "text-xs text-text-muted", children: dependencyPersonPick ? 'No tasks for this person' : 'No other tasks available to link' }))] })] }), _jsx(DrawerSection, { title: "Details", defaultOpen: false, children: _jsxs("div", { className: "grid grid-cols-2 gap-3 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Time required" }), _jsx("p", { className: "text-text-primary", children: formatTimeTakenHours(task.estimated_hours) ?? '—' })] }), task.departments?.length ? (_jsxs("div", { className: "col-span-2", children: [_jsx("span", { className: "text-text-muted", children: "Departments" }), _jsx("p", { className: "text-text-primary", children: task.departments.map((d) => d.name).join(', ') })] })) : null, task.creator && (_jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Created by" }), _jsxs("p", { className: "text-text-primary", children: [task.creator.first_name, " ", task.creator.last_name] })] })), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Created" }), _jsx("p", { className: "text-text-primary", children: format(new Date(task.created_at), 'MMM d, yyyy') })] })] }) })] }))) : null }), _jsx(AttachmentPreviewModal, { attachment: previewAttachment, onClose: () => setPreviewAttachment(null) }), allowDelete && (_jsx(DeleteTaskModal, { isOpen: showDeleteModal, taskTitle: task?.title, onClose: () => setShowDeleteModal(false), onConfirm: (reason) => {
                    if (taskId)
                        deleteMutation.mutate({ id: taskId, reason });
                }, isPending: deleteMutation.isPending }))] }));
}
