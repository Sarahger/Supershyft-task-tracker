import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface DeleteProjectModalProps {
  isOpen: boolean;
  projectName?: string;
  onClose: () => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function DeleteProjectModal({
  isOpen,
  projectName,
  onClose,
  onConfirm,
  isPending = false,
}: DeleteProjectModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete project" size="sm">
      <p className="text-sm text-text-secondary mb-1">
        {projectName ? (
          <>Delete <span className="text-text-primary font-medium">&ldquo;{projectName}&rdquo;</span>?</>
        ) : (
          'Delete this project?'
        )}
      </p>
      <p className="text-sm text-text-muted mb-4">
        This project has no tasks and will be permanently removed.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isPending}
          loading={isPending}
          className="bg-accent-danger hover:opacity-90"
        >
          Delete project
        </Button>
      </div>
    </Modal>
  );
}
