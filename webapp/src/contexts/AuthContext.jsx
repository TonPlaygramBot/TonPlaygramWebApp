import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCurrentUser, setAuthToken } from '../utils/api.js';

const AuthContext = createContext(null);

const AUTH_TOKEN_KEY = 'authToken';
const AUTH_USER_KEY = 'authUser';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem(AUTH_USER_KEY);
    if (!cached) return null;
    try {
      return JSON.parse(cached);
    } catch (err) {
      console.warn('Failed to parse cached user', err);
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    setAuthToken(token);
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  }, [user]);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const response = await fetchCurrentUser(token || undefined);
        if (!active) return;
        if (response?.user) {
          setUser(response.user);
        } else if (response?.status === 401) {
          setToken(null);
          setUser(null);
          setAuthToken(null);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    hydrate();

    return () => {
      active = false;
    };
  }, [token]);

  const login = (nextToken, nextUser = null) => {
    setToken(nextToken);
    setUser(nextUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      setUser
    }),
    [token, user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
