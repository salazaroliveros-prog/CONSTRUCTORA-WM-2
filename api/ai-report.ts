import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { messages, context } = await req.json();

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY ?? '',
  });

  const systemPrompt = `Eres el asistente de inteligencia artificial del Sistema ERP Constructora WM.
Tu función es analizar los datos del sistema y generar informes, análisis y respuestas precisas en español.

DATOS ACTUALES DEL SISTEMA:
${JSON.stringify(context, null, 2)}

INSTRUCCIONES:
- Responde siempre en español, de forma clara y profesional
- Usa formato Markdown para estructurar tus respuestas (tablas, listas, negritas)
- Cuando generes informes, incluye: resumen ejecutivo, datos clave, análisis y recomendaciones
- Los montos monetarios van en Quetzales (Q.)
- Sé conciso pero completo
- Si el usuario pide un informe específico, genera uno estructurado con los datos disponibles`;

  const result = streamText({
    model: google('gemini-2.0-flash'),
    system: systemPrompt,
    messages,
    maxTokens: 2048,
  });

  return result.toDataStreamResponse();
}
