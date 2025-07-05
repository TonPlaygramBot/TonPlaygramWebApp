import { createContext, useContext, useEffect, useState } from 'react';

const SecureAuthContext = createContext({ authenticated: false });

export function SecureAuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const flag = sessionStorage.getItem('isAuthenticated');
    if (flag === 'true') setAuthenticated(true);
  }, []);

  const login = () => {
    setAuthenticated(true);
    sessionStorage.setItem('isAuthenticated', 'true');
  };

  const logout = () => {
    setAuthenticated(false);
    sessionStorage.removeItem('isAuthenticated');
  };

  return (
    <SecureAuthContext.Provider value={{ authenticated, login, logout }}>
      {children}
    </SecureAuthContext.Provider>
  );
}

export function useSecureAuth() {
  return useContext(SecureAuthContext);
}
