import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Camera, Sun, Moon, Monitor, LayoutList, Columns3, CalendarDays, CalendarRange, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTaskViewPreferences } from '../contexts/TaskViewPreferencesContext';
import { OPTIONAL_TASK_VIEWS } from '../lib/taskViewPreferences';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { toast } from '../components/ui/Toast';
import { authApi, notificationsApi, telegramApi } from '../services/endpoints';
import { canAccessManagerFeatures } from '../lib/roles';
function ProfilePhotoSection() {
    const { user, updateUser } = useAuth();
    const fileInputRef = useRef(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    useEffect(() => {
        return () => {
            if (previewUrl)
                URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);
    const uploadMutation = useMutation({
        mutationFn: (file) => authApi.uploadProfilePicture(file),
        onSuccess: (res) => {
            updateUser(res.data.data);
            if (previewUrl)
                URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            toast.success('Profile photo updated');
        },
        onError: (error) => {
            if (previewUrl)
                URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            const data = error.response?.data;
            const detail = typeof data?.detail === 'string' ? data.detail : data?.message;
            toast.error(detail || 'Could not upload photo');
        },
    });
    const removeMutation = useMutation({
        mutationFn: () => authApi.removeProfilePicture(),
        onSuccess: (res) => {
            updateUser(res.data.data);
            toast.success('Profile photo removed');
        },
        onError: () => toast.error('Could not remove photo'),
    });
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            toast.error('Please choose an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be 5MB or smaller');
            return;
        }
        if (previewUrl)
            URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(file));
        uploadMutation.mutate(file);
    };
    if (!user)
        return null;
    const displaySrc = previewUrl || user.profile_picture;
    const busy = uploadMutation.isPending || removeMutation.isPending;
    return (_jsxs("div", { className: "flex items-center gap-4 mb-5 pb-5 border-b border-dark-border", children: [_jsxs("div", { className: "relative shrink-0", children: [_jsx(Avatar, { name: `${user.first_name} ${user.last_name}`, src: displaySrc, size: "lg", className: "!h-16 !w-16 !text-lg" }), _jsx("button", { type: "button", onClick: () => fileInputRef.current?.click(), disabled: busy, className: "absolute -bottom-1 -right-1 h-7 w-7 rounded-full border border-dark-border bg-dark-card text-text-secondary hover:text-text-primary hover:bg-dark-hover flex items-center justify-center disabled:opacity-50", title: "Upload photo", "aria-label": "Upload profile photo", children: _jsx(Camera, { className: "h-3.5 w-3.5" }) })] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium text-text-primary", children: "Profile photo" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "JPEG, PNG, WebP, or GIF \u00B7 up to 5MB" }), _jsxs("div", { className: "flex flex-wrap gap-2 mt-3", children: [_jsx(Button, { size: "sm", variant: "secondary", onClick: () => fileInputRef.current?.click(), loading: uploadMutation.isPending, disabled: busy, children: user.profile_picture ? 'Change photo' : 'Upload photo' }), user.profile_picture && (_jsx(Button, { size: "sm", variant: "secondary", onClick: () => removeMutation.mutate(), loading: removeMutation.isPending, disabled: busy, className: "text-accent-danger hover:text-accent-danger", children: "Remove" }))] })] }), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/jpeg,image/png,image/webp,image/gif", className: "hidden", onChange: handleFileChange })] }));
}
function TelegramSettingsSection() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const { data: status, isLoading } = useQuery({
        queryKey: ['telegram-status'],
        queryFn: () => telegramApi.status().then((r) => r.data.data),
    });
    const [linkCode, setLinkCode] = useState(null);
    const linkMutation = useMutation({
        mutationFn: () => telegramApi.createLinkCode().then((r) => r.data.data),
        onSuccess: (data) => {
            setLinkCode(data);
            toast.success('Link code generated — expires in 10 minutes');
        },
        onError: () => toast.error('Could not generate link code'),
    });
    const unlinkMutation = useMutation({
        mutationFn: () => telegramApi.unlink(),
        onSuccess: () => {
            setLinkCode(null);
            qc.invalidateQueries({ queryKey: ['telegram-status'] });
            toast.success('Telegram unlinked');
        },
        onError: () => toast.error('Could not unlink Telegram'),
    });
    const prefsMutation = useMutation({
        mutationFn: (data) => telegramApi.updatePreferences(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['telegram-status'] });
            toast.success('Telegram preferences saved');
        },
        onError: () => toast.error('Could not save Telegram preferences'),
    });
    if (isLoading || !status) {
        return (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-sm font-medium text-text-primary mb-2", children: "Telegram" }), _jsx("div", { className: "h-24 bg-surface-subtle rounded animate-pulse" })] }));
    }
    const bot = status.bot_username || 'supershyftbot';
    const isManager = canAccessManagerFeatures(user);
    return (_jsxs(_Fragment, { children: [_jsxs("h2", { className: "text-sm font-medium text-text-primary mb-1 flex items-center gap-2", children: [_jsx(MessageCircle, { className: "h-4 w-4" }), "Telegram"] }), _jsxs("p", { className: "text-sm text-text-secondary mb-4", children: ["Link @", bot, " to view your Supershyft Task Tracker tasks from Telegram. Commands use the same task database as this app."] }), _jsxs("div", { className: "rounded-lg border border-dark-border bg-surface-subtle px-4 py-3 mb-4", children: [_jsxs("p", { className: "text-sm text-text-primary", children: ["Status:", ' ', _jsx("span", { className: "font-medium", children: status.linked ? 'Linked' : 'Not linked' }), status.telegram_username ? ` (@${status.telegram_username})` : ''] }), status.linked_at && (_jsxs("p", { className: "text-xs text-text-muted mt-1", children: ["Linked at ", new Date(status.linked_at).toLocaleString()] }))] }), _jsxs("div", { className: "flex flex-wrap gap-2 mb-4", children: [_jsx(Button, { size: "sm", onClick: () => linkMutation.mutate(), loading: linkMutation.isPending, children: "Generate link code" }), status.linked && (_jsx(Button, { size: "sm", variant: "secondary", onClick: () => unlinkMutation.mutate(), loading: unlinkMutation.isPending, children: "Unlink" }))] }), linkCode && (_jsxs("div", { className: "rounded-lg border border-dark-border bg-surface-highlight px-4 py-3 mb-4 space-y-2", children: [_jsxs("p", { className: "text-sm text-text-primary", children: ["Send this in Telegram to ", _jsxs("span", { className: "font-medium", children: ["@", linkCode.bot_username] }), ":"] }), _jsxs("code", { className: "block text-sm font-mono bg-surface-subtle px-3 py-2 rounded border border-dark-border", children: ["/link ", linkCode.code] }), _jsxs("p", { className: "text-xs text-text-muted", children: ["Expires ", new Date(linkCode.expires_at).toLocaleString(), ". Do not share this code."] })] })), _jsxs("div", { className: "space-y-0 divide-y divide-dark-border border border-dark-border rounded-lg overflow-hidden", children: [_jsxs("label", { className: "flex items-start justify-between gap-4 px-4 py-3 bg-surface-subtle cursor-pointer hover:bg-dark-hover", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-text-primary", children: "Telegram notifications" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "Allow bot messages to this linked chat" })] }), _jsx("input", { type: "checkbox", checked: status.telegram_notifications_enabled, disabled: prefsMutation.isPending, onChange: () => prefsMutation.mutate({
                                    telegram_notifications_enabled: !status.telegram_notifications_enabled,
                                }), className: "mt-1 rounded border-dark-border" })] }), isManager && (_jsxs("label", { className: "flex items-start justify-between gap-4 px-4 py-3 bg-surface-subtle cursor-pointer hover:bg-dark-hover", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-text-primary", children: "Daily digest" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "Morning team snapshot (managers/admins only)" })] }), _jsx("input", { type: "checkbox", checked: status.telegram_daily_digest_enabled, disabled: prefsMutation.isPending || !status.linked, onChange: () => prefsMutation.mutate({
                                    telegram_daily_digest_enabled: !status.telegram_daily_digest_enabled,
                                }), className: "mt-1 rounded border-dark-border" })] }))] })] }));
}
function NotificationSettingsSection() {
    const qc = useQueryClient();
    const { data: prefs, isLoading } = useQuery({
        queryKey: ['notification-preferences'],
        queryFn: () => notificationsApi.getPreferences().then((r) => r.data.data),
    });
    const [localPrefs, setLocalPrefs] = useState(null);
    useEffect(() => {
        if (prefs)
            setLocalPrefs(prefs);
    }, [prefs]);
    const saveMutation = useMutation({
        mutationFn: (data) => notificationsApi.updatePreferences(data),
        onSuccess: (res) => {
            qc.setQueryData(['notification-preferences'], res.data.data);
            setLocalPrefs(res.data.data);
            toast.success('Notification preferences saved');
        },
        onError: () => toast.error('Could not save preferences'),
    });
    const testEmailMutation = useMutation({
        mutationFn: () => notificationsApi.sendTestEmail(),
        onSuccess: () => toast.success('Test email sent — check your inbox'),
        onError: () => toast.error('Could not send test email. Is SMTP configured on the server?'),
    });
    const toggle = (key) => {
        if (!localPrefs)
            return;
        const next = { ...localPrefs, [key]: !localPrefs[key] };
        setLocalPrefs(next);
        saveMutation.mutate({ [key]: next[key] });
    };
    const items = [
        {
            key: 'email_notifications_enabled',
            label: 'Email notifications',
            description: 'Master switch for all email alerts',
        },
        {
            key: 'notify_task_assigned',
            label: 'Task assignments',
            description: 'When you are assigned to a task',
            disabledBy: 'email_notifications_enabled',
        },
        {
            key: 'notify_task_updates',
            label: 'Task updates',
            description: 'Blocked, unblocked, completed, or reopened tasks',
            disabledBy: 'email_notifications_enabled',
        },
        {
            key: 'notify_reviews',
            label: 'Reviews',
            description: 'Review requests, approvals, and change requests',
            disabledBy: 'email_notifications_enabled',
        },
        {
            key: 'notify_comments',
            label: 'Comments',
            description: 'New comments on tasks you are involved in',
            disabledBy: 'email_notifications_enabled',
        },
        {
            key: 'notify_meetings',
            label: 'Meetings & calls',
            description: 'Instant team calls and task sync invitations',
            disabledBy: 'email_notifications_enabled',
        },
    ];
    if (isLoading || !localPrefs) {
        return (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-sm font-medium text-text-primary mb-2", children: "Notifications" }), _jsx("div", { className: "h-24 bg-surface-subtle rounded animate-pulse" })] }));
    }
    return (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-sm font-medium text-text-primary mb-1", children: "Notifications" }), _jsx("p", { className: "text-sm text-text-secondary mb-4", children: "In-app alerts always appear in the bell menu. Choose which events also send email." }), _jsx("div", { className: "space-y-0 divide-y divide-dark-border border border-dark-border rounded-lg overflow-hidden", children: items.map((item) => {
                    const disabled = item.disabledBy ? !localPrefs[item.disabledBy] : false;
                    return (_jsxs("label", { className: clsx('flex items-start justify-between gap-4 px-4 py-3 bg-surface-subtle', disabled && 'opacity-50', !disabled && 'cursor-pointer hover:bg-dark-hover'), children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-text-primary", children: item.label }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: item.description })] }), _jsx("input", { type: "checkbox", checked: localPrefs[item.key], disabled: disabled || saveMutation.isPending, onChange: () => toggle(item.key), className: "mt-1 rounded border-dark-border" })] }, item.key));
                }) }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3", children: [_jsx(Button, { size: "sm", variant: "secondary", onClick: () => testEmailMutation.mutate(), loading: testEmailMutation.isPending, disabled: !localPrefs.email_notifications_enabled, children: "Send test email" }), _jsx("p", { className: "text-xs text-text-muted", children: "Requires server SMTP settings (`EMAIL_ENABLED=true` and SMTP credentials)." })] })] }));
}
const OPTIONAL_VIEW_ICONS = {
    kanban: Columns3,
    calendar: CalendarDays,
    weekly: CalendarRange,
};
function TaskViewsSettingsSection() {
    const { isViewEnabled, toggleView } = useTaskViewPreferences();
    return (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-sm font-medium text-text-primary mb-1", children: "Task views" }), _jsx("p", { className: "text-sm text-text-secondary mb-4", children: "Choose which views appear on the Tasks screen. List is always available." }), _jsxs("div", { className: "space-y-0 divide-y divide-dark-border border border-dark-border rounded-lg overflow-hidden", children: [_jsxs("label", { className: "flex items-start justify-between gap-4 px-4 py-3 bg-surface-subtle opacity-70 cursor-default", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(LayoutList, { className: "h-4 w-4 text-text-muted mt-0.5 shrink-0" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-text-primary", children: "List" }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: "Table view with sortable columns" })] })] }), _jsx("input", { type: "checkbox", checked: true, disabled: true, readOnly: true, className: "mt-1 rounded border-dark-border", "aria-label": "List view always enabled" })] }), OPTIONAL_TASK_VIEWS.map((view) => {
                        const Icon = OPTIONAL_VIEW_ICONS[view.id];
                        return (_jsxs("label", { className: "flex items-start justify-between gap-4 px-4 py-3 bg-surface-subtle cursor-pointer hover:bg-dark-hover", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(Icon, { className: "h-4 w-4 text-text-muted mt-0.5 shrink-0" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-text-primary", children: view.label }), _jsx("p", { className: "text-xs text-text-muted mt-0.5", children: view.description })] })] }), _jsx("input", { type: "checkbox", checked: isViewEnabled(view.id), onChange: () => toggleView(view.id), className: "mt-1 rounded border-dark-border" })] }, view.id));
                    })] })] }));
}
export default function SettingsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { preference, setPreference } = useTheme();
    return (_jsxs("div", { className: "max-w-2xl mx-auto pb-12 space-y-6", children: [_jsx(PageHeader, { title: "Settings", subtitle: "Profile and workspace configuration", onMobileBack: () => navigate(-1) }), _jsxs("div", { className: "card p-6", children: [_jsx("h2", { className: "text-sm font-medium text-text-primary mb-4", children: "Profile" }), _jsx(ProfilePhotoSection, {}), _jsxs("div", { className: "space-y-0 text-sm", children: [_jsxs("div", { className: "flex justify-between py-3 border-b border-dark-border", children: [_jsx("span", { className: "text-text-muted", children: "Name" }), _jsxs("span", { className: "text-text-primary", children: [user?.first_name, " ", user?.last_name] })] }), _jsxs("div", { className: "flex justify-between py-3 border-b border-dark-border", children: [_jsx("span", { className: "text-text-muted", children: "Email" }), _jsx("span", { className: "text-text-primary", children: user?.email })] }), _jsxs("div", { className: "flex justify-between py-3 border-b border-dark-border", children: [_jsx("span", { className: "text-text-muted", children: "Role" }), _jsx("span", { className: "text-text-primary capitalize", children: user?.role })] }), _jsxs("div", { className: "flex justify-between py-3 border-b border-dark-border", children: [_jsx("span", { className: "text-text-muted", children: "Job Title" }), _jsx("span", { className: "text-text-primary", children: user?.job_title || '—' })] }), _jsxs("div", { className: "flex justify-between py-3", children: [_jsx("span", { className: "text-text-muted", children: "Departments" }), _jsx("span", { className: "text-text-primary", children: user?.departments?.map((d) => d.name).join(', ') || '—' })] })] })] }), _jsxs("div", { className: "card p-6", children: [_jsx("h2", { className: "text-sm font-medium text-text-primary mb-1", children: "Appearance" }), _jsx("p", { className: "text-sm text-text-secondary mb-4", children: "Choose how the app looks. Your preference is saved on this device." }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3", children: ([
                            { id: 'light', label: 'Light', icon: Sun },
                            { id: 'dark', label: 'Dark', icon: Moon },
                            { id: 'system', label: 'System', icon: Monitor },
                        ]).map((option) => {
                            const selected = preference === option.id;
                            const Icon = option.icon;
                            return (_jsxs("button", { type: "button", onClick: () => setPreference(option.id), className: clsx('flex flex-col items-stretch gap-3 rounded-lg border p-3 transition-colors duration-hover text-left', selected
                                    ? 'border-text-primary ring-1 ring-text-primary/20 bg-surface-highlight'
                                    : 'border-dark-border bg-surface-subtle hover:bg-dark-hover'), children: [_jsx("div", { className: clsx('w-full aspect-[5/3] rounded-xl border border-dark-border overflow-hidden flex', option.id === 'light' && 'theme-preview-light', option.id === 'dark' && 'theme-preview-dark', option.id === 'system' && 'theme-preview-system') }), _jsxs("div", { className: "flex items-center gap-2 px-0.5", children: [_jsx(Icon, { className: "h-4 w-4 text-text-secondary" }), _jsx("span", { className: "text-sm font-medium text-text-primary", children: option.label })] })] }, option.id));
                        }) })] }), _jsx("div", { className: "card p-6", children: _jsx(TaskViewsSettingsSection, {}) }), _jsx("div", { className: "card p-6", children: _jsx(TelegramSettingsSection, {}) }), _jsx("div", { className: "card p-6", children: _jsx(NotificationSettingsSection, {}) })] }));
}
