import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged, User, getIdToken,
  browserLocalPersistence, setPersistence
} from 'firebase/auth';
import {
  getFirestore,
  disableNetwork,
  enableNetwork,
  terminate as terminateFirestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from './firebaseConfig';

// ─── Inicialización singleton ──────────────────────────────────────────────────
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

export const app = getApp();
export const auth = getAuth(app);
export const storage = getStorage(app);

// Firestore instance — can be re-created after termination
let _db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const db = new Proxy({}, {
  get(_target, prop: string) {
    return _db[prop as keyof typeof _db];
  }
}) as typeof _db;

// ─── Network control for offline handling ─────────────────────────────────────
let networkDisabled = false;
let terminated = false;
let stopRealtimeSyncCallback: (() => void) | null = null;

export const setRealtimeSyncStopCallback = (cb: (() => void) | null) => {
  stopRealtimeSyncCallback = cb;
};

/**
 * Re-inicializa Firestore después de un terminate().
 * Necesario porque terminate() destruye la instancia y no se puede reutilizar.
 */
export const reinitializeFirestore = async (): Promise<void> => {
  try {
    const { getFirestore } = await import('firebase/firestore');
    _db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    terminated = false;
    console.log('[Firebase] Firestore re-inicializado');
  } catch (e) {
    console.error('[Firebase] Error re-inicializando Firestore:', e);
  }
};

export const disableFirestoreNetwork = async (): Promise<void> => {
  if (!networkDisabled) {
    try {
      // Stop realtime sync first to prevent connection attempts
      if (stopRealtimeSyncCallback) {
        try {
          stopRealtimeSyncCallback();
        } catch { /* ignore */ }
        stopRealtimeSyncCallback = null;
      }
      // Use terminate() instead of disableNetwork() to kill all internal retry loops
      try {
        await terminateFirestore(_db);
      } catch { /* ignore — may already be terminated */ }
      terminated = true;
      networkDisabled = true;
      console.log('[Firebase] Network terminated (not just disabled)');
    } catch (e) {
      console.error('[Firebase] Failed to disable/terminate network:', e);
    }
  }
};

export const enableFirestoreNetwork = async (): Promise<void> => {
  if (networkDisabled) {
    try {
      // Re-initialize Firestore if it was terminated
      if (terminated) {
        await reinitializeFirestore();
      } else {
        await enableNetwork(_db);
      }
      networkDisabled = false;
      terminated = false;
      console.log('[Firebase] Network enabled');
    } catch (e) {
      console.error('[Firebase] Failed to enable network:', e);
    }
  }
};

export const isFirestoreNetworkDisabled = (): boolean => networkDisabled;
export const isFirestoreTerminated = (): boolean => terminated;

// ─── Persistencia de sesión: LOCAL (sobrevive recargas y cierre de tab) ────────
// Por defecto Firebase usa SESSION (se pierde al cerrar tab).
// LOCAL persiste hasta que se hace signOut explícito.
setPersistence(auth, browserLocalPersistence).catch(console.error);

// ─── Google Auth Provider ──────────────────────────────────────────────────────
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Login con popup (preferido) — no depende de cookies de terceros.
 * Funciona en localhost y en producción Vercel.
 */
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user') {
      console.warn('Popup cerrado por el usuario');
      return null;
    }
    if (error?.code === 'auth/popup-blocked') {
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectError: any) {
        throw redirectError;
      }
    }
    if (error?.code !== 'auth/cancelled-popup-request') {
      console.error('Error signing in with Google:', error);
    }
    throw error;
  }
};

/** Obtener resultado de autenticación después de redirect (fallback) */
export const getRedirectAuthResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error: any) {
    if (error?.code !== 'auth/redirect-error' && error?.code !== 'auth/no-current-user') {
      console.error('Error getting redirect result:', error);
    }
    return null;
  }
};

export const logout = () => signOut(auth);

// ─── Session Cookie helper (para Vercel producción) ───────────────────────────────
export async function setSessionCookie(idToken: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export { onAuthStateChanged, getIdToken };
export type { User };