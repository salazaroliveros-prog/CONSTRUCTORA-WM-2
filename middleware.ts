/**
 * Vercel Edge Middleware — Transparent Security Headers
 * No intercepta el contenido de la app ni las rutas API.
 * Los headers de seguridad se configuran en vercel.json.
 * Solo se usa para rutas de assets estáticos.
 */

export default async function middleware(request: Request) {
  const url = new URL(request.url);

  // NO interceptar rutas API — dejar que las serverless functions manejen
  if (url.pathname.startsWith('/api/')) {
    return fetch(request);
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

  return newResponse;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image).*)'],
};