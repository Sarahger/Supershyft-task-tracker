import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';

interface DeleteTaskModalProps {
  isOpen: boolean;
  taskTitle?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
}

export function DeleteTaskModal({
  isOpen,
  taskTitle,
  onClose,
  onConfirm,
  isPending = false,
}: DeleteTaskModalProps) {
  const [reason, setReason] = useState('');

  const handleClose = () => {
    setReason('');
    onClose();
  };

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    setReason('');
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Delete task" size="sm">
      <p className="text-sm text-text-secondary mb-1">
        {taskTitle ? (
          <>Delete <span className="text-text-primary font-medium">&ldquo;{taskTitle}&rdquo;</span>?</>
        ) : (
          'Delete this task?'
        )}
      </p>
      <p className="text-sm text-text-muted mb-3">This action cannot be undone. Please provide a reason.</p>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why are you deleting this task?"
        rows={3}
        className="text-sm mb-4"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={handleClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!reason.trim() || isPending}
          loading={isPending}
          className="bg-accent-danger hover:opacity-90"
        >
          Delete task
        </Button>
      </div>
    </Modal>
  );
}
