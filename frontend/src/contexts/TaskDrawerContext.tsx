import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';

export type OpenCreateOptions = {
  projectId?: number;
};

interface TaskDrawerContextType {
  selectedTaskId: number | null;
  openTask: (id: number) => void;
  closeTask: () => void;
  isCreateOpen: boolean;
  createDefaultProjectId: number | null;
  openCreate: (options?: OpenCreateOptions) => void;
  closeCreate: () => void;
}

const TaskDrawerContext = createContext<TaskDrawerContextType | undefined>(undefined);

export function TaskDrawerProvider({ children }: { children: ReactNode }) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDefaultProjectId, setCreateDefaultProjectId] = useState<number | null>(null);

  const openTask = useCallback((id: number) => setSelectedTaskId(id), []);
  const closeTask = useCallback(() => setSelectedTaskId(null), []);
  const openCreate = useCallback((options?: OpenCreateOptions) => {
    setCreateDefaultProjectId(options?.projectId ?? null);
    setIsCreateOpen(true);
  }, []);
  const closeCreate = useCallback(() => {
    setIsCreateOpen(false);
    setCreateDefaultProjectId(null);
  }, []);

  const value = useMemo(
    () => ({
      selectedTaskId,
      openTask,
      closeTask,
      isCreateOpen,
      createDefaultProjectId,
      openCreate,
      closeCreate,
    }),
    [selectedTaskId, openTask, closeTask, isCreateOpen, createDefaultProjectId, openCreate, closeCreate],
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
