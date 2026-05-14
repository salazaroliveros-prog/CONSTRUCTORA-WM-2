import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function ensureAdminInitialized() {
  if (getApps().length > 0) return;

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\n');

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in environment.'
    );
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

// ─── Create session cookie from ID token ───────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'DELETE') {
    // Logout: limpiar cookie de sesión
    res.setHeader('Set-Cookie', [
      '__session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    ]);
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    ensureAdminInitialized();
  } catch (err: any) {
    return res.status(500).json({ error: 'Firebase Admin init failed', details: err.message });
  }

  const { idToken } = req.body as { idToken?: string };

  if (!idToken) {
    return res.status(400).json({ error: 'Missing idToken in request body' });
  }

  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken, true);

    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 días
const sessionCookie = await auth.createSessionCookie(idToken, {
       expiresIn,
       // Opciones adicionales que firebase-admin soporta en runtime
       // aunque el tipo TypeScript no las exponga
       ...({
         httpOnly: true,
         secure: true,
         sameSite: 'lax' as const,
         path: '/',
       } as Record<string, unknown>),
     });

    const isProduction = process.env.NODE_ENV === 'production';
    const domain = isProduction ? '.vercel.app' : undefined;

    res.setHeader('Set-Cookie', [
      `__session=${sessionCookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(expiresIn / 1000)}${domain ? `; Domain=${domain}` : ''}`,
    ]);

    return res.status(200).json({
      success: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      expiresIn,
    });
  } catch (error: any) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      details: error.message,
    });
  }
}