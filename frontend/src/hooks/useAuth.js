import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { googleLogin, getMe } from '../api/client';

const AuthContext = createContext(null);

/**
 * Role hierarchy:
 *   admin    - full access (create, read, update, delete, manage users)
 *   normal   - can log tests, add/edit data, view users; cannot delete or manage users
 *   readonly - read-only access only
 */

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

  // Role checks
  const isAdmin = user?.role === 'admin';
  const isNormal = user?.role === 'normal';
  const isReadOnly = user?.role === 'readonly';

  // canWrite: admin and normal users can add/edit data and log tests
  const canWrite = user?.role === 'admin' || user?.role === 'normal';

  // canDelete: only admin users can delete records
  const canDelete = user?.role === 'admin';

  // canManageUsers: only admin users can change roles/status
  const canManageUsers = user?.role === 'admin';

  // canViewUsers: all authenticated users can view the user list
  const canViewUsers = !!user;

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      refreshUser,
      isAdmin,
      isNormal,
      isReadOnly,
      canWrite,
      canDelete,
      canManageUsers,
      canViewUsers,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
