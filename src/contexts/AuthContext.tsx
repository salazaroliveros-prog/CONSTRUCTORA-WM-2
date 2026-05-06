import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, signInWithGoogle, logout, onAuthStateChanged, User } from '../lib/firebase';

// Usuario principal autorizado - solo este correo puede ver todos los datos
const AUTHORIZED_EMAIL = 'salazaroliveros@gmail.com';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthorizedUser: boolean;
  login: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verificar si el usuario actual es el autorizado
  const isAuthorizedUser = user?.email === AUTHORIZED_EMAIL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (error: any) {
      if (error?.code !== 'auth/cancelled-popup-request' && error?.code !== 'auth/popup-closed-by-user') {
        console.error('Login error:', error);
      }
      setLoading(false);
    }
  };

  const signOut = async () => {
    await logout();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthorizedUser, login, signOut }}>
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
