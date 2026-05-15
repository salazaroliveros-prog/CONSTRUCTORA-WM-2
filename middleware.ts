/**
 * Vercel Edge Middleware — Transparent Security Headers
 * No intercepta el contenido de la app ni las rutas API.
 * Headers de seguridad + COOP para soporte de popups Firebase Auth.
 */

export default async function middleware(request: Request) {
  const url = new URL(request.url);

  // NO interceptar rutas API — dejar que las serverless functions manejen
  if (url.pathname.startsWith('/api/')) {
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', 'https://constructora-wm-2.vercel.app');
    newResponse.headers.set('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS, GET');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    return newResponse;
  }

  // Solo agregar headers a recursos estáticos y navegación
  const response = await fetch(request);
  const newResponse = new Response(response.body, response);

  // Headers de seguridad
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newResponse.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  newResponse.headers.set('X-Robots-Tag', 'noindex, nofollow');
  newResponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  newResponse.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');

  return newResponse;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image).*)'],
};