/**
 * Vercel Edge Middleware — Transparent Security Headers
 * No modifica el cuerpo de la respuesta.
 */

export default async function middleware() {
  // Dejar que Vercel sirva los archivos estáticos normalmente.
  // Los headers de seguridad se configuran en vercel.json.
  // Este archivo solo existe para la ruta /api/auth/session.
  return new Response(null, { status: 200 });
}

export const config = {
  matcher: ['/api/(.*)'],
};