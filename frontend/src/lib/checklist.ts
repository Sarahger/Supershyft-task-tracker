import type { Checklist } from '../types';

export interface ChecklistProgress {
  total: number;
  done: number;
  percent: number;
}

export function getChecklistProgress(checklists?: Checklist[]): ChecklistProgress | null {
  const items = checklists?.flatMap((cl) => cl.items) ?? [];
  const total = items.length;
  if (!total) return null;

  const done = items.filter((item) => item.is_completed).length;
  return {
    total,
    done,
    percent: Math.round((done / total) * 100),
  };
}
