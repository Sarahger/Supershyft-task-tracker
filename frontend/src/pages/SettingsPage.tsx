import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Camera, Sun, Moon, Monitor, LayoutList, Columns3, CalendarDays, CalendarRange } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTaskViewPreferences } from '../contexts/TaskViewPreferencesContext';
import { OPTIONAL_TASK_VIEWS } from '../lib/taskViewPreferences';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { toast } from '../components/ui/Toast';
import { authApi, notificationsApi } from '../services/endpoints';
import type { NotificationPreferences } from '../types';

function ProfilePhotoSection() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => authApi.uploadProfilePicture(file),
    onSuccess: (res) => {
      updateUser(res.data.data);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      toast.success('Profile photo updated');
    },
    onError: (error: { response?: { data?: { detail?: string; message?: string } } }) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or smaller');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    uploadMutation.mutate(file);
  };

  if (!user) return null;

  const displaySrc = previewUrl || user.profile_picture;
  const busy = uploadMutation.isPending || removeMutation.isPending;

  return (
    <div className="flex items-center gap-4 mb-5 pb-5 border-b border-dark-border">
      <div className="relative shrink-0">
        <Avatar
          name={`${user.first_name} ${user.last_name}`}
          src={displaySrc}
          size="lg"
          className="!h-16 !w-16 !text-lg"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border border-dark-border bg-dark-card text-text-secondary hover:text-text-primary hover:bg-dark-hover flex items-center justify-center disabled:opacity-50"
          title="Upload photo"
          aria-label="Upload profile photo"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">Profile photo</p>
        <p className="text-xs text-text-muted mt-0.5">
          JPEG, PNG, WebP, or GIF · up to 5MB
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            loading={uploadMutation.isPending}
            disabled={busy}
          >
            {user.profile_picture ? 'Change photo' : 'Upload photo'}
          </Button>
          {user.profile_picture && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => removeMutation.mutate()}
              loading={removeMutation.isPending}
              disabled={busy}
              className="text-accent-danger hover:text-accent-danger"
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

function NotificationSettingsSection() {
  const qc = useQueryClient();
  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationsApi.getPreferences().then((r) => r.data.data),
  });

  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (prefs) setLocalPrefs(prefs);
  }, [prefs]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<NotificationPreferences>) => notificationsApi.updatePreferences(data),
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

  const toggle = (key: keyof NotificationPreferences) => {
    if (!localPrefs) return;
    const next = { ...localPrefs, [key]: !localPrefs[key] };
    setLocalPrefs(next);
    saveMutation.mutate({ [key]: next[key] });
  };

  const items: { key: keyof NotificationPreferences; label: string; description: string; disabledBy?: keyof NotificationPreferences }[] = [
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
    return (
      <>
        <h2 className="text-sm font-medium text-text-primary mb-2">Notifications</h2>
        <div className="h-24 bg-surface-subtle rounded animate-pulse" />
      </>
    );
  }

  return (
    <>
      <h2 className="text-sm font-medium text-text-primary mb-1">Notifications</h2>
      <p className="text-sm text-text-secondary mb-4">
        In-app alerts always appear in the bell menu. Choose which events also send email.
      </p>
      <div className="space-y-0 divide-y divide-dark-border border border-dark-border rounded-lg overflow-hidden">
        {items.map((item) => {
          const disabled = item.disabledBy ? !localPrefs[item.disabledBy] : false;
          return (
            <label
              key={item.key}
              className={clsx(
                'flex items-start justify-between gap-4 px-4 py-3 bg-surface-subtle',
                disabled && 'opacity-50',
                !disabled && 'cursor-pointer hover:bg-dark-hover',
              )}
            >
              <div>
                <p className="text-sm text-text-primary">{item.label}</p>
                <p className="text-xs text-text-muted mt-0.5">{item.description}</p>
              </div>
              <input
                type="checkbox"
                checked={localPrefs[item.key]}
                disabled={disabled || saveMutation.isPending}
                onChange={() => toggle(item.key)}
                className="mt-1 rounded border-dark-border"
              />
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => testEmailMutation.mutate()}
          loading={testEmailMutation.isPending}
          disabled={!localPrefs.email_notifications_enabled}
        >
          Send test email
        </Button>
        <p className="text-xs text-text-muted">
          Requires server SMTP settings (`EMAIL_ENABLED=true` and SMTP credentials).
        </p>
      </div>
    </>
  );
}

const OPTIONAL_VIEW_ICONS = {
  kanban: Columns3,
  calendar: CalendarDays,
  weekly: CalendarRange,
} as const;

function TaskViewsSettingsSection() {
  const { isViewEnabled, toggleView } = useTaskViewPreferences();

  return (
    <>
      <h2 className="text-sm font-medium text-text-primary mb-1">Task views</h2>
      <p className="text-sm text-text-secondary mb-4">
        Choose which views appear on the Tasks screen. List is always available.
      </p>
      <div className="space-y-0 divide-y divide-dark-border border border-dark-border rounded-lg overflow-hidden">
        <label className="flex items-start justify-between gap-4 px-4 py-3 bg-surface-subtle opacity-70 cursor-default">
          <div className="flex items-start gap-3">
            <LayoutList className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-text-primary">List</p>
              <p className="text-xs text-text-muted mt-0.5">Table view with sortable columns</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked
            disabled
            readOnly
            className="mt-1 rounded border-dark-border"
            aria-label="List view always enabled"
          />
        </label>
        {OPTIONAL_TASK_VIEWS.map((view) => {
          const Icon = OPTIONAL_VIEW_ICONS[view.id];
          return (
            <label
              key={view.id}
              className="flex items-start justify-between gap-4 px-4 py-3 bg-surface-subtle cursor-pointer hover:bg-dark-hover"
            >
              <div className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-text-primary">{view.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{view.description}</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isViewEnabled(view.id)}
                onChange={() => toggleView(view.id)}
                className="mt-1 rounded border-dark-border"
              />
            </label>
          );
        })}
      </div>
    </>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { preference, setPreference } = useTheme();

  return (
    <div className="max-w-2xl mx-auto pb-12 space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Profile and workspace configuration"
        onMobileBack={() => navigate(-1)}
      />

      <div className="card p-6">
        <h2 className="text-sm font-medium text-text-primary mb-4">Profile</h2>
        <ProfilePhotoSection />
        <div className="space-y-0 text-sm">
          <div className="flex justify-between py-3 border-b border-dark-border"><span className="text-text-muted">Name</span><span className="text-text-primary">{user?.first_name} {user?.last_name}</span></div>
          <div className="flex justify-between py-3 border-b border-dark-border"><span className="text-text-muted">Email</span><span className="text-text-primary">{user?.email}</span></div>
          <div className="flex justify-between py-3 border-b border-dark-border"><span className="text-text-muted">Role</span><span className="text-text-primary capitalize">{user?.role}</span></div>
          <div className="flex justify-between py-3 border-b border-dark-border"><span className="text-text-muted">Job Title</span><span className="text-text-primary">{user?.job_title || '—'}</span></div>
          <div className="flex justify-between py-3"><span className="text-text-muted">Departments</span><span className="text-text-primary">{user?.departments?.map((d) => d.name).join(', ') || '—'}</span></div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-sm font-medium text-text-primary mb-1">Appearance</h2>
        <p className="text-sm text-text-secondary mb-4">
          Choose how the app looks. Your preference is saved on this device.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { id: 'light' as const, label: 'Light', icon: Sun },
            { id: 'dark' as const, label: 'Dark', icon: Moon },
            { id: 'system' as const, label: 'System', icon: Monitor },
          ]).map((option) => {
            const selected = preference === option.id;
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setPreference(option.id)}
                className={clsx(
                  'flex flex-col items-stretch gap-3 rounded-lg border p-3 transition-colors duration-hover text-left',
                  selected
                    ? 'border-text-primary ring-1 ring-text-primary/20 bg-surface-highlight'
                    : 'border-dark-border bg-surface-subtle hover:bg-dark-hover',
                )}
              >
                <div className={clsx(
                  'w-full aspect-[5/3] rounded-xl border border-dark-border overflow-hidden flex',
                  option.id === 'light' && 'theme-preview-light',
                  option.id === 'dark' && 'theme-preview-dark',
                  option.id === 'system' && 'theme-preview-system',
                )} />
                <div className="flex items-center gap-2 px-0.5">
                  <Icon className="h-4 w-4 text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">{option.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-6">
        <TaskViewsSettingsSection />
      </div>

      <div className="card p-6">
        <NotificationSettingsSection />
      </div>
    </div>
  );
}
