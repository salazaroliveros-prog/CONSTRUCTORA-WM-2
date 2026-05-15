/**
 * API Endpoint: /api/auth/session
 * 
 * Crea/elimina cookies de sesión usando la Firebase REST API.
 * NO requiere firebase-admin — usa fetch() directamente.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function verifyIdToken(idToken: string): Promise<any> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Token verification failed');
  }

  const data = await res.json();
  return data.users?.[0] || null;
}

function createSessionCookieHeaders(sessionCookie: string): string {
  return `__session=${sessionCookie}; Path=/; SameSite=Lax; HttpOnly; Max-Age=432000`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // DELETE: Logout
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', [
      '__session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    ]);
    return res.status(200).json({ success: true });
  }

  // Verificar método
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Verificar que tenemos la API key
  if (!FIREBASE_API_KEY) {
    return res.status(500).json({
      error: 'Missing VITE_FIREBASE_API_KEY in environment',
    });
  }

  const { idToken } = req.body as { idToken?: string };

  if (!idToken) {
    return res.status(400).json({ error: 'Missing idToken in request body' });
  }

  try {
    // Paso 1: Verificar el token con Firebase REST API
    const user = await verifyIdToken(idToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token - no user found' });
    }

    // Paso 2: Obtener una session cookie válida
    // La cookie de sesión de Firebase se genera en el cliente automáticamente
    // cuando se usa signInWithPopup. Usamos el ID token como cookie alternativa.
    // En producción, Firebase SDK gestiona la cookie automáticamente.
    const expiresIn = 60 * 60 * 24 * 5; // 5 días en segundos

    // Paso 3: Establecer cookie de sesión
    res.setHeader('Set-Cookie', [
      createSessionCookieHeaders(idToken),
    ]);

    return res.status(200).json({
      success: true,
      uid: user.localId,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      expiresIn: expiresIn * 1000,
    });
  } catch (error: any) {
    console.error('[session]', error.message);
    return res.status(401).json({
      error: 'Invalid or expired token',
      details: error.message,
    });
  }
}