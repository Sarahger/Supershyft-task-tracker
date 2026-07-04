import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';

interface TaskDrawerContextType {
  selectedTaskId: number | null;
  openTask: (id: number) => void;
  closeTask: () => void;
  isCreateOpen: boolean;
  openCreate: () => void;
  closeCreate: () => void;
}

const TaskDrawerContext = createContext<TaskDrawerContextType | undefined>(undefined);

export function TaskDrawerProvider({ children }: { children: ReactNode }) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const openTask = useCallback((id: number) => setSelectedTaskId(id), []);
  const closeTask = useCallback(() => setSelectedTaskId(null), []);
  const openCreate = useCallback(() => setIsCreateOpen(true), []);
  const closeCreate = useCallback(() => setIsCreateOpen(false), []);

  const value = useMemo(
    () => ({
      selectedTaskId,
      openTask,
      closeTask,
      isCreateOpen,
      openCreate,
      closeCreate,
    }),
    [selectedTaskId, openTask, closeTask, isCreateOpen, openCreate, closeCreate],
  );

  return (
    <TaskDrawerContext.Provider value={value}>
      {children}
    </TaskDrawerContext.Provider>
  );
}

export function useTaskDrawer() {
  const ctx = useContext(TaskDrawerContext);
  if (!ctx) throw new Error('useTaskDrawer must be used within TaskDrawerProvider');
  return ctx;
}
