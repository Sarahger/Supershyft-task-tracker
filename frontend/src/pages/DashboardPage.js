import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate } from 'react-router-dom';
/** Analytics dashboard removed — homepage is the task workspace. */
export default function DashboardPage() {
    return _jsx(Navigate, { to: "/", replace: true });
}
