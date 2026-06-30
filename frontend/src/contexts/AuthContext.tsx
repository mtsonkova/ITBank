import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AuthUser } from '@banking-simulator/shared-types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredAuth(): AuthState {
  try {
    const raw = localStorage.getItem('auth');
    if (raw) return JSON.parse(raw) as AuthState;
  } catch {
    // ignore corrupted storage
  }
  return { token: null, user: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(loadStoredAuth);

  function login(token: string, user: AuthUser) {
    const state: AuthState = { token, user };
    localStorage.setItem('auth', JSON.stringify(state));
    setAuth(state);
  }

  function logout() {
    localStorage.removeItem('auth');
    setAuth({ token: null, user: null });
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
