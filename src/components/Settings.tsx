import React from 'react';
import { 
  Palette, 
  Type, 
  BarChart3, 
  Layout as LayoutIcon, 
  Zap, 
  RotateCcw,
  Monitor,
  Smartphone,
  Layers,
  Check,
  Sparkles,
  Key
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';
import { useSettings, ThemeMode, GraphType, CardStyle, TransitionSpeed, TypographyStyle, Currency, ALL_MODULES } from '../contexts/SettingsContext';
import FirestoreTest from './FirestoreTest';

export default function Settings() {
  const { settings, updateSettings, resetSettings } = useSettings();

  const themes: { id: ThemeMode; label: string; desc: string; swatches: string[] }[] = [
    { id: 'minimalist', label: 'Minimalista', desc: 'Limpio, profesional y tipográfico', swatches: ['var(--color-neutral-900)', 'var(--color-info)', 'var(--color-neutral-100)', 'var(--color-neutral-400)'] },
    { id: 'cyberpunk', label: 'Cyberpunk', desc: 'Alto contraste, neones y profundidad', swatches: ['var(--color-info)', 'var(--color-secondary-dark)', 'var(--color-neutral-900)', 'var(--color-neutral-100)'] },
    { id: 'soft', label: 'Soft Orgánico', desc: 'Pastel, redondeado y degradados suaves', swatches: ['var(--color-secondary-dark)', 'var(--color-secondary)', 'var(--color-neutral-50)', 'var(--color-secondary-dark)'] },
  ];

  const graphTypes: { id: GraphType; label: string; icon: React.ReactNode }[] = [
    { id: 'bar', label: 'Barras', icon: <BarChart3 size={16} /> },
    { id: 'line', label: 'Líneas', icon: <RotateCcw size={16} className="-rotate-90" /> },
    { id: 'area', label: 'Áreas', icon: <Palette size={16} /> },
  ];

  const cardStyles: { id: CardStyle; label: string }[] = [
    { id: 'elevated', label: 'Elevado (Sombra)' },
    { id: 'flat', label: 'Plano (Gris)' },
    { id: 'glass', label: 'Cristal (Blur)' },
    { id: 'bordered', label: 'Borde Solo' },
  ];

  const fonts: { id: TypographyStyle; label: string; desc: string }[] = [
    { id: 'inter', label: 'Inter', desc: 'Diseño Suizo / UI Moderno' },
    { id: 'space', label: 'Space Grotesk', desc: 'Tech / Geométrico' },
    { id: 'mono', label: 'JetBrains Mono', desc: 'Ingeniería / Brutalista' },
  ];

  return (
    <div id="settings-container" className="max-w-4xl mx-auto space-y-8 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] scroll-mb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      <header className="text-left mb-10">
        <h2 className="text-2xl font-black text-primary uppercase tracking-tighter">Configuración Visual</h2>
        <p className="text-[10px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Personaliza tu experiencia de gestión</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Theme & Brand */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={18} className="text-secondary" />
            <h3 className="text-xs font-black text-primary uppercase tracking-widest">Tema y Marca</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => updateSettings({ themeMode: theme.id })}
                className={cn(
                  "p-4 rounded-2xl border text-left transition-all group relative overflow-hidden",
                  settings.themeMode === theme.id 
                    ? "border-primary bg-[var(--color-primary)] text-[var(--color-neutral-50)] shadow-xl shadow-[var(--color-primary)]/20 scale-[1.02] ring-2 ring-secondary/30" 
                    : "border-[var(--color-neutral-200)] bg-[var(--color-surface-solid)] text-[var(--color-neutral-600)] hover:border-[var(--color-neutral-300)] hover:shadow-md"
                )}
              >
                {settings.themeMode === theme.id && (
                  <div className="absolute top-2 right-2 text-secondary z-10"><Check size={14} /></div>
                )}
                {/* Color swatches */}
                <div className="flex gap-1 mb-3">
                  {theme.swatches.map((color, i) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded-full border border-[var(--color-surface-solid)]/30 shadow-sm bg-[var(--swatch-bg)]"
                  style={{ '--swatch-bg': color } as React.CSSProperties}
                />
                  ))}
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest">{theme.label}</p>
                <p className={cn("text-[8px] font-bold mt-1 uppercase opacity-60", settings.themeMode === theme.id ? "text-slate-300" : "text-[var(--color-neutral-400)]")}>{theme.desc}</p>
              </button>
            ))}
          </div>

          <div className="bg-[var(--color-surface-solid)] p-6 rounded-3xl border border-[var(--color-neutral-200)] space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[9px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Color Primario</label>
              <input 
                type="color" 
                value={settings.primaryColor}
                onChange={(e) => updateSettings({ primaryColor: e.target.value })}
                title="Color primario"
                className="w-10 h-10 rounded-xl bg-transparent border-none cursor-pointer"
              />
            </div>
            <div className="flex justify-between items-center">
              <label className="text-[9px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Color de Acento (Secundario)</label>
              <input 
                type="color" 
                value={settings.secondaryColor}
                onChange={(e) => updateSettings({ secondaryColor: e.target.value })}
                title="Color secundario"
                className="w-10 h-10 rounded-xl bg-transparent border-none cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* Typography & UI */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Type size={18} className="text-secondary" />
            <h3 className="text-xs font-black text-primary uppercase tracking-widest">Tipografía y Textos</h3>
          </div>

          <div className="space-y-3">
            {fonts.map((f) => (
              <button
                key={f.id}
                onClick={() => updateSettings({ typography: f.id })}
                className={cn(
                  "w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all",
                  settings.typography === f.id 
                    ? "border-primary bg-[var(--color-primary)]/5 shadow-md" 
                    : "border-[var(--color-neutral-200)] bg-[var(--color-surface-solid)] hover:border-[var(--color-neutral-300)]"
                )}
              >
                <div>
                  <p className={cn("text-[11px] font-black uppercase tracking-tight", 
                    f.id === 'inter' && 'font-sans',
                    f.id === 'space' && 'font-space',
                    f.id === 'mono' && 'font-mono'
                  )}>{f.label}</p>
                  <p className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-0.5">{f.desc}</p>
                </div>
                {settings.typography === f.id && <div className="w-6 h-6 bg-[var(--color-primary)] text-[var(--color-neutral-50)] rounded-full flex items-center justify-center p-1"><Check size={12} /></div>}
              </button>
            ))}
          </div>
        </section>

        {/* Visual Effects */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={18} className="text-secondary" />
            <h3 className="text-xs font-black text-primary uppercase tracking-widest">Efectos y Construcción</h3>
          </div>

          <div className="bg-[var(--color-surface-solid)] p-6 rounded-3xl border border-[var(--color-neutral-200)] space-y-6">
             <div>
               <label className="text-[9px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest block mb-4">Estilo de Contenedores (Cards)</label>
               <div className="grid grid-cols-2 gap-2">
                 {cardStyles.map(style => (
                    <button
                      key={style.id}
                      onClick={() => updateSettings({ cardStyle: style.id })}
                      className={cn(
                        "py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all",
                        settings.cardStyle === style.id 
                          ? "bg-[var(--color-neutral-900)] text-[var(--color-neutral-50)] border-slate-900" 
                          : "bg-[var(--color-neutral-50)] text-[var(--color-neutral-400)] border-[var(--color-neutral-100)]"
                      )}
                    >
                      {style.label}
                    </button>
                 ))}
               </div>
             </div>

             <div>
               <label className="text-[9px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest block mb-4">Velocidad de Animación</label>
               <div className="flex bg-[var(--color-neutral-100)] p-1 rounded-2xl gap-1">
                 {(['none', 'fast', 'normal', 'slow'] as const).map((speed) => {
                   const labels: Record<string, string> = { none: 'Sin', fast: 'Rápida', normal: 'Normal', slow: 'Lenta' };
                   return (
                    <button
                      key={speed}
                      onClick={() => updateSettings({ transitionSpeed: speed as TransitionSpeed })}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-tighter transition-all",
                        settings.transitionSpeed === speed ? "bg-[var(--color-surface-solid)] text-primary shadow-sm" : "text-[var(--color-neutral-400)]"
                      )}
                    >
                      {labels[speed]}
                    </button>
                   );
                 })}
               </div>
             </div>
          </div>
        </section>

        {/* Graphs & Data */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-secondary" />
            <h3 className="text-xs font-black text-primary uppercase tracking-widest">Visualización de Datos</h3>
          </div>

          <div className="bg-[var(--color-surface-solid)] p-6 rounded-3xl border border-[var(--color-neutral-200)] space-y-6">
             <div>
               <label className="text-[9px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest block mb-4">Tipo de Gráficas por Defecto</label>
               <div className="flex gap-3">
                 {graphTypes.map(type => (
                   <button
                     key={type.id}
                     onClick={() => updateSettings({ graphType: type.id })}
                     className={cn(
                        "flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                        settings.graphType === type.id 
                          ? "border-secondary bg-[var(--color-secondary)]/10 text-primary" 
                          : "border-[var(--color-neutral-100)] bg-[var(--color-neutral-50)] text-[var(--color-neutral-400)] opacity-60"
                     )}
                   >
                     {type.icon}
                     <span className="text-[8px] font-black uppercase">{type.label}</span>
                   </button>
                 ))}
               </div>
             </div>

             <div className="flex items-center justify-between p-4 bg-[var(--color-neutral-50)] rounded-2xl">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest">Modo Compacto</p>
                  <p className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase">Ajusta la densidad de información</p>
                </div>
                <button 
                  onClick={() => updateSettings({ compactMode: !settings.compactMode })}
                  aria-label="Alternar modo compacto"
                  className={cn("w-12 h-6 rounded-full transition-all relative", settings.compactMode ? "bg-[var(--color-secondary)]" : "bg-slate-300")}
                >
                  <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-[var(--color-surface-solid)] transition-all shadow-sm", settings.compactMode ? "right-1" : "left-1")} />
                </button>
             </div>
          </div>
        </section>
      </div>

      {/* Empresa, Moneda y Modulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-[var(--color-neutral-100)]">

        {/* Empresa */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Monitor size={18} className="text-secondary" />
            <h3 className="text-xs font-black text-primary uppercase tracking-widest">Empresa</h3>
          </div>
          <div className="bg-[var(--color-surface-solid)] p-6 rounded-3xl border border-[var(--color-neutral-200)] space-y-4">
            <div>
              <label className="text-[9px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest block mb-2">Nombre de la Empresa</label>
              <input
                value={settings.companyName}
                onChange={e => updateSettings({ companyName: e.target.value })}
                className="w-full bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-xl px-4 py-2.5 text-[10px] font-black focus:outline-none focus:border-secondary"
                placeholder="Mi Constructora S.A."
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest block mb-2">URL del Logo</label>
              <input
                value={settings.companyLogo}
                onChange={e => updateSettings({ companyLogo: e.target.value })}
                className="w-full bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-xl px-4 py-2.5 text-[10px] font-black focus:outline-none focus:border-secondary"
                placeholder="/logo.png"
              />
              {settings.companyLogo && <img src={settings.companyLogo} alt="logo" className="mt-2 h-10 object-contain" />}
            </div>
          </div>
        </section>

        {/* Moneda */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-secondary" />
            <h3 className="text-xs font-black text-primary uppercase tracking-widest">Moneda</h3>
          </div>
          <div className="bg-[var(--color-surface-solid)] p-6 rounded-3xl border border-[var(--color-neutral-200)]">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Q', '$', '€', '£'] as Currency[]).map(c => (
                <button
                  key={c}
                  onClick={() => updateSettings({ currency: c })}
                  className={cn(
                    "py-3 rounded-xl text-sm font-black border transition-all",
                    settings.currency === c ? "bg-[var(--color-neutral-900)] text-[var(--color-neutral-50)] border-slate-900" : "bg-[var(--color-neutral-50)] text-[var(--color-neutral-400)] border-[var(--color-neutral-100)]"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="text-[8px] text-[var(--color-neutral-400)] uppercase tracking-widest mt-3">Quetzal (Q) · Dólar ($) · Euro (€) · Libra (£)</p>
          </div>
        </section>

        {/* Agente IA */}
        <section className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-secondary" />
            <h3 className="text-xs font-black text-primary uppercase tracking-widest">Agente IA</h3>
          </div>
          <div className="bg-[var(--color-surface-solid)] p-6 rounded-3xl border border-[var(--color-neutral-200)] space-y-5">
            <div>
              <label className="text-[9px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest block mb-3">Modelo Gemini</label>
              <select
                value={settings.aiModel}
                onChange={e => updateSettings({ aiModel: e.target.value })}
                title="Seleccionar modelo de IA"
                className="w-full px-4 py-3 rounded-xl text-[12px] font-bold text-primary border border-[var(--color-neutral-200)] bg-[var(--color-surface-solid)] focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash — rápido y eficiente (actual)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro — máxima calidad, análisis profundos</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash — estable y probado</option>
                <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite — más rápido, menor costo</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro — calidad probada</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash — rápido y económico</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest block mb-3">
                <div className="flex items-center gap-2">
                  <Key size={12} />
                  API Key de Gemini
                </div>
              </label>
              <input
                type="password"
                value={settings.aiApiKey}
                onChange={e => updateSettings({ aiApiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full px-4 py-3 rounded-xl text-[12px] text-primary border border-[var(--color-neutral-200)] bg-[var(--color-surface-solid)] focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 placeholder:text-slate-300 font-mono"
              />
              <p className="text-[8px] text-[var(--color-neutral-400)] mt-2 leading-relaxed">
                Déjalo vacío para usar la variable de entorno <strong className="text-[var(--color-secondary-dark)]">GEMINI_API_KEY</strong> del servidor.
                Si ingresas una clave aquí, sobrescribirá la del servidor para este navegador.
                Obtén tu clave en <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[var(--color-secondary-dark)] underline">Google AI Studio</a>
              </p>
            </div>
          </div>
        </section>

        {/* Modulos activos */}
        <section className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-secondary" />
            <h3 className="text-xs font-black text-primary uppercase tracking-widest">Modulos Activos</h3>
          </div>
          <div className="bg-[var(--color-surface-solid)] p-6 rounded-3xl border border-[var(--color-neutral-200)]">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {ALL_MODULES.filter(m => m !== 'settings').map(mod => {
                const active = (settings.activeModules ?? ALL_MODULES).includes(mod);
                const labels: Record<string, string> = { dashboard: 'Dashboard', clients: 'Clientes', projects: 'Proyectos', calculator: 'Presupuestos', execution: 'Bitacora', seguimiento: 'Avance', gantt: 'Gantt', suppliers: 'Proveedores', inventory: 'Inventario', analytics: 'Analiticas', staff: 'RRHH' };
                return (
                  <button
                    key={mod}
                    onClick={() => {
                      const current = settings.activeModules ?? ALL_MODULES;
                      const next = active
                        ? current.filter(m => m !== mod)
                        : [...current, mod];
                      if (next.length > 0) updateSettings({ activeModules: next });
                    }}
                    className={cn(
                      "py-2.5 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-between gap-2",
                      active ? "bg-[var(--color-neutral-900)] text-[var(--color-neutral-50)] border-slate-900" : "bg-[var(--color-neutral-50)] text-[var(--color-neutral-400)] border-[var(--color-neutral-100)]"
                    )}
                  >
                    {labels[mod] || mod}
                    <div className={cn("w-2 h-2 rounded-full", active ? "bg-[var(--color-secondary)]" : "bg-slate-300")} />
                  </button>
                );
              })}
            </div>
            <p className="text-[8px] text-[var(--color-neutral-400)] uppercase tracking-widest mt-3">Settings siempre permanece activo</p>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-10 border-t border-[var(--color-neutral-100)]">
        <button 
          onClick={resetSettings}
          className="flex items-center gap-2 text-[10px] font-black text-[var(--color-error)] uppercase tracking-widest hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] px-6 py-3 rounded-2xl transition-all"
        >
          <RotateCcw size={14} /> Reiniciar Valores
        </button>
        <div className="flex items-center gap-4 text-[var(--color-neutral-400)]">
          <Monitor size={16} />
          <Smartphone size={16} />
          <div className="h-4 w-[1px] bg-[var(--color-neutral-200)] mx-2" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Versión 1.0.4 - Edición Pro</span>
        </div>
      </div>

      {/* Diagnóstico Firestore */}
      <div className="pt-8 border-t border-[var(--color-neutral-100)]">
        <FirestoreTest />
      </div>
    </div>
  );
}
