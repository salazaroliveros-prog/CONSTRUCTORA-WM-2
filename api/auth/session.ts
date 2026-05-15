/**
 * API Endpoint: /api/auth/session
 *
 * Crea/elimina cookies de sesión usando Firebase REST API.
 * NO requiere firebase-admin — usa fetch() con la API key.
 *
 * Variables necesarias (definir en Vercel Dashboard → Settings → Environment Variables):
 *   - FIREBASE_API_KEY       (la apiKey de firebase-applet-config.json)
 *   - FIREBASE_PROJECT_ID    (opcional, para logs)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// En Vercel, las variables se leen de process.env directamente.
// Para serverless functions, usar VITE_ prefix no funciona - necesita VITE_FIREBASE_API_KEY
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// CORS origin dinámico: permite el dominio de la app y localhost para desarrollo
const ALLOWED_ORIGINS = [
  'https://constructora-wm-2.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsOrigin(req: VercelRequest): string {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

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

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getCorsOrigin(req);

  // Permitir CORS desde el dominio de la app
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // DELETE: Logout — limpiar cookie
  if (req.method === 'DELETE') {
    const deleteOrigin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(deleteOrigin)) {
      res.setHeader('Set-Cookie', '__session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    }
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Validar API key
  if (!FIREBASE_API_KEY) {
    console.warn('[session] API key not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { idToken } = req.body as { idToken?: string };

  if (!idToken) {
    return res.status(400).json({ error: 'Missing idToken in request body' });
  }

  try {
    const user = await verifyIdToken(idToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token - no user found' });
    }

    const expiresIn = 60 * 60 * 24 * 5; // 5 días

    res.setHeader('Set-Cookie', [
      `__session=${idToken}; Path=/; SameSite=Lax; HttpOnly; Max-Age=${expiresIn}`,
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