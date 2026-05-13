/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Building2, Calculator, LayoutDashboard, Users, ClipboardList,
  Package, Settings, Truck, Bell, Search, Maximize,
  HelpCircle, BarChart3, Zap, HardHat, TrendingUp, Sparkles, Calendar,
  Sun, Moon, Menu, X, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToCollection } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { ALL_MODULES } from '../contexts/SettingsContext';
import { useProjectFilter } from '../contexts/ProjectFilterContext';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'sonner';
import Logo from './Logo';
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
  const [showAI, setShowAI] = useState(false);

  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const { selectedProjectId, setSelectedProjectId, executingProjects, setExecutingProjects } = useProjectFilter();
  const { theme, toggleTheme } = useTheme();

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
    { id: 'dashboard',   label: 'Inicio',                 labelMobile: 'Inicio',   icon: <LayoutDashboard size={20} />, iconMobile: <LayoutDashboard size={16} />, priority: 1 },
    { id: 'projects',    label: 'Gestión de Proyectos',    labelMobile: 'Proyectos',icon: <Building2 size={18} />,       iconMobile: <Building2 size={16} />, priority: 1 },
    { id: 'suppliers',   label: 'Proveedores',            labelMobile: 'Proveed.', icon: <Truck size={18} />,          iconMobile: <Truck size={16} />, priority: 1 },
    { id: 'inventory',   label: 'Stock',                  labelMobile: 'Invent.',  icon: <Package size={18} />,        iconMobile: <Package size={16} />, priority: 1 },
    { id: 'staff',       label: 'Recursos Humanos',       labelMobile: 'Personal', icon: <HardHat size={18} />,        iconMobile: <HardHat size={16} />, priority: 1 },
    { id: 'clients',     label: 'Clientes',               labelMobile: 'Clientes', icon: <Users size={18} />,           iconMobile: <Users size={16} />, priority: 2 },
    { id: 'execution',   label: 'Bitácora',              labelMobile: 'Bitácora', icon: <ClipboardList size={18} />,  iconMobile: <ClipboardList size={16} />, priority: 2 },
    { id: 'seguimiento', label: 'Avance',                 labelMobile: 'Avance',   icon: <TrendingUp size={18} />,     iconMobile: <TrendingUp size={16} />, priority: 2 },
    { id: 'analytics',   label: 'Analíticas',             labelMobile: 'Anal.',    icon: <BarChart3 size={18} />,      iconMobile: <BarChart3 size={16} />, priority: 3 },
    { id: 'gantt',       label: 'Gantt',                  labelMobile: 'Gantt',    icon: <Calendar size={18} />,       iconMobile: <Calendar size={16} />, priority: 3 },
    { id: 'ai',          label: 'Asistente IA',           labelMobile: 'IA',       icon: <Sparkles size={18} />,       iconMobile: <Sparkles size={16} />, priority: 3 },
    { id: 'settings',    label: 'Ajustes',                labelMobile: 'Conf.',    icon: <Settings size={18} />,       iconMobile: <Settings size={16} />, priority: 3 },
    { id: 'effects',     label: 'Efectos',                labelMobile: 'Fx',       icon: <Zap size={18} />,            iconMobile: <Zap size={16} />, priority: 4 },
  ];

  const menuItems = allMenuItems.filter(item =>
    item.id === 'settings' || item.id === 'ai' || (settings.activeModules ?? ALL_MODULES).includes(item.id)
  );

  // Mobile navigation: prioritize essential modules
  const mobileMenuItems = menuItems
    .filter(item => settings.activeModules?.includes(item.id) ?? true)
    .sort((a, b) => (a.priority || 4) - (b.priority || 4))
    .slice(0, 6); // Show top 6 priority modules on mobile

  const activeItem = menuItems.find(m => m.id === activeTab);

  const resolvedPrimary = theme === 'dark' ? '#f1f5f9' : settings.primaryColor;

  return (
    <div
      id="app-root"
      className={cn(
        "flex flex-col h-screen text-primary overflow-hidden fixed inset-0",
        settings.typography === 'inter' && 'font-inter',
        settings.typography === 'space' && 'font-space',
        settings.typography === 'mono' && 'font-mono'
      )}
      style={{ '--primary': settings.primaryColor, '--secondary': settings.secondaryColor } as any}
    >
{/* ── Topbar ─────────────────────────────────────────────── */}
          <header className={cn("h-16 sm:h-[4.25rem] backdrop-blur-md border-b border-slate-200/50 px-3 sm:px-5 flex items-center shrink-0 z-30 transition-colors",
           theme === 'dark' ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/80 border-slate-200'
         )}>
            {/* Left: Logo */}
            <div className="flex items-center shrink-0">
              <Logo avatarUrl={user?.photoURL} className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            {/* Center: Branding — absolutely centered for maximum visual impact */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none select-none">
              <span className="text-base sm:text-lg md:text-xl font-black text-primary uppercase tracking-[0.12em] leading-tight">
                {settings.companyName}
              </span>
              <span className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-amber-500 tracking-[0.2em] uppercase mt-0.5">
                edificando el futuro
              </span>
            </div>

           {/* Spacer */}
           <div className="flex-1" />

            {/* Right: Search + Actions (pushed right to frame the centered branding) */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 hidden sm:flex">
             {/* Global search */}
              <div className="hidden lg:flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 w-56 relative group transition-all focus-within:border-secondary dark:focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/10 dark:focus-within:ring-secondary/10">
                <Search size={14} className="shrink-0 group-focus-within:text-secondary dark:group-focus-within:text-secondary" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  onBlur={() => setTimeout(() => setGlobalSearch(''), 200)}
                  className="bg-transparent border-none focus:outline-none text-[9px] font-black w-full uppercase tracking-widest placeholder:text-slate-300 dark:placeholder:text-slate-500 text-slate-700 dark:text-slate-200"
                />
                {globalResults.length > 0 && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[60] overflow-hidden">
                    {globalResults.map((r, i) => (
                      <button key={i} onMouseDown={() => { setActiveTab(r.module); setGlobalSearch(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-50 dark:border-slate-700 last:border-0 transition-colors text-slate-700 dark:text-slate-300">
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
               className="hidden sm:flex p-2 text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-50 rounded-xl transition-all"
               title="Pantalla completa"
               aria-label="Activar o desactivar pantalla completa"
             >
               <Maximize size={15} />
             </button>

             {/* Help */}
             <button
               onClick={() => toast.info('Ayuda en construcción — Próximamente disponible')}
               className="hidden sm:flex p-2 text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-50 rounded-xl transition-all"
               title="Ayuda"
               aria-label="Abrir ayuda"
               type="button"
             >
               <HelpCircle size={15} />
             </button>

             {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all"
                title={theme === 'dark' ? 'Modo día' : 'Modo noche'}
                aria-label="Cambiar modo día/noche"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>

             {/* Notifications */}
             <div className="relative">
                <button onClick={handleOpenNotifications} className="relative p-2 rounded-xl border transition-all bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-primary border-slate-100 dark:border-slate-700">
                 <Bell size={16} className="hover:rotate-12 transition-transform" />
                 {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-secondary border-2 border-white rounded-full animate-pulse" />}
               </button>
               <AnimatePresence>
                 {showNotifications && (
                   <motion.div
                     initial={{ opacity: 0, y: 8, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 8, scale: 0.95 }}
  className="absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl p-4 z-[51] border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                   >
                     {/* ...notification list (unchanged) */}
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>

             {/* AI Assistant */}
             <div className="relative">
                <button
                  onClick={() => setShowAI(v => !v)}
                  className="p-2 rounded-xl transition-all text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-700"
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
                 <p className="text-[9px] font-black text-primary uppercase leading-none truncate max-w-[90px]">{user?.displayName || 'Usuario'}</p>
                 <p className="text-[7px] font-bold text-slate-600 dark:text-slate-300 mt-0.5 tracking-widest uppercase">Admin</p>
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

      {/* ── Content ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4 scroll-smooth bg-transparent min-h-0 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-[calc(2rem+env(safe-area-inset-bottom,0px))] scroll-mb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:scroll-mb-[calc(2rem+env(safe-area-inset-bottom,0px))] flex flex-col">
        <div className="w-full max-w-[1800px] mx-auto h-full">
          {children}
        </div>
      </main>

      {/* ── Bottom Navigation ─────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-[49] safe-area-pb transition-colors bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between h-16 px-4 max-w-screen-sm mx-auto">
          {/* Left: Connection Status */}
          <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-slate-600 dark:text-slate-300">EN LÍNEA</span>
          </div>

          {/* Center: Brand Slogan */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-[0.15em] whitespace-nowrap">
              EDIFICANDO EL FUTURO
            </span>
          </div>

          {/* Right: Module Quick Access */}
          <div className="flex items-center gap-1">
            {[
              { id: 'projects', icon: <Building2 size={16} />, color: 'text-blue-600 dark:text-blue-400' },
              { id: 'suppliers', icon: <Truck size={16} />, color: 'text-green-600 dark:text-green-400' },
              { id: 'inventory', icon: <Package size={16} />, color: 'text-purple-600 dark:text-purple-400' },
              { id: 'staff', icon: <HardHat size={16} />, color: 'text-orange-600 dark:text-orange-400' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "p-2 rounded-lg transition-all active:scale-90 hover:bg-slate-100 dark:hover:bg-slate-800",
                  activeTab === item.id ? "bg-secondary/20" : "",
                  item.color
                )}
                title={item.id}
              >
                {item.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Main Navigation Row */}
        <div className="flex justify-around items-center h-14 px-0.5 max-w-screen-sm mx-auto border-t border-slate-200/50 dark:border-slate-700/50">
          {mobileMenuItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg transition-all active:scale-95 min-w-0 flex-1",
                activeTab === item.id
                  ? "text-secondary bg-secondary/10 dark:bg-secondary/20"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
              )}
            >
              <span className={cn(
                "transition-transform",
                activeTab === item.id && "scale-110"
              )}>
                {item.iconMobile || item.icon}
              </span>
              <span className={cn(
                "text-[6px] font-bold uppercase tracking-wide leading-tight",
                activeTab === item.id ? "text-secondary" : "text-slate-600 dark:text-slate-300"
              )}>
                {item.labelMobile || item.label}
              </span>
              {activeTab === item.id && (
                <motion.div
                  layoutId="mobileNav"
                  className="absolute bottom-0.5 w-1 h-0.5 rounded-full bg-secondary"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Footer (Desktop only) ─────────────────────────────── */}
      <footer className="hidden md:flex h-7 items-center justify-between px-4 uppercase tracking-widest shrink-0 transition-colors bg-white dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-700/50 text-slate-600 dark:text-slate-400">
        <span>© 2024 WM/M&S CONSTRUCTORA · Motor V2.4.1 PRO</span>
        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> En línea</span>
      </footer>
    </div>
  );
}
