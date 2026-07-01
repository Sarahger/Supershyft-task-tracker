import { createContext, useContext, useState, ReactNode } from 'react';

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

  return (
    <TaskDrawerContext.Provider
      value={{
        selectedTaskId,
        openTask: setSelectedTaskId,
        closeTask: () => setSelectedTaskId(null),
        isCreateOpen,
        openCreate: () => setIsCreateOpen(true),
        closeCreate: () => setIsCreateOpen(false),
      }}
    >
      {children}
    </TaskDrawerContext.Provider>
  );
}

export function useTaskDrawer() {
  const ctx = useContext(TaskDrawerContext);
  if (!ctx) throw new Error('useTaskDrawer must be used within TaskDrawerProvider');
  return ctx;
}
