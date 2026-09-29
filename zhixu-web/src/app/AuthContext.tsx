import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearToken, getToken } from '../api/client';
import { backend, USE_MOCK } from '../api';
import type { User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  demoLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  ready: false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  demoLogin: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        const me = await backend.me();
        if (!cancelled) setUser(me);
      } catch {
        clearToken();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const me = await backend.login({ email, password });
    setUser(me);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    await backend.register({ name, email, password });
    const me = await backend.login({ email, password });
    setUser(me);
  }, []);

  const demoLogin = useCallback(async () => {
    if (!USE_MOCK) return;
    const me = await backend.login({ email: 'lin.zhixia@example.com', password: 'Pathly2026' });
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, demoLogin }}>
      {children}
    </AuthContext.Provider>
  );
}
