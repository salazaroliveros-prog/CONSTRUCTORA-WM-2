import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messages, context } = req.body;

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY ?? '',
  });

  const systemPrompt = `Eres el asistente de inteligencia artificial del Sistema ERP Constructora WM.
Tu función es analizar los datos del sistema y generar informes, análisis y respuestas precisas en español.

DATOS ACTUALES DEL SISTEMA:
${JSON.stringify(context ?? {}, null, 2)}

INSTRUCCIONES:
- Responde siempre en español, de forma clara y profesional
- Usa formato Markdown para estructurar tus respuestas (tablas, listas, negritas)
- Cuando generes informes incluye: resumen ejecutivo, datos clave, análisis y recomendaciones
- Los montos monetarios van en Quetzales (Q.)
- Sé conciso pero completo`;

  const result = streamText({
    model: google('gemini-2.0-flash'),
    system: systemPrompt,
    messages,
    maxOutputTokens: 2048,
  });

  return result.pipeTextStreamToResponse(res);
}
