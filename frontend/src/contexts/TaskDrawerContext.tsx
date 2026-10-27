import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';

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

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Update search params; `push` adds a history entry (Back closes overlay). */
function patchParams(
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  patch: (next: URLSearchParams) => boolean,
  mode: 'push' | 'replace',
) {
  setSearchParams(
    (prev) => {
      const next = new URLSearchParams(prev);
      const changed = patch(next);
      return changed ? next : prev;
    },
    { replace: mode === 'replace' },
  );
}

export function TaskDrawerProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDefaultProjectId, setCreateDefaultProjectId] = useState<number | null>(null);

  const selectedTaskId = useMemo(
    () => parsePositiveInt(searchParams.get('task')),
    [searchParams],
  );
  const isCreateOpen = searchParams.get('create') === '1';

  useEffect(() => {
    if (!isCreateOpen) setCreateDefaultProjectId(null);
  }, [isCreateOpen]);

  const openTask = useCallback(
    (id: number) => {
      const idStr = String(id);
      const alreadyOpen = searchParams.has('task');
      patchParams(
        setSearchParams,
        (next) => {
          if (next.get('task') === idStr) return false;
          next.set('task', idStr);
          return true;
        },
        // First open → push (Back closes). Switching tasks → replace.
        alreadyOpen ? 'replace' : 'push',
      );
    },
    [searchParams, setSearchParams],
  );

  const closeTask = useCallback(() => {
    patchParams(
      setSearchParams,
      (next) => {
        if (!next.has('task')) return false;
        next.delete('task');
        return true;
      },
      'replace',
    );
  }, [setSearchParams]);

  const openCreate = useCallback(
    (options?: OpenCreateOptions) => {
      setCreateDefaultProjectId(options?.projectId ?? null);
      patchParams(
        setSearchParams,
        (next) => {
          if (next.get('create') === '1') return false;
          next.set('create', '1');
          return true;
        },
        searchParams.has('create') ? 'replace' : 'push',
      );
    },
    [searchParams, setSearchParams],
  );

  const closeCreate = useCallback(() => {
    setCreateDefaultProjectId(null);
    patchParams(
      setSearchParams,
      (next) => {
        if (!next.has('create')) return false;
        next.delete('create');
        return true;
      },
      'replace',
    );
  }, [setSearchParams]);

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
    [
      selectedTaskId,
      openTask,
      closeTask,
      isCreateOpen,
      createDefaultProjectId,
      openCreate,
      closeCreate,
    ],
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
