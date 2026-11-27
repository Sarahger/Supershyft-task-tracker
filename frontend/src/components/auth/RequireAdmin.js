import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessAdminFeatures } from '../../lib/roles';
export function RequireAdmin({ children }) {
    const { user, isLoading } = useAuth();
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center py-16", children: _jsx("div", { className: "animate-spin h-7 w-7 border-2 border-dark-border border-t-text-primary rounded-full" }) }));
    }
    if (!canAccessAdminFeatures(user)) {
        return _jsx(Navigate, { to: "/settings", replace: true });
    }
    return children;
}
