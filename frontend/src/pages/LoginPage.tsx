import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppLogo } from '../components/layout/AppLogo';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestOtp(email.trim());
      setStep('code');
      toast.success('Login code sent — check your email');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      if (!axiosErr.response) toast.error('Cannot reach the server. Start the backend on port 8000.');
      else toast.error(axiosErr.response.data?.detail || 'Could not send login code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyOtp(email.trim(), code.trim());
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (!axiosErr.response) toast.error('Cannot reach the server. Start the backend on port 8000.');
      else if (axiosErr.response.status === 401) toast.error('Invalid or expired code');
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
          <p className="text-sm text-text-muted mt-1.5">
            {step === 'email' ? 'Sign in to your workspace' : 'Enter the code sent to your email'}
          </p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-8">
          {step === 'email' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" loading={loading} className="w-full mt-2">
                Send login code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                disabled
              />
              <Input
                label="Login code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                required
                maxLength={6}
              />
              <Button type="submit" loading={loading} className="w-full mt-2" disabled={code.length !== 6}>
                Verify & sign in
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setCode('');
                }}
                className="w-full text-sm text-text-muted hover:text-text-secondary"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
        <p className="text-2xs text-text-muted text-center mt-6">
          We email a one-time code — no password needed.
        </p>
      </div>
    </div>
  );
}
