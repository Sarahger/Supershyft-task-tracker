import type { AttendanceUserBrief } from '../../types';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../ui/Skeleton';

interface Props {
  open: boolean;
  title: string;
  people: AttendanceUserBrief[];
  onClose: () => void;
  onSelectUser: (userId: number) => void;
}

export function AttendanceHrPeopleModal({ open, title, people, onClose, onSelectUser }: Props) {
  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="md">
      {people.length === 0 ? (
        <EmptyState title="No one in this group today." description="Counts update as people mark attendance." />
      ) : (
        <ul className="divide-y divide-dark-border -mx-1" data-testid="hr-stat-people-list">
          {people.map((user) => {
            const name = `${user.first_name} ${user.last_name}`.trim();
            const dept = (user.departments || []).join(', ') || '—';
            return (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectUser(user.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-1 py-2.5 rounded-lg text-left hover:bg-dark-hover transition-colors duration-hover"
                >
                  <Avatar name={name} src={user.profile_picture} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{name}</p>
                    <p className="text-xs text-text-muted truncate">
                      {user.job_title ? `${user.job_title} · ${dept}` : dept}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
