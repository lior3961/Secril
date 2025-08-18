import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { login as loginApi, signup as signupApi, logout as logoutApi, getTokens } from '../lib/auth';
import { api } from '../lib/api';

const AuthCtx = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // try to fetch current user using the stored JWT (via /api/orders or a small me endpoint).
  useEffect(() => {
    const { access } = getTokens();
    if (!access) return setReady(true);

    // quick “who am I” using orders as a ping (or make /api/auth/me on backend if you prefer)
    api('/api/orders', { token: access })
      .then(() => setUser({ id: 'me' })) // placeholder: you can add /api/auth/me to return user
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const value = useMemo(() => ({
    user,
    setUser,
    async signup(form) {
      await signupApi(form);
      // after signup, you may auto-login if you like
    },
    async login(form) {
      const { user: u } = await loginApi(form);
      setUser(u || { id: 'me' });
    },
    async logout() {
      await logoutApi();
      setUser(null);
    },
  }), [user]);

  if (!ready) return null; // or a small spinner

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
