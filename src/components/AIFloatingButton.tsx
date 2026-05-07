import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Mic, MicOff, Loader2, Bot, User, RotateCcw, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToCollection } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface Message { id: string; role: 'user' | 'assistant'; content: string; }

// Minimal markdown: bold + line breaks
function MiniMarkdown({ text }: { text: string }) {
  return (
    <div className="text-[12px] leading-relaxed space-y-1">
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j} className="font-black">{p.slice(2, -2)}</strong>
            : p
        );
        if (line.startsWith('- ') || line.startsWith('• '))
          return <div key={i} className="flex gap-1.5"><span className="text-purple-400 shrink-0">•</span><span>{parts.slice(1)}</span></div>;
        if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### '))
          return <p key={i} className="font-black text-primary">{line.replace(/^#+\s/, '')}</p>;
        return <p key={i}>{parts}</p>;
      })}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); }}
      className="p-1 rounded hover:bg-white/10 transition-colors opacity-60 hover:opacity-100">
      {ok ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
    </button>
  );
}

const QUICK = [
  'Resumen ejecutivo de proyectos',
  'Estado del inventario',
  'Flujo de caja del mes',
  'Proyectos en ejecución',
];

export default function AIFloatingButton({ setActiveTab }: { setActiveTab?: (t: string) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [context, setContext] = useState<Record<string, any>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);

  // Load context
  useEffect(() => {
    if (!user) return;
    const cols = ['projects', 'clients', 'staff', 'suppliers', 'inventory', 'transactions'] as const;
    const unsubs = cols.map(col => subscribeToCollection(col, data => setContext(p => ({ ...p, [col]: data }))));
    return () => unsubs.forEach(u => u());
  }, [user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Voice recognition
  const startVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error('Tu navegador no soporta reconocimiento de voz'); return; }

    const rec = new SpeechRecognition();
    rec.lang = 'es-GT';
    rec.continuous = false;
    rec.interimResults = false;
    recognitionRef.current = rec;

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      // Auto-send after voice
      setTimeout(() => sendMessage(transcript), 100);
    };
    rec.start();
  }, []);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg };
    const asstId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, userMsg, { id: asstId, role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/ai-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          context,
        }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages(prev => prev.map(m => m.id === asstId ? { ...m, content: acc } : m));
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      toast.error('Error al conectar con la IA');
      setMessages(prev => prev.filter(m => m.id !== asstId));
    } finally {
      setLoading(false);
    }
  }, [messages, context, loading]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };

  return (
    <>
      {/* FAB button */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-[300] w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        title="Asistente IA"
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X size={22} className="text-white" /></motion.div>
            : <motion.div key="s" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Sparkles size={22} className="text-white" /></motion.div>
          }
        </AnimatePresence>
        {/* Pulse ring */}
        {!open && (
          <span className="absolute inset-0 rounded-2xl animate-ping opacity-20" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }} />
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed bottom-24 right-6 z-[299] w-[360px] max-w-[calc(100vw-1.5rem)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ height: 480, background: 'rgba(15,20,40,0.97)', border: '1px solid rgba(139,92,246,0.3)' }}
          >
            {/* Header */}
            <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                  <Sparkles size={13} className="text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-white uppercase tracking-widest">Asistente IA</p>
                  <p className="text-[8px] text-purple-400 uppercase tracking-widest">Gemini 2.0 Flash</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {messages.length > 0 && (
                  <button onClick={() => { abortRef.current?.abort(); setMessages([]); setLoading(false); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors" title="Nueva conversación">
                    <RotateCcw size={12} />
                  </button>
                )}
                {setActiveTab && (
                  <button onClick={() => { setOpen(false); setActiveTab('ai'); }}
                    className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-purple-400 hover:bg-purple-500/20 transition-colors">
                    Abrir completo
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <div className="flex gap-2.5">
                    <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                      <Bot size={11} className="text-white" />
                    </div>
                    <div className="bg-white/8 rounded-xl rounded-tl-sm px-3 py-2.5">
                      <p className="text-[11px] text-slate-300">¡Hola! Puedo generar informes y análisis de tu ERP. Escribe o usa el micrófono 🎤</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {QUICK.map((q, i) => (
                      <button key={i} onClick={() => sendMessage(q)} disabled={loading}
                        className="text-left px-2.5 py-2 rounded-xl text-[10px] text-slate-400 hover:text-white transition-all disabled:opacity-40"
                        style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-700' : ''}`}
                      style={msg.role === 'assistant' ? { background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' } : {}}>
                      {msg.role === 'user' ? <User size={11} className="text-white" /> : <Bot size={11} className="text-white" />}
                    </div>
                    <div className={`max-w-[82%] rounded-xl px-3 py-2 ${msg.role === 'user' ? 'bg-slate-700 text-white rounded-tr-sm' : 'rounded-tl-sm text-slate-200'}`}
                      style={msg.role === 'assistant' ? { background: 'rgba(255,255,255,0.07)' } : {}}>
                      {msg.role === 'user'
                        ? <p className="text-[12px]">{msg.content}</p>
                        : msg.content
                          ? <><MiniMarkdown text={msg.content} /><div className="flex justify-end mt-1"><CopyBtn text={msg.content} /></div></>
                          : <Loader2 size={12} className="animate-spin text-purple-400" />
                      }
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 px-3 pb-3 pt-2 border-t border-white/10">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={listening ? '🎤 Escuchando...' : 'Escribe o usa el micrófono...'}
                  disabled={loading || listening}
                  className="flex-1 px-3 py-2.5 rounded-xl text-[12px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                {/* Mic button */}
                <button type="button"
                  onClick={listening ? stopVoice : startVoice}
                  disabled={loading}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 ${listening ? 'bg-red-500 animate-pulse' : 'hover:bg-white/10'}`}
                  style={!listening ? { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' } : {}}
                  title={listening ? 'Detener' : 'Hablar'}
                >
                  {listening ? <MicOff size={15} className="text-white" /> : <Mic size={15} className="text-purple-400" />}
                </button>
                {/* Send button */}
                <button type="submit" disabled={loading || !input.trim()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                  {loading ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} className="text-white" />}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
