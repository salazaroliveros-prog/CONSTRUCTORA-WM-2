import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    // Usar redirect en lugar de popup para evitar bloqueos COOP/COEP
    await signInWithRedirect(auth, googleProvider);
    // La función retorna sin usuario porque el redirect recarga la página
    // getRedirectResult se maneja en AuthContext
    return null;
  } catch (error: any) {
    if (error?.code !== 'auth/cancelled-popup-request' && error?.code !== 'auth/popup-closed-by-user') {
      console.error('Error signing in with Google:', error);
    }
    throw error;
  }
};

/** Obtener resultado de autenticación después de redirect */
export const getRedirectAuthResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error: any) {
    console.error('Error getting redirect result:', error);
    return null;
  }
};

export const logout = () => signOut(auth);

export { onAuthStateChanged };
export type { User };