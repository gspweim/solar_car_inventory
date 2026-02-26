import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { googleLogin, getMe } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('calsol_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (googleIdToken) => {
    setLoading(true);
    try {
      const data = await googleLogin(googleIdToken);
      localStorage.setItem('calsol_token', data.token);
      localStorage.setItem('calsol_user', JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('calsol_token');
    localStorage.removeItem('calsol_user');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await getMe();
      localStorage.setItem('calsol_user', JSON.stringify(data.user));
      setUser(data.user);
    } catch {
      logout();
    }
  }, [logout]);

  const isAdmin = user?.role === 'admin';
  const canWrite = user?.role === 'admin'; // extend if you add "editor" role

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, isAdmin, canWrite }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
