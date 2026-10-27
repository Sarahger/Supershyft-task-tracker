import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../ui/Toast';
import { tasksApi } from '../../services/endpoints';
import { formatDueNoonForApi, toDateInput } from '../../lib/weeklyPlanParse';
import type { WeeklyCommitment } from '../../types';

export function OverdueRevisionModal({
  item,
  onClose,
}: {
  item: WeeklyCommitment | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [dueDate, setDueDate] = useState(toDateInput(item?.due_date));

  useEffect(() => {
    setReason('');
    setDueDate(toDateInput(item?.due_date));
  }, [item]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!item?.task_id) throw new Error('Missing task');
      if (!reason.trim()) throw new Error('A reason is required');
      if (!dueDate) throw new Error('A revised deadline is required');
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
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string; message?: string } }; message?: string })
        ?.response?.data?.detail
        || (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (err as Error).message
        || 'Could not revise deadline';
      toast.error(typeof message === 'string' ? message : 'Could not revise deadline');
    },
  });

  return (
    <Modal isOpen={Boolean(item)} onClose={onClose} title="Revise overdue deadline" size="md">
      {item && (
        <div className="space-y-4">
          <p className="text-sm text-text-primary">{item.title}</p>
          <p className="text-xs text-text-muted">
            Original deadline stays on record. This only updates the current due date.
          </p>
          <Input
            label="Revised due date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <label className="block">
            <span className="block text-xs font-medium text-text-secondary mb-1.5">Reason for the delay</span>
            <textarea
              className="input min-h-[88px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What slipped, and what is the new plan?"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="button" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Save revision
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
