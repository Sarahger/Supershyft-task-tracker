import clsx from 'clsx';
import { Avatar } from '../ui/Avatar';
import type { WeeklyEmployee } from '../../types';

export function EmployeeProfileStrip({
  employees,
  selectedId,
  onSelect,
  className,
}: {
  employees: WeeklyEmployee[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  className?: string;
}) {
  if (!employees.length) {
    return (
      <p className="text-sm text-text-muted py-3">No employees in this department.</p>
    );
  }

  return (
    <div className={clsx('min-h-0 overflow-y-auto', className)}>
      <div className="flex flex-wrap gap-2">
        {employees.map((emp) => {
          const name = `${emp.first_name} ${emp.last_name}`.trim();
          const selected = emp.id === selectedId;
          return (
            <button
              key={emp.id}
              type="button"
              onClick={() => onSelect(emp.id)}
              className={clsx(
                'inline-flex items-center gap-2 w-fit shrink-0 rounded-full border px-2.5 py-1.5 text-left transition-colors',
                selected
                  ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                  : 'border-dark-border bg-dark-card text-text-secondary hover:border-text-muted hover:text-text-primary',
              )}
              aria-pressed={selected}
            >
              <span className="relative">
                <Avatar name={name} src={emp.profile_picture ?? undefined} size="sm" />
                <span
                  className={clsx(
                    'absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-dark-card',
                    emp.has_overdue ? 'bg-accent-danger' : emp.has_submitted ? 'bg-accent-success' : 'bg-text-muted',
                  )}
                  title={emp.has_overdue ? 'Has overdue tasks' : emp.has_submitted ? 'Submitted' : 'Pending'}
                />
              </span>
              <span className="text-sm font-medium whitespace-nowrap pr-0.5">{emp.first_name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
