'use client';

import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getAccessToken, setTokens, clearTokens } from './api';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  restaurantId: string;
  permissions: string[];
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [initialized, setInitialized] = useState(false);
  const [token, setTokenState] = useState<string | null>(() => getAccessToken());

  const hasToken = !!token;

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api.me(),
    enabled: hasToken,
    retry: false,
  });

  const loginMut = useMutation({
    mutationFn: (vars: { email: string; password: string }) => api.login(vars),
    onSuccess: (data) => {
      setTokens(data);
      setTokenState(data.accessToken);
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const logoutMut = useMutation({
    mutationFn: async () => {
      try {
        await api.logout();
      } finally {
        clearTokens();
        setTokenState(null);
        qc.setQueryData(['me'], null);
      }
    },
  });

  useEffect(() => {
    setInitialized(true);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMut.mutateAsync({ email, password });
    },
    [loginMut],
  );

  const logout = useCallback(async () => {
    await logoutMut.mutateAsync();
  }, [logoutMut]);

  const value: AuthContextValue = {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    user: meQuery.data ? (meQuery.data as unknown as User) : null,
    isAuthenticated: !!meQuery.data && hasToken,
    isLoading: !initialized || (hasToken && meQuery.isLoading),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
}
