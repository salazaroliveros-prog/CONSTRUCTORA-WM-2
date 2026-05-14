/**
 * ════════════════════════════════════════════════════════════════════════════
 * CONFIGURACIÓN DE FIREBASE — APP WEB
 * ════════════════════════════════════════════════════════════════════════════
 *
 * COPIA Y PEGA AQUÍ la configuración que Firebase te da al crear una app web:
 *
 *   Firebase Console → Project Settings → General → Your apps → Web app (</>)
 *
 * Luego renombra este archivo a firebase.config.js y actualiza las variables
 * de entorno en .env.local y Vercel Dashboard.
 */

// ─── Pega aquí tu configuración de Firebase ──────────────────────────────────

const firebaseConfig = {
  apiKey:             "AIzaSyC89fa8S8jbssBaPw5zHy5FlsJGEXlfftY",
  authDomain:         "coonstructora-wm-mys.firebaseapp.com",
  projectId:          "coonstructora-wm-mys",
  storageBucket:      "coonconstructora-wm-mys.firebasestorage.app",
  messagingSenderId:  "38717234192",
  appId:              "1:38717234192:web:16b95baffd540c9ed2be95",
  // measurementId:    "G-XXXXXXXXXX"  // Opcional — Analytics
};

// ─── Datos de Firestore (obtener desde: Database → Settings) ─────────────

const firestoreDatabaseId = "ai-studio-c0b6a70a-6116-4e09-a484-07f3e9c63eec";

// ─── NO MODIFICAR ABAJO DE ESTA LÍNEA ─────────────────────────────────────

export { firebaseConfig, firestoreDatabaseId };