import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import type { Role } from '@banking-simulator/shared-types';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/axios';

const ROLE_HOME: Record<Role, string> = {
  customer: '/customer/dashboard',
  account_manager: '/manager/dashboard',
  admin: '/admin/overview',
};

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect immediately if already authenticated
  useEffect(() => {
    if (user) navigate(ROLE_HOME[user.role], { replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<{
        token: string;
        user: { id: string; username: string; role: Role; fullName: string };
      }>('/api/v1/auth/login', { username, password });
      login(data.token, data.user);
      navigate(ROLE_HOME[data.user.role], { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          (err.response?.data as { error?: string })?.error ?? 'Login failed. Please try again.',
        );
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #F4FAFC, #E3F3F9)' }}
    >
      <div
        data-testid="login-card"
        className="bg-white rounded-xl shadow-modal w-full max-w-[380px] p-8"
      >
        {/* Logo + heading */}
        <div className="text-center mb-7">
          <div className="font-display font-bold italic text-[26px] leading-none mb-3">
            <span className="text-brand-primary">IT</span>
            <span className="text-[#0F172A]"> Bank</span>
          </div>
          <p className="text-[#4A5A67] text-sm">Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="text-xs font-semibold text-[#4A5A67]">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              data-testid="login-username"
              className="border border-border-input rounded px-3 py-2 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary/60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-xs font-semibold text-[#4A5A67]">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              data-testid="login-password"
              className="border border-border-input rounded px-3 py-2 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary/60"
            />
          </div>

          {error && (
            <p
              data-testid="msg-error"
              className="text-sm text-status-errorText bg-status-errorBg rounded px-3 py-2"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit"
            className="mt-1 bg-brand-primary text-white rounded py-2.5 text-sm font-semibold hover:bg-brand-deep disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Demo credentials panel */}
        <div className="mt-6 pt-5 border-t border-[#EEF4F7]">
          <p className="text-[11px] font-semibold text-[#4A5A67] mb-2 tracking-wide uppercase">
            Demo accounts · password: <span className="font-mono normal-case">Password123!</span>
          </p>
          <div className="flex flex-col gap-1">
            {[
              { role: 'Admin',    username: 'michael.scott' },
              { role: 'Manager',  username: 'sofia.lang'    },
              { role: 'Customer', username: 'anna.becker'   },
            ].map(({ role, username: u }) => (
              <div key={u} className="flex items-center gap-3 text-xs">
                <span className="w-20 font-medium text-[#0F172A]">{role}</span>
                <button
                  type="button"
                  className="font-mono text-brand-primary hover:underline"
                  onClick={() => setUsername(u)}
                >
                  {u}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
