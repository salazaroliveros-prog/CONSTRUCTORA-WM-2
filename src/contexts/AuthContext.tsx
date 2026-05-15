import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  auth,
  signInWithGoogle,
  logout,
  onAuthStateChanged,
  getRedirectAuthResult,
  getIdToken,
  setSessionCookie,
  User
} from '../lib/firebase';

const AUTHORIZED_EMAIL = 'salazaroliveros@gmail.com';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthorizedUser: boolean;
  login: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdTokenResult: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isAuthorizedUser = user?.email === AUTHORIZED_EMAIL;

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const redirectUser = await getRedirectAuthResult();
        if (redirectUser && !cancelled) {
          setUser(redirectUser);
          const token = await getIdToken(redirectUser);
          if (token && !cancelled) {
            await setSessionCookie(token);
          }
        }
      } catch (err) {
        console.error('Redirect auth error:', err);
      }

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!cancelled) {
          setUser(firebaseUser);

          if (firebaseUser && !cancelled) {
            try {
              const token = await getIdToken(firebaseUser);
              if (token) await setSessionCookie(token);
            } catch { /* ok */ }
          }

          setLoading(false);
        }
      });

      const safetyTimeout = setTimeout(() => {
        if (!cancelled) {
          console.warn('[AuthProvider] Safety timeout: auth state not received');
          setLoading(false);
        }
      }, 8000);

      return () => {
        clearTimeout(safetyTimeout);
        unsubscribe();
      };
    };

    const unsubPromise = init();
    return () => {
      cancelled = true;
      unsubPromise.then(unsub => typeof unsub === 'function' && unsub()).catch(() => {});
    };
  }, []);

  const login = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      setLoading(false);
    } catch (error: any) {
      if (error?.code !== 'auth/cancelled-popup-request' && error?.code !== 'auth/popup-closed-by-user') {
        console.error('Login error:', error);
      }
      setLoading(false);
    }
  };

  const signOutUser = useCallback(async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch { /* ignore */ }
    await logout();
  }, []);

  const getIdTokenResult = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await getIdToken(user);
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthorizedUser, login, signOut: signOutUser, getIdTokenResult }}>
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
