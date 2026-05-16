import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Mic, MicOff, Loader2, Bot, User, RotateCcw, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToCollection } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { toast } from 'sonner';

interface Message { id: string; role: 'user' | 'assistant'; content: string; }

interface BudgetAlert {
  id: string;
  projectId: string;
  projectName: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  timestamp: string;
}

interface BudgetForecast {
  projectId: string;
  projectName: string;
  currentBudget: number;
  spentToDate: number;
  projectedFinalCost: number;
  variancePercentage: number;
  riskLevel: 'low' | 'medium' | 'high';
}

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
  '🔍 Alertas de presupuesto',
  '💡 Oportunidades de ahorro',
  '📊 Pronóstico de costos',
  '📋 Análisis de variación presupuestaria'
];

interface AIFloatingButtonProps {
  setActiveTab?: (t: string) => void;
  variant?: 'fab' | 'inline';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function AIFloatingButton({ setActiveTab, variant = 'fab', open: controlledOpen, onOpenChange }: AIFloatingButtonProps) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = variant === 'inline' ? (controlledOpen ?? false) : internalOpen;

  const handleSetOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    if (variant === 'inline') {
      const next = typeof value === 'function' ? value(controlledOpen ?? false) : value;
      onOpenChange?.(next);
    } else {
      setInternalOpen(value);
    }
  }, [variant, controlledOpen, onOpenChange]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [context, setContext] = useState<Record<string, any>>({});
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);
  const [budgetForecasts, setBudgetForecasts] = useState<BudgetForecast[]>([]);
  const [budgetHealth, setBudgetHealth] = useState<{
    status: 'healthy' | 'warning' | 'critical';
    percentage: number;
    message: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  
  // Iniciar cerrado por defecto (solo pestaña visible) - SOLO AL MONTAR
  useEffect(() => {
    handleSetOpen(false);
  }, []);

  // Initialize budget tracking when context loads
  useEffect(() => {
    if (!user || Object.keys(context).length === 0) return;
    
    const projects = context.projects || [];
    if (projects.length === 0) return;
    
    const totalBudget = projects.reduce((sum: number, p: any) => sum + (p.budget || 0), 0);
    const totalSpent = projects.reduce((sum: number, p: any) => {
      const budget = p.budget || 0;
      const progress = p.progress || 0;
      return sum + (budget * progress / 100);
    }, 0);
    
    if (totalBudget <= 0) return;
    
    const percentage = (totalSpent / totalBudget) * 100;
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let message = '';
    
    if (percentage >= 90) {
      status = 'critical';
      message = `Presupuesto crítico: ${percentage.toFixed(1)}% utilizado`;
    } else if (percentage >= 75) {
      status = 'warning';
      message = `Presupuesto en alerta: ${percentage.toFixed(1)}% utilizado`;
    } else {
      status = 'healthy';
      message = `Presupuesto saludable: ${percentage.toFixed(1)}% utilizado`;
    }
    
    setBudgetHealth({ status, percentage, message });
  }, [context, user]);

  // Load context
  useEffect(() => {
    if (!user) return;
    const cols = ['projects', 'clients', 'staff', 'suppliers', 'inventory', 'transactions', 'purchaseOrders'] as const;
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
       const token = await user?.getIdToken();
       if (!token) throw new Error('Sesión no válida');

       // Prepare enhanced context with budget data
       const enhancedContext = {
         ...context,
         budgetAnalysis: {
           alerts: budgetAlerts,
           forecasts: budgetForecasts,
           health: budgetHealth,
           summary: {
             totalProjects: context.projects?.length || 0,
              totalBudget: context.projects?.reduce((sum, p) => sum + (p.budget || 0), 0) || 0,
              totalSpent: context.projects?.reduce((sum, p) => sum + ((p.budget || 0) * (p.progress || 0) / 100), 0) || 0,
              averageVariance: context.projects?.length > 0 
                ? context.projects.reduce((sum, p) => {
                    const budget = p.budget || 1;
                    const spent = (p.budget || 0) * (p.progress || 0) / 100;
                    return sum + ((spent - budget) / budget * 100);
                  }, 0) / context.projects.length
                : 0
           }
         }
       };

        const res = await fetch('/api/ai-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
            context: enhancedContext,
            modelName: settings.aiModel,
            apiKey: settings.aiApiKey,
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
       toast.error('Error al conectar con la IA', { description: e.message });
       setMessages(prev => prev.filter(m => m.id !== asstId));
     } finally {
       setLoading(false);
     }
   }, [messages, context, loading, user, budgetAlerts, budgetForecasts, budgetHealth]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };

  return (
    <>
      {/* FAB button - only in fab variant */}
      {variant === 'fab' && (
        <motion.button
          onClick={() => handleSetOpen(v => !v)}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0))] md:bottom-6 right-6 z-300 w-10 h-36 rounded-t-2xl shadow-2xl flex items-center justify-center bg-[linear-gradient(135deg,#8b5cf6,#6366f1)]"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          title="Calculadora de Presupuestos"
        >
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div key="x" initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 0, opacity: 0 }} transition={{ duration: 0.15 }}>
                <X size={18} className="text-white" />
              </motion.div>
            ) : (
              <motion.div key="s" initial={{ rotate: 0, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 0, opacity: 0 }} transition={{ duration: 0.15 }}>
                <Sparkles size={18} className="text-white" />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Pulse ring */}
          {!open && (
            <span className="absolute inset-0 rounded-t-2xl animate-ping opacity-20 bg-[linear-gradient(135deg,#8b5cf6,#6366f1)]" />
          )}
        </motion.button>
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={variant === 'inline'
              ? "absolute right-0 top-full mt-2 z-299 w-95 max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl overflow-hidden flex flex-col bg-[rgba(15,20,40,0.97)] border border-[rgba(139,92,246,0.3)]"
              : "fixed bottom-24 md:bottom-16 right-6 z-299 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl overflow-hidden flex flex-col bg-[rgba(15,20,40,0.97)] border border-[rgba(139,92,246,0.3)]"}
            style={{ 
              maxHeight: variant === 'inline' ? 'min(560px, calc(100dvh - 5rem))' : 'calc(100dvh - 8rem)', 
              height: variant === 'inline' ? 'min(560px, calc(100dvh - 5rem))' : 'calc(100dvh - 8rem)',
            }}
          >
            {/* Header */}
            <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-xl flex items-center justify-center bg-[linear-gradient(135deg,#8b5cf6,#6366f1)]">
                  <Sparkles size={12} className="text-white" />
                </div>
                 <div>
                   <p className="text-[10px] font-black text-white uppercase tracking-widest">Calculadora de Presupuestos</p>
                   <div className="flex items-center gap-1 mt-0.5">
                     <p className="text-[8px] text-purple-400 uppercase tracking-widest">Gemini 2.0 Flash</p>
                     {budgetHealth && (
                       <>
                         <span className={`px-2 py-0.5 rounded text-[7px] font-bold 
                           ${budgetHealth.status === 'healthy' ? 'bg-green-100 text-green-800' : 
                             budgetHealth.status === 'warning' ? 'bg-yellow-100 text-yellow-800' : 
                             'bg-red-100 text-red-800'}`}>
                           {budgetHealth.message}
                         </span>
                       </>
                     )}
                   </div>
                 </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={() => { abortRef.current?.abort(); setMessages([]); setLoading(false); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors" title="Nueva conversación">
                    <RotateCcw size={10} />
                  </button>
                )}
                {setActiveTab && (
                  <button onClick={() => { handleSetOpen(false); setActiveTab('ai'); }}
                    className="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-purple-400 hover:bg-purple-500/20 transition-colors">
                    Abrir completo
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {messages.length === 0 ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="w-5 h-5 rounded-lg shrink-0 flex items-center justify-center bg-[linear-gradient(135deg,#8b5cf6,#6366f1)]">
                      <Bot size={10} className="text-white" />
                    </div>
                    <div className="bg-white/8 rounded-xl rounded-tl-sm px-2 py-2">
                      <p className="text-[10px] text-slate-300">¡Hola! Puedo generar informes y análisis de tu ERP. Escribe o usa el micrófono 🎤</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {QUICK.map((q, i) => (
                      <button key={i} onClick={() => sendMessage(q)} disabled={loading}
                         className="text-left px-2 py-1.5 rounded-xl text-[9px] text-white hover:text-white transition-all disabled:opacity-40 bg-[rgba(139,92,246,0.12)] border border-[rgba(139,92,246,0.2)]">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex gap-1.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-5 h-5 rounded-lg shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-700' : 'bg-[linear-gradient(135deg,#8b5cf6,#6366f1)]'}`}>
                      {msg.role === 'user' ? <User size={10} className="text-white" /> : <Bot size={10} className="text-white" />}
                    </div>
                     <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 ${msg.role === 'user' ? 'bg-slate-700 text-white rounded-tr-sm' : 'rounded-tl-sm text-slate-200 bg-[rgba(255,255,255,0.15)]'}`}>
                      {msg.role === 'user'
                        ? <p className="text-[11px]">{msg.content}</p>
                        : msg.content
                          ? <><MiniMarkdown text={msg.content} /><div className="flex justify-end mt-0.5"><CopyBtn text={msg.content} /></div></>
                          : <Loader2 size={10} className="animate-spin text-purple-400" />
                      }
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 px-2 pb-2 pt-1.5 border-t border-white/10">
              <form onSubmit={handleSubmit} className="flex gap-1.5">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={listening ? '🎤 Escuchando...' : 'Escribir...'}
                  disabled={loading || listening}
                  className="flex-1 px-2 py-2 rounded-xl text-[11px] text-white placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-400/50 disabled:opacity-50 bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.15)]"
                />
                {/* Mic button */}
                <button type="button"
                  onClick={listening ? stopVoice : startVoice}
                  disabled={loading}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 ${listening ? 'bg-red-400 animate-pulse' : 'bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] hover:bg-white/8'}`}
                  title={listening ? 'Detener' : 'Hablar'}
                >
                  {listening ? <MicOff size={12} className="text-white" /> : <Mic size={12} className="text-purple-400" />}
                </button>
                {/* Send button */}
                <button type="submit" disabled={loading || !input.trim()}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 bg-[linear-gradient(135deg,#8b5cf6,#6366f1)]">
                  {loading ? <Loader2 size={12} className="animate-spin text-white" /> : <Send size={12} className="text-white" />}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

