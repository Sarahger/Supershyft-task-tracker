import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Plus, Trash2, Sun, Moon, Monitor, LayoutList, Columns3, CalendarDays, CalendarRange } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTaskViewPreferences } from '../contexts/TaskViewPreferencesContext';
import { OPTIONAL_TASK_VIEWS } from '../lib/taskViewPreferences';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { customFieldsApi, notificationsApi, type CustomFieldDefinition } from '../services/endpoints';
import type { NotificationPreferences } from '../types';

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

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select (dropdown)' },
  { value: 'date', label: 'Date' },
  { value: 'checkbox', label: 'Checkbox' },
];

const APPLIES_TO = [
  { value: 'task', label: 'Task' },
  { value: 'project', label: 'Project' },
  { value: 'status', label: 'Status' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { preference, setPreference } = useTheme();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'administrator';

  const [newField, setNewField] = useState({
    name: '',
    field_type: 'text',
    applies_to: 'task',
    options: '',
  });

  const { data: customFields, isLoading } = useQuery({
    queryKey: ['custom-fields', 'all'],
    queryFn: () => customFieldsApi.list('task').then((r) => r.data.data),
    enabled: isAdmin,
  });

  const createFieldMutation = useMutation({
    mutationFn: () =>
      customFieldsApi.create({
        name: newField.name.trim(),
        field_type: newField.field_type,
        applies_to: newField.applies_to,
        options: newField.field_type === 'select'
          ? newField.options.split('\n').map((o) => o.trim()).filter(Boolean)
          : [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
      setNewField({ name: '', field_type: 'text', applies_to: 'task', options: '' });
      toast.success('Custom field created');
    },
    onError: () => toast.error('Could not create field'),
  });

  const removeFieldMutation = useMutation({
    mutationFn: (id: number) => customFieldsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success('Field removed');
    },
    onError: () => toast.error('Could not remove field'),
  });

  return (
    <div className="max-w-2xl mx-auto pb-12 space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Profile and workspace configuration"
        onMobileBack={() => navigate(-1)}
      />

      <div className="card p-6">
        <h2 className="text-sm font-medium text-text-primary mb-4">Profile</h2>
        <div className="space-y-0 text-sm">
          <div className="flex justify-between py-3 border-b border-dark-border"><span className="text-text-muted">Name</span><span className="text-text-primary">{user?.first_name} {user?.last_name}</span></div>
          <div className="flex justify-between py-3 border-b border-dark-border"><span className="text-text-muted">Email</span><span className="text-text-primary">{user?.email}</span></div>
          <div className="flex justify-between py-3 border-b border-dark-border"><span className="text-text-muted">Role</span><span className="text-text-primary capitalize">{user?.role}</span></div>
          <div className="flex justify-between py-3 border-b border-dark-border"><span className="text-text-muted">Job Title</span><span className="text-text-primary">{user?.job_title || '—'}</span></div>
          <div className="flex justify-between py-3"><span className="text-text-muted">Departments</span><span className="text-text-primary">{user?.departments?.map((d) => d.name).join(', ')}</span></div>
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

      {isAdmin && (
        <div className="card p-6">
          <h2 className="text-sm font-medium text-text-primary mb-2">Custom fields</h2>
          <p className="text-sm text-text-secondary mb-4">
            Add your own properties beyond the built-in fields. Task fields appear in the task editor; project and status scopes are stored for future use.
          </p>

          {isLoading ? (
            <div className="h-24 bg-surface-subtle rounded animate-pulse" />
          ) : (
            <>
              {customFields && customFields.length > 0 ? (
                <ul className="space-y-2 mb-6">
                  {customFields.map((field: CustomFieldDefinition) => (
                    <li
                      key={field.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-dark-border bg-surface-subtle"
                    >
                      <div>
                        <p className="text-sm text-text-primary">{field.name}</p>
                        <p className="text-2xs text-text-muted capitalize">
                          {field.field_type} · {field.applies_to} · {field.field_key}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFieldMutation.mutate(field.id)}
                        disabled={removeFieldMutation.isPending}
                        className="toolbar-btn text-text-muted hover:text-red-400"
                        aria-label={`Remove ${field.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted mb-6">No custom fields yet.</p>
              )}

              <div className="border-t border-dark-border pt-4 space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Add field</p>
                <Input
                  label="Field name"
                  value={newField.name}
                  onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                  placeholder="e.g. Sprint, Client tier"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Type"
                    value={newField.field_type}
                    onChange={(e) => setNewField({ ...newField, field_type: e.target.value })}
                    options={FIELD_TYPES}
                  />
                  <Select
                    label="Applies to"
                    value={newField.applies_to}
                    onChange={(e) => setNewField({ ...newField, applies_to: e.target.value })}
                    options={APPLIES_TO}
                  />
                </div>
                {newField.field_type === 'select' && (
                  <Textarea
                    label="Options (one per line)"
                    value={newField.options}
                    onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                    rows={3}
                    placeholder={'Option A\nOption B'}
                  />
                )}
                <Button
                  size="sm"
                  onClick={() => createFieldMutation.mutate()}
                  loading={createFieldMutation.isPending}
                  disabled={!newField.name.trim()}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Add field
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="card p-6">
        <NotificationSettingsSection />
      </div>
    </div>
  );
}
