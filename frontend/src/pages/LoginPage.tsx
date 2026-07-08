import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppLogo } from '../components/layout/AppLogo';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (!axiosErr.response) toast.error('Cannot reach the server. Start the backend on port 8000.');
      else if (axiosErr.response.status === 401) toast.error('Invalid email or password');
      else toast.error('Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <AppLogo size="lg" showName={false} />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">SuperShyft</h1>
          <p className="text-sm text-text-muted mt-1.5">Sign in to your workspace</p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" loading={loading} className="w-full mt-2">Continue</Button>
          </form>
        </div>
        <p className="text-2xs text-text-muted text-center mt-6">Demo: admin@company.com / admin123</p>
      </div>
    </div>
  );
}
