import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../contexts/AuthContext";
import { useProjectFilter } from "../../contexts/ProjectFilterContext";
import { Avatar } from "../ui/avatar";
import { Bell, Search, Home, Package, DollarSign, Clock, X } from "lucide-react";
import TopBarClock from "../TopBarClock";
import { cn } from "../../utils/cn";

interface TopBarProps {
  onNavigate?: (tab: string) => void;
  activeTab?: string;
}

export function TopBar({ onNavigate, activeTab }: TopBarProps) {
  const { user } = useAuth();
  const { selectedProjectId, setSelectedProjectId, executingProjects } = useProjectFilter();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 h-20 z-[100] nav-glass px-6 flex items-center justify-between border-b border-white/5">
      {/* Left: Avatar & Welcome */}
      <div className="flex items-center gap-4 w-1/4">
        {activeTab !== 'dashboard' && onNavigate && (
          <button 
            onClick={() => onNavigate('dashboard')}
            className="p-2.5 bg-amber-500 text-black rounded-xl hover:bg-amber-400 transition-all shadow-lg active:scale-90"
            title="Ir al Inicio"
          >
            <Home size={18} strokeWidth={3} />
          </button>
        )}
        <div className="relative">
          <Avatar 
            src={user?.photoURL || undefined} 
            alt={user?.displayName || "Usuario"} 
            size="md" 
            className="border-2 border-amber-500/20"
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-[#0c1222] rounded-full" />
        </div>
        <div className="hidden lg:flex flex-col leading-tight">
          <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] opacity-80">Bienvenido</span>
          <span className="text-sm font-black text-white truncate max-w-[120px] tracking-tight">{user?.displayName}</span>
        </div>
      </div>

      {/* Center: Brand & Slogan */}
      <div className="flex flex-col items-center text-center flex-1">
        <h1 className="text-lg md:text-2xl font-black text-white tracking-[-0.03em] uppercase leading-none">
          CONSTRUCTORA <span className="text-amber-500">WM/M&S</span>
        </h1>
        <p className="text-[8px] md:text-[9px] font-black text-white/40 tracking-[0.45em] uppercase mt-1 leading-none">
          EDIFICANDO EL FUTURO
        </p>
      </div>

      {/* Right: Search, Clock, Logo */}
      <div className="flex items-center justify-end gap-5 w-1/4 relative">
        {/* Project Selector / Search */}
        <div className="relative hidden xl:block group">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 pl-9 text-[10px] font-black text-white uppercase focus:outline-none focus:ring-1 focus:ring-amber-500/50 min-w-[220px] appearance-none cursor-pointer hover:bg-white/10 transition-all"
            title="Seleccionar proyecto"
          >
            <option value="ALL">TODOS LOS PROYECTOS</option>
            {executingProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-amber-500/60 group-hover:text-amber-500 transition-colors">
            <Search size={14} />
          </div>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={cn(
              "relative p-2.5 rounded-xl transition-all border border-white/5",
              isNotificationsOpen ? "bg-amber-500 text-black shadow-glow" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-amber-500"
            )}
          >
            <Bell size={18} />
            {!isNotificationsOpen && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0c1222] animate-pulse" />
            )}
          </button>

          <AnimatePresence>
            {isNotificationsOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-14 w-80 bg-[#0e121d] border border-white/10 rounded-3xl shadow-2xl z-[120] overflow-hidden backdrop-blur-xl ring-1 ring-white/10"
                >
                  <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Notificaciones</h3>
                    <span className="bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full">3 NUEVAS</span>
                  </div>
                  <div className="p-2 max-h-96 overflow-y-auto custom-scrollbar">
                     {[
                       { title: 'Stock Crítico', desc: 'El cemento está por debajo del mínimo.', time: 'Hace 5 min', icon: <Package size={14} />, color: 'text-rose-500' },
                       { title: 'Nuevo Aporte', desc: 'Cliente Juan Pérez realizó un pago.', time: 'Hace 1 hora', icon: <DollarSign size={14} />, color: 'text-emerald-500' },
                       { title: 'Recordatorio', desc: 'Reunión con proveedores a las 3 PM.', time: 'Hoy', icon: <Clock size={14} />, color: 'text-amber-500' },
                     ].map((n, i) => (
                       <div key={i} className="p-4 hover:bg-white/5 rounded-2xl transition-all cursor-pointer group">
                         <div className="flex gap-3">
                           <div className={cn("w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0", n.color)}>
                             {n.icon}
                           </div>
                           <div className="min-w-0 flex-1">
                             <div className="flex justify-between items-start">
                               <p className="text-[11px] font-black text-white uppercase tracking-tight">{n.title}</p>
                               <p className="text-[8px] font-bold text-white/20 uppercase ml-2">{n.time}</p>
                             </div>
                             <p className="text-[10px] text-white/40 leading-snug mt-0.5">{n.desc}</p>
                           </div>
                         </div>
                       </div>
                     ))}
                  </div>
                  <div className="p-4 bg-white/5 text-center">
                     <button className="text-[9px] font-black text-amber-500 uppercase tracking-widest hover:text-amber-400 transition-colors">Ver todas las alertas</button>
                  </div>
                </motion.div>
                <div className="fixed inset-0 z-[-1]" onClick={() => setIsNotificationsOpen(false)} />
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Clock & Calendar Component */}
        <TopBarClock />

        {/* Company Logo */}
        <div className="hidden sm:block ml-1">
           <img src="/logo.png" alt="Logo" className="h-9 w-auto object-contain brightness-125 contrast-125" />
        </div>
      </div>
    </header>
  );
}

