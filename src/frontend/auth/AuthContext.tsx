'use client';

import React from 'react';
import { API_BASE_URL } from '@/frontend/api/client';

interface AuthContextValue {
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'matchpoint.td.token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setToken(stored);
    }

    setIsLoading(false);
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const target = `${API_BASE_URL}/api/v1/auth/login`;

    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload?.error || payload?.message || response.statusText;
      throw new Error(message);
    }

    const payload = await response.json();
    if (!payload?.token) {
      throw new Error('Login response missing token');
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, payload.token);
    }
    setToken(payload.token);
  }, []);

  const logout = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setToken(null);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      token,
      isLoading,
      login,
      logout,
    }),
    [token, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
