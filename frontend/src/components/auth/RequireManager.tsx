import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessManagerFeatures } from '../../lib/roles';

export function RequireManager({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-7 w-7 border-2 border-dark-border border-t-text-primary rounded-full" />
      </div>
    );
  }

  if (!canAccessManagerFeatures(user)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
