/**
 * Vercel Edge Middleware
 * ──────────────────────────────────────────────────────────────────────────────
 * Se ejecuta en el Edge ANTES de servir la app SPA.
 * - Headers de seguridad
 * - Verificación de cookie __session (Firebase session)
 * - Redirección de login expirado
 */

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|map)$/.test(pathname) ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  );
}

function decodeJwtExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString()
    );
    return (payload as { exp?: number }).exp ?? null;
  } catch {
    return null;
  }
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  // Assets estáticos pasan directo
  if (isStaticAsset(pathname)) {
    return fetch(request);
  }

  // Crear respuesta base con headers de seguridad
  const response = new Response('OK', {
    status: 200,
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });

  // Verificar cookie de sesión Firebase
  const cookieHeader = request.headers.get('cookie') || '';
  const sessionMatch = cookieHeader.match(/__session=([^;]+)/);

  if (sessionMatch && FIREBASE_API_KEY) {
    const token = sessionMatch[1];

    try {
      // Verificar con Firebase Auth API si el token es válido
      const verifyRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token }),
        }
      );

      if (!verifyRes.ok) {
        // Sesión inválida — redirigir a página principal para re-login
        const loginUrl = url.origin;
        const redirect = new Response('', {
          status: 307,
          headers: { Location: loginUrl },
        });
        redirect.headers.set('Set-Cookie', '__session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
        return redirect;
      }

      // Token válido — verificar expiración
      const decoded = decodeJwtExpiry(token);
      if (decoded !== null && decoded * 1000 < Date.now() + 60000) {
        // Token próximo a expirar — refrescar
        try {
          const refreshRes = await fetch(
            `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                grant_type: 'refresh_token',
                refresh_token: '',
              }),
            }
          );

          if (!refreshRes.ok) {
            const loginUrl = url.origin;
            const redirect = new Response('', {
              status: 307,
              headers: { Location: loginUrl },
            });
            redirect.headers.set('Set-Cookie', '__session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
            return redirect;
          }
        } catch {
          // Si el refresh falla, dejar que el cliente maneje el re-login
        }
      }
    } catch {
      // Error de red en verificación — permitir que el cliente maneje
    }
  }

  return response;
}