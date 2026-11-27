import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    const [step, setStep] = useState('email');
    const [loading, setLoading] = useState(false);
    const { requestOtp, verifyOtp } = useAuth();
    const navigate = useNavigate();
    const handleRequestOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await requestOtp(email.trim());
            setStep('code');
            toast.success('Login code sent — check your email');
        }
        catch (err) {
            const axiosErr = err;
            if (!axiosErr.response)
                toast.error('Cannot reach the server. Start the backend on port 8000.');
            else
                toast.error(axiosErr.response.data?.detail || 'Could not send login code');
        }
        finally {
            setLoading(false);
        }
    };
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await verifyOtp(email.trim(), code.trim());
            navigate('/');
        }
        catch (err) {
            const axiosErr = err;
            if (!axiosErr.response)
                toast.error('Cannot reach the server. Start the backend on port 8000.');
            else if (axiosErr.response.status === 401)
                toast.error('Invalid or expired code');
            else
                toast.error('Sign in failed.');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-dark-bg px-4", children: _jsxs("div", { className: "w-full max-w-sm", children: [_jsxs("div", { className: "text-center mb-10", children: [_jsx("div", { className: "flex justify-center mb-4", children: _jsx(AppLogo, { size: "lg", showName: false }) }), _jsx("h1", { className: "text-xl font-semibold text-text-primary", children: "SuperShyft" }), _jsx("p", { className: "text-sm text-text-muted mt-1.5", children: step === 'email' ? 'Sign in to your workspace' : 'Enter the code sent to your email' })] }), _jsx("div", { className: "bg-dark-card rounded-lg border border-dark-border p-8", children: step === 'email' ? (_jsxs("form", { onSubmit: handleRequestOtp, className: "space-y-4", children: [_jsx(Input, { label: "Email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true }), _jsx(Button, { type: "submit", loading: loading, className: "w-full mt-2", children: "Send login code" })] })) : (_jsxs("form", { onSubmit: handleVerifyOtp, className: "space-y-4", children: [_jsx(Input, { label: "Email", type: "email", value: email, disabled: true }), _jsx(Input, { label: "Login code", type: "text", inputMode: "numeric", autoComplete: "one-time-code", value: code, onChange: (e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6)), placeholder: "6-digit code", required: true, maxLength: 6 }), _jsx(Button, { type: "submit", loading: loading, className: "w-full mt-2", disabled: code.length !== 6, children: "Verify & sign in" }), _jsx("button", { type: "button", onClick: () => {
                                    setStep('email');
                                    setCode('');
                                }, className: "w-full text-sm text-text-muted hover:text-text-secondary", children: "Use a different email" })] })) }), _jsx("p", { className: "text-2xs text-text-muted text-center mt-6", children: "We email a one-time code \u2014 no password needed." })] }) }));
}
