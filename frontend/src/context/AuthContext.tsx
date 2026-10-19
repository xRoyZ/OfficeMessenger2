import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, api, getAccessToken, setAccessToken } from '../lib/api';
import type { AuthOut, MeOut } from '../lib/types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: MeOut | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: MeOut) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<MeOut | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (getAccessToken() ? 'loading' : 'anonymous'));

  useEffect(() => {
    if (!getAccessToken()) {
      return;
    }

    let active = true;

    api
      .get<MeOut>('/api/auth/me')
      .then((me) => {
        if (!active) {
          return;
        }
        setUserState(me);
        setStatus('authenticated');
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          setAccessToken(null);
        }
        setUserState(null);
        setStatus('anonymous');
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<AuthOut>('/api/auth/login', { email, password });
    setAccessToken(result.access_token);
    setUserState(result.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (email: string, displayName: string, password: string) => {
    const result = await api.post<AuthOut>('/api/auth/register', {
      email,
      display_name: displayName,
      password,
    });
    setAccessToken(result.access_token);
    setUserState(result.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post<void>('/api/auth/logout');
    } finally {
      setAccessToken(null);
      setUserState(null);
      setStatus('anonymous');
    }
  }, []);

  const setUser = useCallback((nextUser: MeOut) => {
    setUserState(nextUser);
    setStatus('authenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout, setUser }),
    [user, status, login, register, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
