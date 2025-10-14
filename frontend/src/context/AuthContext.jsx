import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { login as loginApi, signup as signupApi, logout as logoutApi, getTokens } from '../lib/auth';
import { api } from '../lib/api';

const AuthCtx = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdminStatus = async () => {
    try {
      const { access } = getTokens();
      const { isAdmin } = await api(`/api/auth/check-admin?access_token=${access}`);
      console.log('Is admin:', isAdmin);
      setIsAdmin(isAdmin || false);
    } catch (error) {
      console.error('Admin check error:', error);
      setIsAdmin(false);
    }
  };

  // try to fetch current user using the stored JWT (via /api/orders or a small me endpoint).
  useEffect(() => {
    const { access } = getTokens();
    if (!access) return setReady(true);

    // quick "who am I" using orders as a ping (or make /api/auth/me on backend if you prefer)
    api('/api/orders', { token: access })
      .then(() => {
        setUser({ id: 'me' });
        // Check if user is admin after setting user
        checkAdminStatus();
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const value = useMemo(() => ({
    user,
    setUser,
    isAdmin,
    async signup(form) {
      const response = await signupApi(form);
      
      // If auto-login was successful, set user state
      if (response.session) {
        setUser(response.user || { id: 'me' });
        // Check if user is admin
        await checkAdminStatus();
      }
      
      return response;
    },
    async login(form) {
      const { user: u } = await loginApi(form);
      setUser(u || { id: 'me' });
      // Check if user is admin
      if (u) {
        await checkAdminStatus();
      }
    },
    async logout() {
      await logoutApi();
      setUser(null);
      setIsAdmin(false);
    },
  }), [user, isAdmin]);

  if (!ready) return null; // or a small spinner

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
