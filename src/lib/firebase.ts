import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signInWithRedirect, getRedirectResult,
  signOut, onAuthStateChanged, User, getIdToken,
  browserLocalPersistence, setPersistence
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import firebaseConfig from './firebaseConfig'

// Inicializacion singleton
if (!getApps().length) {
  initializeApp(firebaseConfig)
}

export const app = getApp()
export const auth = getAuth(app)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId)
export const storage = getStorage(app)

// Persistencia de sesion LOCAL
setPersistence(auth, browserLocalPersistence).catch(console.error)

// Google Auth Provider
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user') {
      console.warn('Popup cerrado por el usuario')
      return null
    }
    if (error?.code === 'auth/popup-blocked') {
      try {
        await signInWithRedirect(auth, googleProvider)
        return null
      } catch (redirectError: any) {
        throw redirectError
      }
    }
    if (error?.code !== 'auth/cancelled-popup-request') {
      console.error('Error signing in with Google:', error)
    }
    throw error
  }
}

export const getRedirectAuthResult = async () => {
  try {
    const result = await getRedirectResult(auth)
    return result?.user || null
  } catch (error: any) {
    if (error?.code !== 'auth/redirect-error' && error?.code !== 'auth/no-current-user') {
      console.error('Error getting redirect result:', error)
    }
    return null
  }
}

export const logout = () => signOut(auth)

export async function setSessionCookie(idToken: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    })
    return res.ok
  } catch {
    return false
  }
}

export { onAuthStateChanged, getIdToken }
export type { User }