import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    window.addEventListener('skillsync:logout', logout);
    return () => window.removeEventListener('skillsync:logout', logout);
  }, [logout]);

  const authenticate = async (path, body) => {
    const { token, user: u } = await api.post(path, body);
    setToken(token);
    const me = await api.get('/auth/me'); // includes the populated company
    setUser(me.user || u);
    return me.user || u;
  };

  const value = {
    user,
    loading,
    setUser,
    logout,
    login: (email, password) => authenticate('/auth/login', { email, password }),
    register: (data) => authenticate('/auth/register', data),
    refresh: () => api.get('/auth/me').then((d) => setUser(d.user)),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
