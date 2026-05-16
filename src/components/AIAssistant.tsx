import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Bot, Send, Loader2, Sparkles, User, RotateCcw, Copy, Check } from 'lucide-react';
import { subscribeToCollection } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { toast } from 'sonner';

interface Message { id: string; role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS = [
  'Genera un informe ejecutivo del estado actual de todos los proyectos',
  'Analiza el flujo de caja y transacciones del mes',
  'Muestra un resumen del inventario con alertas de stock crítico',
  'Lista los proyectos en ejecución con su avance y fecha estimada de entrega',
  'Genera un informe de rentabilidad por proyecto',
  'Analiza el desempeño del personal y costos de nómina',
  'Resumen de órdenes de compra pendientes y proveedores activos',
  'Informe de clientes activos y proyectos asociados',
];

// ── Inline markdown renderer ──────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-black text-(--color-secondary)">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="px-1 py-0.5 bg-(--color-neutral-100) rounded text-[11px] font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let tableRows: string[] = [];

const flushTable = () => {
    if (!tableRows.length) return;
    const rows = tableRows.filter(r => !/^\|[-:| ]+\|$/.test(r.trim()));
    elements.push(
      <div key={`tbl-${elements.length}`} className="overflow-x-auto my-2">
        <table className="w-full text-left border-collapse text-[12px]">
          <tbody>
            {rows.map((row, ri) => {
              const cells = row.split('|').filter(c => c.trim() !== '');
              return (
                 <tr key={ri} className={`border-b border-(--color-neutral-200) ${ri === 0 ? 'bg-(--color-neutral-100)/50' : ''}`}>
                  {cells.map((cell, ci) =>
                    ri === 0
                      ? <th key={ci} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-(--color-neutral-500)">{cell.trim()}</th>
                      : <td key={ci} className="px-3 py-1.5 text-(--color-neutral-700)">{renderInline(cell.trim())}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  lines.forEach((line, i) => {
    if (line.startsWith('|')) { tableRows.push(line); return; }
    flushTable();
    if (line.startsWith('### ')) { elements.push(<h3 key={i} className="font-black text-(--color-secondary) text-sm mt-3 mb-1">{line.slice(4)}</h3>); return; }
    if (line.startsWith('## '))  { elements.push(<h2 key={i} className="font-black text-(--color-secondary) text-base mt-4 mb-1">{line.slice(3)}</h2>); return; }
    if (line.startsWith('# '))   { elements.push(<h1 key={i} className="font-black text-(--color-secondary) text-lg mt-4 mb-2">{line.slice(2)}</h1>); return; }
    if (line.startsWith('- ') || line.startsWith('* ')) { elements.push(<li key={i} className="ml-4 list-disc text-(--color-neutral-700)">{renderInline(line.slice(2))}</li>); return; }
    if (/^\d+\. /.test(line)) { elements.push(<li key={i} className="ml-4 list-decimal text-(--color-neutral-700)">{renderInline(line.replace(/^\d+\. /, ''))}</li>); return; }
    if (line.startsWith('---')) { elements.push(<hr key={i} className="divider-gradient my-2" />); return; }
    if (line.trim() === '') { elements.push(<div key={i} className="h-1" />); return; }
    elements.push(<p key={i} className="text-(--color-neutral-700)">{renderInline(line)}</p>);
  });
  flushTable();

  return <div className="space-y-1 text-[13px] leading-relaxed">{elements}</div>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded hover:bg-(--color-neutral-100) transition-colors" title="Copiar">
      {copied ? <Check size={12} className="text-(--color-success)" /> : <Copy size={12} className="text-(--color-neutral-400)" />}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AIAssistant() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [context, setContext] = useState<Record<string, any>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Collect live data from all collections
  useEffect(() => {
    if (!user) return;
    const cols = ['projects', 'clients', 'staff', 'suppliers', 'inventory', 'transactions', 'purchaseOrders'] as const;
    const unsubs = cols.map(col =>
      subscribeToCollection(col, (data) => setContext(prev => ({ ...prev, [col]: data })))
    );
    return () => unsubs.forEach(u => u());
  }, [user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '' };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsLoading(true);

    abortRef.current = new AbortController();

    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error('Sesión no válida');

      const res = await fetch('/api/ai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          context,
          modelName: settings.aiModel,
          apiKey: settings.aiApiKey,
        }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // toTextStreamResponse emite texto plano directamente
        accumulated += chunk;
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: accumulated } : m
        ));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      toast.error('Error al conectar con la IA', { description: err.message });
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsLoading(false);
    }
  }, [messages, context, isLoading, user]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };

  const contextSummary = {
    proyectos:     context.projects?.length ?? 0,
    clientes:      context.clients?.length ?? 0,
    personal:      context.staff?.length ?? 0,
    proveedores:   context.suppliers?.length ?? 0,
    inventario:    context.inventory?.length ?? 0,
    transacciones: context.transactions?.length ?? 0,
  };
  const totalRecords = Object.values(contextSummary).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="icon-box icon-gradient-purple w-10 h-10">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-(--color-primary) uppercase tracking-tight">Calculadora de Presupuestos</h2>
              <p className="text-[9px] font-bold text-(--color-neutral-400) uppercase tracking-widest">
                Presupuestos, informes y análisis con IA
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[color-mix(in_srgb,var(--color-secondary)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-secondary)_20%,transparent)] rounded-xl">
            <div className="status-dot status-dot-blue" />
<span className="text-[9px] font-black uppercase tracking-widest text-(--color-secondary-dark)">
               {totalRecords} registros cargados
             </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {Object.entries(contextSummary).map(([key, count]) => (
            <span key={key} className="px-2 py-0.5 bg-(--color-neutral-100) rounded-full text-[9px] font-bold text-(--color-neutral-500) uppercase tracking-wide">
              {key}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="space-y-6 py-4">
            <div className="bg-(--color-surface-solid)/60 border border-(--color-neutral-200) rounded-2xl p-5 flex gap-4">
              <div className="icon-box icon-gradient-purple w-9 h-9 shrink-0"><Bot size={16} /></div>
              <div>
                <p className="text-[13px] font-bold text-(--color-primary) mb-1">¡Hola! Soy tu calculadora de presupuestos.</p>
                <p className="text-[12px] text-(--color-neutral-500)">
                  Tengo acceso en tiempo real a todos los datos del sistema. Puedo generar informes, analizar tendencias,
                  calcular métricas y responder preguntas sobre proyectos, finanzas, inventario y más.
                </p>
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-(--color-neutral-400) mb-3">Sugerencias rápidas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} disabled={isLoading}
                    className="text-left px-4 py-3 bg-white/60 border border-(--color-neutral-200) rounded-xl text-[11px] text-(--color-neutral-600) hover:border-(--color-secondary) hover:bg-[color-mix(in_srgb,var(--color-secondary)_5%,transparent)] transition-all disabled:opacity-50 group">
                    <Sparkles size={10} className="inline mr-1.5 text-(--color-secondary) group-hover:text-(--color-secondary-dark)" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${msg.role === 'user' ? 'bg-(--color-neutral-800) text-white' : 'icon-box icon-gradient-purple'}`}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-(--color-neutral-800) text-white rounded-tr-sm' : 'bg-white/80 border border-(--color-neutral-200) rounded-tl-sm'}`}>
                {msg.role === 'user' ? (
                  <p className="text-[13px]">{msg.content}</p>
                ) : (
                  <div>
                    {msg.content
                      ? <MarkdownText text={msg.content} />
                      : <Loader2 size={14} className="animate-spin text-(--color-secondary)" />
                    }
                    {msg.content && <div className="flex justify-end mt-2"><CopyButton text={msg.content} /></div>}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-6 pb-6 pt-3 border-t border-(--color-neutral-200)">
        {messages.length > 0 && (
          <button onClick={() => { abortRef.current?.abort(); setMessages([]); setIsLoading(false); }}
            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-(--color-neutral-400) hover:text-(--color-neutral-600) mb-3 transition-colors">
            <RotateCcw size={10} /> Nueva conversación
          </button>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pide un informe, análisis o consulta sobre tus datos..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-neutral-900/40 border border-(--color-neutral-200) rounded-xl text-[13px] text-(--color-neutral-800) placeholder:text-(--color-neutral-400) focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-secondary)_30%,transparent)] focus:border-(--color-secondary) transition-all disabled:opacity-50"
          />
          <button type="submit" disabled={isLoading || !input.trim()}
            className="px-4 py-3 bg-(--color-neutral-800) text-white rounded-xl hover:bg-(--color-neutral-900) transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
        <p className="text-[8px] text-(--color-neutral-300) text-center mt-2 uppercase tracking-widest">
          Powered by Vercel AI SDK · Gemini 2.0 Flash
        </p>
      </div>
    </div>
  );
}


