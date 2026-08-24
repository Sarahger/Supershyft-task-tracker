import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, Pencil, Plus } from 'lucide-react';
import clsx from 'clsx';
import { officesApi } from '../services/endpoints';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import type { Office } from '../types';

type OfficeFormState = {
  name: string;
  latitude: string;
  longitude: string;
  radius_meters: string;
  max_gps_accuracy_meters: string;
  is_active: boolean;
};

const emptyForm = (): OfficeFormState => ({
  name: '',
  latitude: '',
  longitude: '',
  radius_meters: '150',
  max_gps_accuracy_meters: '100',
  is_active: true,
});

function officeToForm(office: Office): OfficeFormState {
  return {
    name: office.name,
    latitude: String(office.latitude),
    longitude: String(office.longitude),
    radius_meters: String(office.radius_meters),
    max_gps_accuracy_meters: String(office.max_gps_accuracy_meters),
    is_active: office.is_active,
  };
}

function OfficeFormModal({
  open,
  initial,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initial: OfficeFormState;
  onClose: () => void;
  onSave: (form: OfficeFormState) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[var(--overlay-backdrop)]" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-dark-border bg-dark-card p-5 space-y-4">
        <h2 className="text-base font-semibold text-text-primary">
          {initial.name ? 'Edit office' : 'Add office'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="sm:col-span-2 text-sm">
            <span className="text-text-muted">Name</span>
            <input
              className="input mt-1 w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="text-text-muted">Latitude</span>
            <input
              className="input mt-1 w-full"
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="text-text-muted">Longitude</span>
            <input
              className="input mt-1 w-full"
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="text-text-muted">Radius (meters)</span>
            <input
              className="input mt-1 w-full"
              type="number"
              min="1"
              value={form.radius_meters}
              onChange={(e) => setForm({ ...form, radius_meters: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="text-text-muted">Max GPS accuracy (meters)</span>
            <input
              className="input mt-1 w-full"
              type="number"
              min="1"
              value={form.max_gps_accuracy_meters}
              onChange={(e) => setForm({ ...form, max_gps_accuracy_meters: e.target.value })}
            />
          </label>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active for WFO verification
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || !form.name.trim()} onClick={() => onSave(form)}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OfficesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; office?: Office } | null>(null);

  const { data: offices = [], isLoading } = useQuery({
    queryKey: ['offices'],
    queryFn: () => officesApi.list().then((r) => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: async (form: OfficeFormState) => {
      const payload = {
        name: form.name.trim(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius_meters: Number(form.radius_meters),
        max_gps_accuracy_meters: Number(form.max_gps_accuracy_meters),
        is_active: form.is_active,
      };
      if (modal?.mode === 'edit' && modal.office) {
        return officesApi.update(modal.office.id, payload).then((r) => r.data.data);
      }
      return officesApi.create(payload).then((r) => r.data.data);
    },
    onSuccess: () => {
      toast.success('Office saved');
      queryClient.invalidateQueries({ queryKey: ['offices'] });
      setModal(null);
    },
    onError: () => toast.error('Could not save office'),
  });

  const formInitial = modal?.mode === 'edit' && modal.office ? officeToForm(modal.office) : emptyForm();

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-4">
      <PageHeader
        title="Offices"
        subtitle="Configure office locations for WFO GPS verification"
        onMobileBack={() => navigate('/settings')}
        action={
          <Button size="sm" className="gap-1.5" onClick={() => setModal({ mode: 'create' })}>
            <Plus className="h-4 w-4" />
            Add office
          </Button>
        }
      />

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 animate-pulse h-40 bg-dark-muted/30" />
        ) : offices.length === 0 ? (
          <EmptyState
            title="No offices configured"
            description="Add an office with coordinates and attendance radius to enable WFO verification."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="task-table-header">
                <tr className="text-left text-2xs uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-2.5 font-medium">Office</th>
                  <th className="px-4 py-2.5 font-medium">Coordinates</th>
                  <th className="px-4 py-2.5 font-medium">Radius</th>
                  <th className="px-4 py-2.5 font-medium">Max GPS accuracy</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {offices.map((office) => (
                  <tr key={office.id} className="border-b border-dark-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-text-muted shrink-0" />
                        <span className="font-medium text-text-primary">{office.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary tabular-nums text-xs">
                      {office.latitude.toFixed(5)}, {office.longitude.toFixed(5)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{office.radius_meters}m</td>
                    <td className="px-4 py-3 text-text-secondary">{office.max_gps_accuracy_meters}m</td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'chip text-2xs',
                          office.is_active ? 'status-chip-active' : 'status-chip-inactive',
                        )}
                      >
                        {office.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => setModal({ mode: 'edit', office })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <OfficeFormModal
        open={!!modal}
        initial={formInitial}
        onClose={() => setModal(null)}
        onSave={(form) => saveMutation.mutate(form)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}
