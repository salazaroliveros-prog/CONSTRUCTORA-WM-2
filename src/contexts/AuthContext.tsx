import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, signInWithGoogle, logout, onAuthStateChanged, User } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    if (loginLoading) return;
    setLoginLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      // Ignore cancelled popup request errors as they are usually benign in this environment
      if (error?.code !== 'auth/cancelled-popup-request' && error?.code !== 'auth/popup-closed-by-user') {
        console.error('Login error:', error);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const signOut = async () => {
    await logout();
  };

  return (
    <AuthContext.Provider value={{ user, loading: loading || loginLoading, login, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
