import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { createPublicKey, verify } from 'crypto';

const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const FIREBASE_PROJECT_ID = 'coonstructora-wm-mys';
const AUTHORIZED_EMAIL = 'salazaroliveros@gmail.com';
const MAX_CONTEXT_BYTES = 250_000;
const MAX_MESSAGES = 20;

let certCache: { certs: Record<string, string>; expiresAt: number } | null = null;

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='), 'base64');
}

async function getFirebaseCerts() {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.certs;

  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) throw new Error('No se pudieron cargar los certificados de Firebase');

  const cacheControl = response.headers.get('cache-control') ?? '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] ?? 3600);
  const certs = await response.json() as Record<string, string>;
  certCache = { certs, expiresAt: Date.now() + maxAge * 1000 };
  return certs;
}

async function verifyFirebaseToken(authHeader: string | undefined) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  if (!headerPart || !payloadPart || !signaturePart) throw new Error('Token faltante o inválido');

  const header = JSON.parse(base64UrlDecode(headerPart).toString('utf8')) as { alg?: string; kid?: string };
  const payload = JSON.parse(base64UrlDecode(payloadPart).toString('utf8')) as {
    aud?: string;
    iss?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
  };

  if (header.alg !== 'RS256' || !header.kid) throw new Error('Token inválido');
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error('Audiencia inválida');
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) throw new Error('Emisor inválido');
  if (!payload.exp || payload.exp * 1000 <= Date.now()) throw new Error('Token expirado');
  if (payload.email !== AUTHORIZED_EMAIL || payload.email_verified === false) throw new Error('Usuario no autorizado');

  const certs = await getFirebaseCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Certificado de token desconocido');

  const valid = verify(
    'RSA-SHA256',
    Buffer.from(`${headerPart}.${payloadPart}`),
    createPublicKey(cert),
    base64UrlDecode(signaturePart)
  );
  if (!valid) throw new Error('Firma de token inválida');
  return payload;
}

function normalizeMessages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_MESSAGES).flatMap((message) => {
    if (!message || typeof message !== 'object') return [];
    const role = (message as any).role;
    const content = String((message as any).content ?? '').slice(0, 4000);
    if ((role !== 'user' && role !== 'assistant') || !content.trim()) return [];
    return [{ role, content }];
  });
}

function trimContext(context: unknown) {
  const serialized = JSON.stringify(context ?? {});
  if (serialized.length <= MAX_CONTEXT_BYTES) return context ?? {};
  return {
    notice: 'El contexto completo era demasiado grande y fue omitido parcialmente para proteger rendimiento y costos.',
    contextPreview: serialized.slice(0, MAX_CONTEXT_BYTES),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyFirebaseToken(req.headers.authorization);
  } catch (error) {
    return res.status(401).json({ error: error instanceof Error ? error.message : 'No autorizado' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no está configurada' });
  }

  const { messages, context } = req.body ?? {};
  const safeMessages = normalizeMessages(messages);
  if (safeMessages.length === 0) {
    return res.status(400).json({ error: 'No hay mensajes válidos para procesar' });
  }

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const systemPrompt = `Eres el asistente de inteligencia artificial del Sistema ERP Constructora WM.
Tu función es analizar los datos del sistema y generar informes, análisis y respuestas precisas en español.

DATOS ACTUALES DEL SISTEMA:
${JSON.stringify(trimContext(context), null, 2)}

INSTRUCCIONES:
- Responde siempre en español, de forma clara y profesional
- Usa formato Markdown para estructurar tus respuestas (tablas, listas, negritas)
- Cuando generes informes incluye: resumen ejecutivo, datos clave, análisis y recomendaciones
- Los montos monetarios van en Quetzales (Q.)
- Sé conciso pero completo`;

  const result = streamText({
    model: google('gemini-2.0-flash'),
    system: systemPrompt,
    messages: safeMessages,
    maxOutputTokens: 2048,
  });

  return result.pipeTextStreamToResponse(res);
}
