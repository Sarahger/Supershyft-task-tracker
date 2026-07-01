import { Navigate } from 'react-router-dom';

/** Analytics dashboard removed — homepage is the task workspace. */
export default function DashboardPage() {
  return <Navigate to="/" replace />;
}
