import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input, Select, Textarea } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { customFieldsApi, type CustomFieldDefinition } from '../services/endpoints';

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
  const { user } = useAuth();
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
      <PageHeader title="Settings" subtitle="Profile and workspace configuration" />

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

      {isAdmin && (
        <div className="card p-6">
          <h2 className="text-sm font-medium text-text-primary mb-2">Custom fields</h2>
          <p className="text-sm text-text-secondary mb-4">
            Add your own properties beyond the built-in fields. Task fields appear in the task editor; project and status scopes are stored for future use.
          </p>

          {isLoading ? (
            <div className="h-24 bg-dark-muted/30 rounded animate-pulse" />
          ) : (
            <>
              {customFields && customFields.length > 0 ? (
                <ul className="space-y-2 mb-6">
                  {customFields.map((field: CustomFieldDefinition) => (
                    <li
                      key={field.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-dark-border bg-dark-bg/50"
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
        <h2 className="text-sm font-medium text-text-primary mb-2">Notification Settings</h2>
        <p className="text-sm text-text-secondary">Email and in-app notification preferences can be configured here.</p>
        <p className="text-xs text-text-muted mt-2">Coming soon: full notification preferences UI</p>
      </div>
    </div>
  );
}
