import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { USER_STATUSES, USER_STATUS_LABELS, type User } from '../../types';

export interface UserFormState {
  first_name: string;
  last_name: string;
  email: string;
  role: User['role'];
  status: string;
  job_title: string;
  phone: string;
  department_ids: number[];
  new_department_names: string[];
}

export const emptyUserForm = (): UserFormState => ({
  first_name: '',
  last_name: '',
  email: '',
  role: 'employee',
  status: 'active',
  job_title: '',
  phone: '',
  department_ids: [],
  new_department_names: [],
});

export function userToForm(user: User): UserFormState {
  return {
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role,
    status: user.status,
    job_title: user.job_title || '',
    phone: user.phone || '',
    department_ids: user.departments?.map((d) => d.id) ?? [],
    new_department_names: [],
  };
}

interface UserFormModalProps {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  form: UserFormState;
  setForm: React.Dispatch<React.SetStateAction<UserFormState>>;
  roleOptions: { value: string; label: string }[];
  departments: { id: number; name: string }[] | undefined;
  newDeptInput: string;
  setNewDeptInput: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  showStatus?: boolean;
}

export function UserFormModal({
  isOpen,
  title,
  submitLabel,
  form,
  setForm,
  roleOptions,
  departments,
  newDeptInput,
  setNewDeptInput,
  onClose,
  onSubmit,
  isSubmitting,
  showStatus = false,
}: UserFormModalProps) {
  const selectedDepartments = form.department_ids
    .map((id) => departments?.find((d) => d.id === id))
    .filter(Boolean) as { id: number; name: string }[];

  const availableDepartments = (departments ?? []).filter(
    (d) => !form.department_ids.includes(d.id),
  );

  const addExistingDepartment = (deptId: number) => {
    if (!deptId || form.department_ids.includes(deptId)) return;
    setForm((prev) => ({ ...prev, department_ids: [...prev.department_ids, deptId] }));
  };

  const removeDepartment = (deptId: number) => {
    setForm((prev) => ({
      ...prev,
      department_ids: prev.department_ids.filter((id) => id !== deptId),
    }));
  };

  const addNewDepartmentName = () => {
    const name = newDeptInput.trim();
    if (!name) return;
    const existing = departments?.find((d) => d.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      addExistingDepartment(existing.id);
    } else if (!form.new_department_names.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setForm((prev) => ({
        ...prev,
        new_department_names: [...prev.new_department_names, name],
      }));
    }
    setNewDeptInput('');
  };

  const removeNewDepartmentName = (name: string) => {
    setForm((prev) => ({
      ...prev,
      new_department_names: prev.new_department_names.filter((n) => n !== name),
    }));
  };

  const canSubmit =
    form.first_name.trim() && form.last_name.trim() && form.email.trim();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First name"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          />
          <Input
            label="Last name"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          />
        </div>
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        {!showStatus && (
          <p className="text-xs text-text-muted -mt-2">
            Users sign in with a one-time email code — no password needed.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as User['role'] })}
            options={roleOptions}
          />
          {showStatus && (
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={USER_STATUSES.map((status) => ({
                value: status,
                label: USER_STATUS_LABELS[status],
              }))}
            />
          )}
        </div>
        <Input
          label="Job title"
          value={form.job_title}
          onChange={(e) => setForm({ ...form, job_title: e.target.value })}
        />
        <Input
          label="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-2">Departments</label>
          <div className="flex flex-wrap gap-2 min-h-[2rem] mb-2">
            {selectedDepartments.map((d) => (
              <span key={`existing-${d.id}`} className="dept-chip-existing">
                <span className="text-sm text-text-primary">{d.name}</span>
                <button
                  type="button"
                  onClick={() => removeDepartment(d.id)}
                  className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-surface-active transition-colors"
                  aria-label={`Remove ${d.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {form.new_department_names.map((name) => (
              <span key={`new-${name}`} className="dept-chip-new">
                <span className="text-sm text-text-primary">{name}</span>
                <span className="dept-chip-new-label">new</span>
                <button
                  type="button"
                  onClick={() => removeNewDepartmentName(name)}
                  className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-surface-active transition-colors"
                  aria-label={`Remove ${name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {!selectedDepartments.length && !form.new_department_names.length && (
              <p className="text-sm text-text-muted py-1">No departments selected</p>
            )}
          </div>
          {availableDepartments.length > 0 && (
            <select
              value=""
              onChange={(e) => addExistingDepartment(Number(e.target.value))}
              className="input text-sm mb-2"
              aria-label="Add existing department"
            >
              <option value="">Add existing department…</option>
              {availableDepartments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <Input
              value={newDeptInput}
              onChange={(e) => setNewDeptInput(e.target.value)}
              placeholder="Or type a new department name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addNewDepartmentName();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addNewDepartmentName}
              disabled={!newDeptInput.trim()}
              className="shrink-0 mt-auto"
            >
              Add
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} loading={isSubmitting} disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
