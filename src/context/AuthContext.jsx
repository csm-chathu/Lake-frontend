import React, { createContext, useContext, useEffect, useState } from 'react';
import client from '../api/client.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const expirationTime = localStorage.getItem('authTokenExpiration');
      if (expirationTime && new Date().getTime() > expirationTime) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        localStorage.removeItem('authTokenExpiration');
        return null;
      }
      const raw = localStorage.getItem('authUser');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('authToken') || null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('authUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('authUser');
    }
  }, [user]);

  useEffect(() => {
    const expirationTime = localStorage.getItem('authTokenExpiration');
    if (expirationTime) {
      const timeRemaining = expirationTime - new Date().getTime();
      if (timeRemaining <= 0) {
        logout();
      } else {
        const timer = setTimeout(logout, timeRemaining);
        return () => clearTimeout(timer);
      }
    }
  }, [token, logout]);

  const login = async (email, password) => {
    const payload = { email, password };
    const response = await client.post('/login', payload).catch((err) => ({ error: err.message }));
    if (response && response.data) {
      const data = response.data;
      const token = data.token || data.access_token || data?.meta?.token || '';
      setToken(token);
      setUser(data.user || data);
      const expirationTime = new Date().getTime() + 6 * 60 * 60 * 1000;
      localStorage.setItem('authTokenExpiration', expirationTime);
      return { success: true };
    }
    return { success: false, message: response.error || 'Login failed' };
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authTokenExpiration');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
