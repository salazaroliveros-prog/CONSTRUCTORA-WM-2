/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Building2, LayoutDashboard, Users, ClipboardList,
  Package, Settings, Truck, Bell, Search, Maximize,
  HelpCircle, BarChart3, TrendingUp, Sparkles, Calendar,
  Activity, X, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToCollection } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { ALL_MODULES } from '../contexts/SettingsContext';
import { useProjectFilter } from '../contexts/ProjectFilterContext';
import { toast } from 'sonner';
import TopBarClock from './TopBarClock';
import AIFloatingButton from './AIFloatingButton';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const NOTIFICATION_STORAGE_KEY = 'wm_read_notifications';

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [liveNotifications, setLiveNotifications] = useState<{ id: string; text: string; type: string; module: string }[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [allData, setAllData] = useState<{ projects: any[]; clients: any[] }>({ projects: [], clients: [] });
  const [navOpen, setNavOpen] = useState(false);
  const [showAI, setShowAI] = useState(false);

  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const { selectedProjectId, setSelectedProjectId, executingProjects, setExecutingProjects } = useProjectFilter();

  // Load data for global search + project filter
  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToCollection('projects', (d: any[]) => {
      setAllData(p => ({ ...p, projects: d }));
      setExecutingProjects(d.filter((p: any) => p.status === 'EJECUCION'));
    });
    const u2 = subscribeToCollection('clients', (d: any[]) => setAllData(p => ({ ...p, clients: d })));
    return () => { u1(); u2(); };
  }, [user]);

  // Global search (avoid derived-state effects)
  const globalResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    const results: { label: string; sub: string; module: string }[] = [];

    allData.projects
      .filter(p => p.name?.toLowerCase().includes(q) || p.clientName?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(p => results.push({ label: p.name, sub: `Proyecto · ${p.clientName || ''}`, module: 'projects' }));

    allData.clients
      .filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(c => results.push({ label: c.name, sub: `Cliente · ${c.email || ''}`, module: 'clients' }));

    return results.slice(0, 8);
  }, [globalSearch, allData]);

  // Live notifications
  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToCollection('projects', (projects: any[]) => {
      const today = new Date();
      const delayed = projects.filter(p => p.status === 'EJECUCION' && p.endDate && new Date(p.endDate) < today && (p.progress || 0) < 100);
      setLiveNotifications(prev => [
        ...prev.filter(n => !n.id.startsWith('proj-')),
        ...delayed.slice(0, 3).map(p => ({ id: `proj-${p.id}`, text: `Proyecto atrasado: ${p.name}`, type: 'warning', module: 'projects' }))
      ].slice(0, 8));
    });
    return () => { u1(); };
  }, [user]);

  const unreadCount = liveNotifications.filter(n => !readIds.includes(n.id)).length;

  const handleOpenNotifications = () => {
    const allIds = liveNotifications.map(n => n.id);
    setReadIds(allIds);
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(allIds));
    setShowNotifications(v => !v);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen?.();
  };

  const allMenuItems = [
    { id: 'dashboard',   label: 'Inicio',              labelMobile: 'Inicio',   icon: <LayoutDashboard size={20} />, iconMobile: <LayoutDashboard size={18} />, priority: 1 },
    { id: 'projects',    label: 'Proyectos',           labelMobile: 'Proyectos',icon: <Building2 size={18} />,       iconMobile: <Building2 size={18} />, priority: 1 },
    { id: 'execution',   label: 'Bitácora',            labelMobile: 'Bitácora', icon: <ClipboardList size={18} />,  iconMobile: <ClipboardList size={18} />, priority: 1 },
    { id: 'seguimiento', label: 'Seguimiento',         labelMobile: 'Seguim.',  icon: <TrendingUp size={18} />,     iconMobile: <TrendingUp size={18} />, priority: 2 },
    { id: 'gantt',       label: 'Gantt',               labelMobile: 'Gantt',    icon: <Calendar size={18} />,       iconMobile: <Calendar size={18} />, priority: 2 },
    { id: 'inventory',   label: 'Stock',               labelMobile: 'Stock',    icon: <Package size={18} />,        iconMobile: <Package size={18} />, priority: 2 },
    { id: 'suppliers',   label: 'Proveedores',         labelMobile: 'Proveed.', icon: <Truck size={18} />,          iconMobile: <Truck size={18} />, priority: 2 },
    { id: 'staff',       label: 'Recursos Humanos',    labelMobile: 'RRHH',     icon: <Users size={18} />,          iconMobile: <Users size={18} />, priority: 3 },
    { id: 'clients',     label: 'Clientes',            labelMobile: 'Clientes', icon: <Users size={18} />,           iconMobile: <Users size={18} />, priority: 3 },
    { id: 'analytics',   label: 'Analíticas',          labelMobile: 'Analít.',  icon: <BarChart3 size={18} />,      iconMobile: <BarChart3 size={18} />, priority: 3 },
    { id: 'ai',          label: 'Asistente IA',        labelMobile: 'IA',       icon: <Sparkles size={18} />,       iconMobile: <Sparkles size={18} />, priority: 4 },
    { id: 'settings',    label: 'Ajustes',             labelMobile: 'Ajustes',  icon: <Settings size={18} />,       iconMobile: <Settings size={18} />, priority: 4 },
  ];

  const menuItems = allMenuItems.filter(item =>
    item.id === 'settings' || item.id === 'ai' || (settings.activeModules ?? ALL_MODULES).includes(item.id)
  );

  // Mobile navigation: all modules with horizontal scroll
  const mobileMenuItems = menuItems
    .filter(item => item.id === 'settings' || item.id === 'ai' || (settings.activeModules?.includes(item.id) ?? true));

  const activeItem = menuItems.find(m => m.id === activeTab);

  // Fullscreen al abrir — se activa inmediatamente, Escape sale
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const tryFullscreen = () => {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    tryFullscreen();
    const onInteraction = () => { if (!document.fullscreenElement) tryFullscreen(); };
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('click', onInteraction);
    window.addEventListener('keydown', onInteraction);
    window.addEventListener('touchstart', onInteraction);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('click', onInteraction);
      window.removeEventListener('keydown', onInteraction);
      window.removeEventListener('touchstart', onInteraction);
      window.removeEventListener('keydown', onEscape);
    };
  }, []);

  return (
    <div
      id="app-root"
      className={cn(
        "flex flex-col h-screen text-primary overflow-hidden fixed inset-0",
        settings.typography === 'inter' && 'font-inter',
        settings.typography === 'space' && 'font-space',
        settings.typography === 'mono' && 'font-mono'
      )}
      style={{ '--primary': settings.primaryColor, '--secondary': settings.secondaryColor } as React.CSSProperties}
    >
{/* ── Topbar ─────────────────────────────────────────────── */}
          <header className="h-16 sm:h-17 backdrop-blur-md border-b border-slate-200/50 px-3 sm:px-5 flex items-center shrink-0 z-30 transition-colors bg-white/80">
            {/* Left: Logo / Avatar */}
            <div className="flex items-center shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {user?.photoURL
                  ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  : <span className="uppercase">{user?.displayName?.charAt(0) || 'W'}</span>
                }
              </div>
            </div>

            {/* Center: Branding */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none select-none max-w-[calc(100%-6rem)] md:max-w-none">
              <span className="text-[11px] sm:text-lg md:text-xl font-black text-primary uppercase tracking-[0.12em] leading-tight truncate max-w-full">
                {settings.companyName}
              </span>
              <span className="text-[7px] sm:text-[10px] md:text-xs font-semibold text-amber-500 tracking-[0.2em] uppercase mt-0.5 truncate max-w-full">
                edificando el futuro
              </span>
            </div>

           {/* Spacer */}
           <div className="flex-1" />

            {/* Right: Search + Actions (pushed right to frame the centered branding) */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 hidden sm:flex">
             {/* Global search */}
              <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700 w-56 relative group transition-all focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/10">
                <Search size={14} className="shrink-0 group-focus-within:text-secondary" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  onBlur={() => setTimeout(() => setGlobalSearch(''), 200)}
                  className="bg-transparent border-none focus:outline-none text-[9px] font-black w-full uppercase tracking-widest placeholder:text-slate-300 text-slate-700"
                />
                {globalResults.length > 0 && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-60 overflow-hidden">
                    {globalResults.map((r, i) => (
                      <button key={i} onMouseDown={() => { setActiveTab(r.module); setGlobalSearch(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors text-slate-700">
                       <p className="text-[10px] font-black text-primary uppercase truncate">{r.label}</p>
                       <p className="text-[8px] text-slate-400 font-bold uppercase">{r.sub}</p>
                     </button>
                   ))}
                 </div>
               )}
             </div>

             {/* Fullscreen toggle */}
              <button
                onClick={toggleFullScreen}
                className="hidden sm:flex p-2 text-slate-600 hover:text-primary hover:bg-slate-50 rounded-xl transition-all"
                title="Pantalla completa"
                aria-label="Activar o desactivar pantalla completa"
              >
                <Maximize size={15} />
              </button>

              {/* Help */}
              <button
                onClick={() => toast.info('Ayuda en construcción — Próximamente disponible')}
                className="hidden sm:flex p-2 text-slate-600 hover:text-primary hover:bg-slate-50 rounded-xl transition-all"
                title="Ayuda"
                aria-label="Abrir ayuda"
                type="button"
              >
                <HelpCircle size={15} />
              </button>

              {/* Notifications */}
             <div className="relative">
                 <button onClick={handleOpenNotifications} className="relative p-2 rounded-xl border transition-all bg-slate-50 text-slate-700 hover:text-primary border-slate-100">
                  <Bell size={16} className="hover:rotate-12 transition-transform" />
                  {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-secondary border-2 border-white rounded-full animate-pulse" />}
                </button>
               <AnimatePresence>
                 {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
   className="absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl p-4 z-51 border bg-white border-slate-200"
                    >
                     {/* ...notification list (unchanged) */}
                   </motion.div>
                 )}
      </AnimatePresence>

      {!isFullscreen && (
        <button
          onClick={() => document.documentElement.requestFullscreen?.()?.catch(() => {})}
          className="fixed top-2 right-2 z-99 w-7 h-7 rounded-lg bg-white/70 backdrop-blur-md shadow-md border border-slate-200/50 flex items-center justify-center hover:scale-110 hover:bg-white/90 transition-all duration-200"
          title="Pantalla completa (F11)"
          aria-label="Entrar en pantalla completa"
        >
          <Maximize size={12} className="text-slate-500" />
        </button>
      )}
    </div>

             {/* AI Assistant */}
             <div className="relative">
                 <button
                   onClick={() => setShowAI(v => !v)}
                   className="p-2 rounded-xl transition-all text-slate-600 hover:text-primary hover:bg-slate-50"
                   title="Asistente IA"
                   aria-label="Abrir asistente IA"
                 >
                  {showAI ? <X size={15} /> : <Sparkles size={15} className="text-purple-500" />}
                </button>
               <AIFloatingButton
                 variant="inline"
                 open={showAI}
                 onOpenChange={setShowAI}
                 setActiveTab={setActiveTab}
               />
             </div>

             {/* Avatar */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
                <div className="hidden sm:block text-right">
                  <p className="text-[9px] font-black text-primary uppercase leading-none truncate max-w-22.5">{user?.displayName || 'Usuario'}</p>
                  <p className="text-[7px] font-bold text-slate-600 mt-0.5 tracking-widest uppercase">Admin</p>
                </div>
                <div className="w-8 h-8 rounded-xl shadow-lg border-2 border-white ring-1 ring-slate-200 overflow-hidden bg-slate-900 flex items-center justify-center text-white text-[10px] font-bold cursor-pointer active:scale-95 transition-transform">
                  {user?.photoURL
                    ? <img src={user?.photoURL} alt="Foto de perfil" className="w-full h-full object-cover" referrerPolicy="no-referrer"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden'); }}
                      />
                    : null}
                  <span className="uppercase" hidden={!!user?.photoURL}>{user?.displayName?.charAt(0) || 'U'}</span>
                </div>
              </div>
           </div>
         </header>

      {/* ── Content (full screen, no bottom padding) ────────── */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 scroll-smooth bg-transparent min-h-0 flex flex-col">
        <div className="w-full max-w-450 mx-auto h-full">
          {children}
        </div>
      </main>

      {/* ── Floating Bottom Navigation ─────────────────────────── */}
      <AnimatePresence mode="wait">
        {navOpen ? (
            <motion.div
              key="nav-open"
              initial={{ opacity: 0, y: 16, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="fixed bottom-0 md:bottom-2 left-0 right-0 z-49 flex justify-center"
            >
              <div className="flex items-stretch md:items-center overflow-x-auto overflow-y-hidden no-scrollbar gap-0.5 md:gap-0 px-1.5 py-1.5 rounded-none md:rounded-2xl bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl shadow-[0_-2px_20px_rgba(0,0,0,0.08)] md:shadow-[0_8px_32px_rgba(0,0,0,0.12)] border-t md:border border-slate-200/50 dark:border-slate-700/50 w-full md:w-[calc(100%-2rem)] md:max-w-4xl md:mx-auto">
                {mobileMenuItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setNavOpen(false); }}
                      title={item.label}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-0.5 min-w-13 shrink-0 md:flex-1 md:min-w-0 py-1.5 rounded-xl transition-all duration-200",
                        "hover:scale-[1.6] md:hover:scale-[1.4] hover:z-10 hover:shadow-[0_0_20px_rgba(251,191,36,0.25)] hover:bg-white/90 dark:hover:bg-slate-800/90",
                        "active:scale-95",
                        isActive
                          ? "text-secondary font-bold scale-110"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="bottomNavIndicator"
                          className="absolute -top-1 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-secondary"
                          transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        />
                      )}
                      <span className="drop-shadow-sm">{item.iconMobile || item.icon}</span>
                      <span className={cn(
                        "text-[6px] font-bold uppercase tracking-wider leading-none whitespace-nowrap",
                        isActive ? "text-secondary" : "text-inherit"
                      )}>
                        {item.labelMobile || item.label}
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={() => setNavOpen(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0 ml-1 md:ml-0"
                  title="Cerrar menú"
                  aria-label="Cerrar navegación"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
        ) : (
          <motion.button
            key="nav-closed"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            onClick={() => setNavOpen(true)}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-49 w-10 h-10 rounded-full bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl shadow-[0_4px_20px_rgba(0,0,0,0.10)] border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center hover:scale-110 hover:shadow-[0_4px_24px_rgba(251,191,36,0.20)] active:scale-95 transition-all duration-200"
            title="Abrir menú"
            aria-label="Abrir navegación"
          >
            <ChevronUp size={18} className="text-slate-500 dark:text-slate-400" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
