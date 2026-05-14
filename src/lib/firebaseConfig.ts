/// <reference types="vite/client" />

/**
 * Firebase Web App Configuration — módulo TypeScript
 * Reemplaza a firebase-applet-config.json para evitar errores de parseo TS.
 *
 * Obtén estos valores desde: Firebase Console > Project Settings > General > Your apps
 */
const firebaseConfig = {
  apiKey:                import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain:            import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId:             import.meta.env.VITE_FIREBASE_PROJECT_ID || 'coonstructora-wm-mys',
  storageBucket:         import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId:     import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:                 import.meta.env.VITE_FIREBASE_APP_ID || '',
  firestoreDatabaseId:   import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || 'ai-studio-c0b6a70a-6116-4e09-a484-07f3e9c63eec',
};

export default firebaseConfig;