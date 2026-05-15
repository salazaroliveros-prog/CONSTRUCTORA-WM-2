import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  auth,
  signInWithGoogle,
  logout,
  onAuthStateChanged,
  getRedirectAuthResult,
  getIdToken,
  setSessionCookie,
  User,
  enableFirestoreNetwork,
  disableFirestoreNetwork,
} from '../lib/firebase';
import { SyncEngine } from '../lib/sync/SyncEngine';
import { startRealtimeSync } from '../lib/sync/RealtimeSync';
import type { SyncState } from '../lib/sync/types';
import { REQUIRED_COLLECTIONS } from '../services/firestoreService';

// Usuario principal autorizado
const AUTHORIZED_EMAIL = 'salazaroliveros@gmail.com';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthorizedUser: boolean;
  login: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdTokenResult: () => Promise<string | null>;
}

interface SyncContextType {
  syncState: SyncState | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SyncContext = createContext<SyncContextType>({ syncState: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const stopRealtimeRef = React.useRef<(() => void) | null>(null);

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

// Inicializar SyncEngine al autenticarse
              try {
                const engine = SyncEngine.getInstance();
                await engine.init();
                // Start realtime sync for all required collections
                stopRealtimeRef.current = startRealtimeSync([...REQUIRED_COLLECTIONS]);
                // Re-enable Firestore network if it was disabled
                await enableFirestoreNetwork();
              } catch (e) {
                console.error('[AuthProvider] SyncEngine init failed:', e);
              }
           }

           setLoading(false);
         }
       });

       // Safety net: si onAuthStateChanged no dispara en 8s, dejar de cargar
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

  // Suscribirse a cambios de estado del SyncEngine
  useEffect(() => {
    if (!user) return;

    const engine = SyncEngine.getInstance();
    const stopSync = engine.onStateChange((state) => {
      setSyncState(state);
    });

    return stopSync;
  }, [user]);

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

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch { /* ignore */ }

    // Stop realtime sync
    if (stopRealtimeRef.current) {
      stopRealtimeRef.current();
      stopRealtimeRef.current = null;
    }

    // Detener sync engine
    SyncEngine.resetInstance();
    // Disable Firestore network to prevent offline retries
    await disableFirestoreNetwork();
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
    <AuthContext.Provider value={{ user, loading, isAuthorizedUser, login, signOut, getIdTokenResult }}>
      <SyncContext.Provider value={{ syncState }}>
        {!loading && children}
      </SyncContext.Provider>
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

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}