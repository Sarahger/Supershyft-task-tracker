import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';

interface UserDrawerContextType {
  selectedUserId: number | null;
  openUser: (id: number) => void;
  closeUser: () => void;
}

const UserDrawerContext = createContext<UserDrawerContextType | undefined>(undefined);

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function UserDrawerProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedUserId = useMemo(
    () => parsePositiveInt(searchParams.get('user')),
    [searchParams],
  );

  const openUser = useCallback(
    (id: number) => {
      const idStr = String(id);
      const alreadyOpen = searchParams.has('user');
      setSearchParams(
        (prev) => {
          if (prev.get('user') === idStr) return prev;
          const next = new URLSearchParams(prev);
          next.set('user', idStr);
          return next;
        },
        { replace: alreadyOpen },
      );
    },
    [searchParams, setSearchParams],
  );

  const closeUser = useCallback(() => {
    setSearchParams(
      (prev) => {
        if (!prev.has('user')) return prev;
        const next = new URLSearchParams(prev);
        next.delete('user');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const value = useMemo(
    () => ({ selectedUserId, openUser, closeUser }),
    [selectedUserId, openUser, closeUser],
  );

  return (
    <UserDrawerContext.Provider value={value}>
      {children}
    </UserDrawerContext.Provider>
  );
}

export function useUserDrawer() {
  const ctx = useContext(UserDrawerContext);
  if (!ctx) throw new Error('useUserDrawer must be used within UserDrawerProvider');
  return ctx;
}
