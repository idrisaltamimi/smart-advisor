import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { apiLogin, apiRegister, User } from '@/services/api';

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (full_name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.multiGet(['auth_token', 'auth_user']).then(([[, t], [, u]]) => {
      if (t) setToken(t);
      if (u) setUser(JSON.parse(u));
      setIsLoading(false);
    });
  }, []);

  async function signIn(email: string, password: string) {
    const data = await apiLogin(email, password);
    setToken(data.access_token);
    setUser(data.user);
    await AsyncStorage.multiSet([
      ['auth_token', data.access_token],
      ['auth_user', JSON.stringify(data.user)],
    ]);
  }

  async function signUp(full_name: string, email: string, password: string) {
    const data = await apiRegister(full_name, email, password);
    setToken(data.access_token);
    setUser(data.user);
    await AsyncStorage.multiSet([
      ['auth_token', data.access_token],
      ['auth_user', JSON.stringify(data.user)],
    ]);
  }

  async function signOut() {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
