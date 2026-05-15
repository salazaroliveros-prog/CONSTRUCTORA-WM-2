/**
 * Vercel Edge Middleware
 * ──────────────────────────────────────────────────────────────────────────────
 * Se ejecuta en el Edge ANTES de servir la app SPA.
 * - Agrega headers de seguridad a las respuestas
 * - NO bloquea el acceso (el login se maneja client-side con Firebase Auth)
 */

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json|map|webp)$/.test(pathname) ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  );
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  // Procesar la respuesta real del servidor/hosting
  let response: Response;

  try {
    response = await fetch(request);
  } catch {
    // Si falla, devolver un error simple
    return new Response('Service Unavailable', { status: 503 });
  }

  // Solo agregar headers de seguridad, no reemplazar el contenido
  const secureResponse = new Response(response.body, response);

  // Headers de seguridad
  secureResponse.headers.set('X-Frame-Options', 'DENY');
  secureResponse.headers.set('X-Content-Type-Options', 'nosniff');
  secureResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  secureResponse.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  secureResponse.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );
  secureResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');

  // Cache control para assets estáticos
  if (isStaticAsset(pathname)) {
    secureResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    secureResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  return secureResponse;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
};