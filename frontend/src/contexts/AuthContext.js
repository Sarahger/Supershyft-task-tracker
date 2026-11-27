import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/endpoints';
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        const timeout = window.setTimeout(() => {
            if (!cancelled)
                setIsLoading(false);
        }, 8000);
        authApi.me()
            .then(({ data }) => {
            if (!cancelled)
                setUser(data.data);
        })
            .catch(() => {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        })
            .finally(() => {
            if (!cancelled) {
                window.clearTimeout(timeout);
                setIsLoading(false);
            }
        });
        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, []);
    const requestOtp = async (email) => {
        await authApi.requestOtp(email);
    };
    const verifyOtp = async (email, code) => {
        const { data } = await authApi.verifyOtp(email, code);
        localStorage.setItem('access_token', data.data.access_token);
        localStorage.setItem('refresh_token', data.data.refresh_token);
        setUser(data.data.user);
    };
    const logout = () => {
        const refresh = localStorage.getItem('refresh_token');
        if (refresh)
            authApi.logout(refresh).catch(() => { });
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
    };
    const updateUser = (next) => {
        setUser(next);
    };
    return (_jsx(AuthContext.Provider, { value: { user, isLoading, requestOtp, verifyOtp, logout, updateUser, isAuthenticated: !!user }, children: children }));
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
