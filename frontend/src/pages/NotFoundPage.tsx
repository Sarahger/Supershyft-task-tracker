import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-6xl font-semibold text-text-muted">404</h1>
      <p className="text-lg text-text-secondary mt-4">Page not found</p>
      <Link to="/" className="mt-6"><Button>Go to Dashboard</Button></Link>
    </div>
  );
}
