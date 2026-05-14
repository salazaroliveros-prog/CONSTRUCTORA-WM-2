/// <reference types="vite/client" />

/**
 * Firebase Web App Configuration
 * ══════════════════════════════════════════════════════════════════════
 *
 * Estos valores se inyectan automáticamente desde las variables de entorno.
 *
 * Para desarrollo local: crea un archivo .env.local en la raíz con:
 *   VITE_FIREBASE_API_KEY="..."
 *   VITE_FIREBASE_AUTH_DOMAIN="..."
 *   VITE_FIREBASE_PROJECT_ID="..."
 *   etc.
 *
 * Para producción: configura las mismas variables en Vercel Dashboard
 *   → Settings → Environment Variables
 *
 * La configuración base también está en:
 *   → firebase.config.example.js  (copia/pega desde Firebase Console)
 */

const firebaseConfig = {
  apiKey:              import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain:          import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId:           import.meta.env.VITE_FIREBASE_PROJECT_ID || 'coonstructora-wm-mys',
  storageBucket:       import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId:   import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:               import.meta.env.VITE_FIREBASE_APP_ID || '',
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || 'ai-studio-c0b6a70a-6116-4e09-a484-07f3e9c63eec',
};

export default firebaseConfig;