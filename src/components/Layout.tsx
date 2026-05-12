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
    { id: 'dashboard',   label: 'Dashboard',              icon: <LayoutDashboard size={20} /> },
    { id: 'clients',     label: 'Clientes',               icon: <Users size={20} /> },
    { id: 'projects',    label: 'Proyectos',              icon: <Building2 size={20} /> },
    { id: 'calculator',  label: 'Presupuestos',           icon: <Calculator size={20} /> },
    { id: 'execution',   label: 'Seguimiento',            icon: <ClipboardList size={20} /> },
    { id: 'seguimiento', label: 'Avance',                 icon: <TrendingUp size={20} /> },
    { id: 'gantt',       label: 'Gantt',                  icon: <Calendar size={20} /> },
    { id: 'suppliers',   label: 'Proveedores',            icon: <Truck size={20} /> },
    { id: 'inventory',   label: 'Stock',                  icon: <Package size={20} /> },
    { id: 'analytics',   label: 'Analíticas',             icon: <BarChart3 size={20} /> },
    { id: 'staff',       label: 'Recursos',               icon: <HardHat size={20} /> },
    { id: 'ai',          label: 'Asistente IA',           icon: <Sparkles size={20} /> },
    { id: 'effects',     label: 'Efectos',                icon: <Zap size={20} /> },
    { id: 'settings',    label: 'Ajustes',                icon: <Settings size={20} /> },
  ];

  const menuItems = allMenuItems.filter(item =>
    item.id === 'settings' || item.id === 'ai' || (settings.activeModules ?? ALL_MODULES).includes(item.id)
  );

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
        <header className={cn("h-14 backdrop-blur-md border-b border-slate-200/50 px-3 sm:px-5 flex items-center gap-2 z-30 shrink-0 transition-colors",
          theme === 'dark' ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/80 border-slate-200'
        )}>
          {/* Left: Company logo + name */}
          <div className="flex items-center gap-2">
            <Logo avatarUrl={user?.photoURL} className="w-8 h-8" />
            <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em] leading-tight truncate max-w-[150px] sm:max-w-[200px]">{settings.companyName}</span>
          </div>

          {/* Center: Global search (lg only) */}
          <div className={cn("hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700 w-64 relative group transition-all focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/10",
            theme === 'dark' && 'dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300'
          )}>
            <Search size={14} className={cn("shrink-0 group-focus-within:text-secondary", theme === 'dark' && 'dark:text-slate-400')} />
            <input
              type="text"
              placeholder="Buscar..."
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              onBlur={() => setTimeout(() => setGlobalSearch(''), 200)}
              className={cn("bg-transparent border-none focus:outline-none text-[9px] font-black w-full uppercase tracking-widest placeholder:text-slate-300",
                theme === 'dark' && 'placeholder:text-slate-500 text-slate-200'
              )}
            />
            {globalResults.length > 0 && (
              <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-[60] overflow-hidden">
                {globalResults.map((r, i) => (
                  <button key={i} onMouseDown={() => { setActiveTab(r.module); setGlobalSearch(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
                    <p className="text-[10px] font-black text-primary uppercase truncate">{r.label}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{r.sub}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Spacer to push right‑aligned actions */}
          <div className="flex-1" />

          {/* Right: Actions (theme, help, fullscreen, notifications, AI, avatar) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto md:ml-0">
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
              className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-xl transition-all"
              title={theme === 'dark' ? 'Modo día' : 'Modo noche'}
              aria-label="Cambiar modo día/noche"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button onClick={handleOpenNotifications} className={cn(
                "relative p-2 rounded-xl border transition-all",
                theme === 'dark'
                  ? 'bg-slate-800 text-slate-300 hover:text-primary border-slate-700'
                  : 'bg-slate-50 text-slate-700 hover:text-primary border-slate-100'
              )}>
                <Bell size={16} className="hover:rotate-12 transition-transform" />
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-secondary border-2 border-white rounded-full animate-pulse" />}
              </button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
className={cn(
                       "absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl p-4 z-[51] border",
                      theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                    )}
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
                className={cn("p-2 rounded-xl transition-all",
                  theme === 'dark'
                    ? 'text-slate-400 hover:text-primary hover:bg-slate-700'
                    : 'text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-50'
                )}
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
      <main className="flex-1 overflow-y-auto px-2 py-2 md:px-3 md:py-2 scroll-smooth bg-transparent min-h-0 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-[calc(2rem+env(safe-area-inset-bottom,0px))] scroll-mb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:scroll-mb-[calc(2rem+env(safe-area-inset-bottom,0px))] flex flex-col">
        <div className="w-full max-w-[1800px] mx-auto h-full">
          {children}
        </div>
      </main>

      {/* ── Bottom Navigation ─────────────────────────────────── */}
      <nav className={cn("fixed bottom-0 left-0 right-0 z-[49] safe-area-pb transition-colors",
        theme === 'dark'
          ? 'bg-slate-900/95 border-t border-slate-700'
          : 'bg-white/95 backdrop-blur-xl border-t border-slate-200'
      )}>
        <div className="flex justify-around items-center h-16 px-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-xl transition-all active:scale-95",
                activeTab === item.id
                  ? "text-secondary bg-secondary/10"
                  : theme === 'dark'
                    ? "text-slate-300 hover:text-slate-100"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              )}
            >
              <span className={cn(
                "transition-transform",
                activeTab === item.id && "scale-110"
              )}>
                {item.icon}
              </span>
              <span className={cn(
                "text-[8px] font-black uppercase tracking-wide",
                activeTab === item.id ? "text-secondary" : "text-slate-600 dark:text-slate-300"
              )}>
                {item.label}
              </span>
              {activeTab === item.id && (
                <motion.div
                  layoutId="mobileNav"
                  className="absolute bottom-1 w-1 h-1 rounded-full bg-secondary"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Footer (Desktop only) ─────────────────────────────── */}
      <footer className={cn("hidden md:flex h-7 items-center justify-between px-4 uppercase tracking-widest shrink-0 transition-colors",
        theme === 'dark'
          ? 'bg-slate-900/80 border-t border-slate-700/50 text-slate-400'
          : 'bg-white text-slate-600 dark:text-slate-300 border-t border-slate-100'
      )}>
        <span>© 2024 WM/M&S CONSTRUCTORA · Motor V2.4.1 PRO</span>
        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> En línea</span>
      </footer>
    </div>
  );
}
