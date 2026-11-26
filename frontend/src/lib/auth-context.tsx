'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, refreshSession, setAccessToken, type AuthResponse, type User } from './api';
import { disconnectChatSocket } from './socket';

export interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  role: 'USER' | 'PSYCHOLOGIST';
  acceptTerms: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshSession()
      .then((res) => setUser(res?.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = useCallback((res: AuthResponse) => {
    setAccessToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) =>
      handleAuth(await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } })),
    [handleAuth],
  );

  const register = useCallback(
    async (data: RegisterData) =>
      handleAuth(await api<AuthResponse>('/auth/register', { method: 'POST', body: data })),
    [handleAuth],
  );

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    disconnectChatSocket();
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
