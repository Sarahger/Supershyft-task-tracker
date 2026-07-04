import { createContext, useContext, useState, ReactNode } from 'react';

interface UserDrawerContextType {
  selectedUserId: number | null;
  openUser: (id: number) => void;
  closeUser: () => void;
}

const UserDrawerContext = createContext<UserDrawerContextType | undefined>(undefined);

export function UserDrawerProvider({ children }: { children: ReactNode }) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  return (
    <UserDrawerContext.Provider
      value={{
        selectedUserId,
        openUser: setSelectedUserId,
        closeUser: () => setSelectedUserId(null),
      }}
    >
      {children}
    </UserDrawerContext.Provider>
  );
}

export function useUserDrawer() {
  const ctx = useContext(UserDrawerContext);
  if (!ctx) throw new Error('useUserDrawer must be used within UserDrawerProvider');
  return ctx;
}
