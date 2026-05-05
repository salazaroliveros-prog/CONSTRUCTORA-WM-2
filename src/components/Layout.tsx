/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Building2, Calculator, LayoutDashboard, Users, ClipboardList,
  Package, Settings, Truck, Menu, X, Bell, Search, Maximize,
  HelpCircle, LogOut, BarChart3, Zap, HardHat, TrendingUp, Sun, Moon, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToCollection } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { ALL_MODULES } from '../contexts/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { useProjectFilter } from '../contexts/ProjectFilterContext';
import Logo from './Logo';
import TopBarClock from './TopBarClock';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const NOTIFICATION_STORAGE_KEY = 'wm_read_notifications';

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [liveNotifications, setLiveNotifications] = useState<{ id: string; text: string; type: string; module: string }[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalResults, setGlobalResults] = useState<{ label: string; sub: string; module: string }[]>([]);
  const [allData, setAllData] = useState<{ projects: any[]; clients: any[]; inventory: any[] }>({ projects: [], clients: [], inventory: [] });
  const menuRef = useRef<HTMLDivElement>(null);

  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const { selectedProjectId, setSelectedProjectId, executingProjects, setExecutingProjects } = useProjectFilter();

  // Load data for global search + project filter
  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToCollection('projects', (d: any[]) => {
      setAllData(p => ({ ...p, projects: d }));
      setExecutingProjects(d.filter((p: any) => p.status === 'EJECUCION'));
    });
    const u2 = subscribeToCollection('clients', (d: any[]) => setAllData(p => ({ ...p, clients: d })));
    const u3 = subscribeToCollection('inventory', (d: any[]) => setAllData(p => ({ ...p, inventory: d })));
    return () => { u1(); u2(); u3(); };
  }, [user]);

  // Global search
  useEffect(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) { setGlobalResults([]); return; }
    const results: { label: string; sub: string; module: string }[] = [];
    allData.projects.filter(p => p.name?.toLowerCase().includes(q) || p.clientName?.toLowerCase().includes(q))
      .slice(0, 3).forEach(p => results.push({ label: p.name, sub: `Proyecto · ${p.clientName || ''}`, module: 'projects' }));
    allData.clients.filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      .slice(0, 3).forEach(c => results.push({ label: c.name, sub: `Cliente · ${c.email || ''}`, module: 'clients' }));
    allData.inventory.filter(i => i.name?.toLowerCase().includes(q))
      .slice(0, 3).forEach(i => results.push({ label: i.name, sub: `Inventario · ${i.stock} ${i.unit || ''}`, module: 'inventory' }));
    setGlobalResults(results.slice(0, 8));
  }, [globalSearch, allData]);

  // Live notifications
  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToCollection('inventory', (items: any[]) => {
      const critical = items.filter(i => (i.stock || 0) <= (i.minStock || 0));
      setLiveNotifications(prev => [
        ...critical.slice(0, 3).map(i => ({ id: `inv-${i.id}`, text: `Stock crítico: ${i.name} (${i.stock} ${i.unit || 'un'})`, type: 'error', module: 'inventory' })),
        ...prev.filter(n => !n.id.startsWith('inv-'))
      ].slice(0, 8));
    });
    const u2 = subscribeToCollection('projects', (projects: any[]) => {
      const today = new Date();
      const delayed = projects.filter(p => p.status === 'EJECUCION' && p.endDate && new Date(p.endDate) < today && (p.progress || 0) < 100);
      setLiveNotifications(prev => [
        ...prev.filter(n => !n.id.startsWith('proj-')),
        ...delayed.slice(0, 3).map(p => ({ id: `proj-${p.id}`, text: `Proyecto atrasado: ${p.name}`, type: 'warning', module: 'projects' }))
      ].slice(0, 8));
    });
    return () => { u1(); u2(); };
  }, [user]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const unreadCount = liveNotifications.filter(n => !readIds.includes(n.id)).length;

  const handleOpenNotifications = () => {
    const allIds = liveNotifications.map(n => n.id);
    setReadIds(allIds);
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(allIds));
    setShowNotifications(v => !v);
  };

  const handleNav = (id: string) => {
    setActiveTab(id);
    setMenuOpen(false);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen?.();
  };

  const allMenuItems = [
    { id: 'dashboard',   label: 'Dashboard',              icon: <LayoutDashboard size={18} /> },
    { id: 'clients',     label: 'Clientes',               icon: <Users size={18} /> },
    { id: 'projects',    label: 'Proyectos',              icon: <Building2 size={18} /> },
    { id: 'calculator',  label: 'Presupuestos',           icon: <Calculator size={18} /> },
    { id: 'execution',   label: 'Seguimiento y Bitácora', icon: <ClipboardList size={18} /> },
    { id: 'seguimiento', label: 'Avance de Proyectos',    icon: <TrendingUp size={18} /> },
    { id: 'suppliers',   label: 'Proveedores',            icon: <Truck size={18} /> },
    { id: 'inventory',   label: 'Stock o Bodega',         icon: <Package size={18} /> },
    { id: 'analytics',   label: 'Analíticas',             icon: <BarChart3 size={18} /> },
    { id: 'staff',       label: 'Recursos Humanos',       icon: <HardHat size={18} /> },
    { id: 'settings',    label: 'Ajustes Visuales',       icon: <Settings size={18} /> },
    { id: 'seed',        label: 'Datos de Prueba',        icon: <Zap size={18} /> },
    { id: 'clean',       label: 'Limpiar Datos',          icon: <X size={18} /> },
  ];

  const menuItems = allMenuItems.filter(item =>
    item.id === 'settings' || item.id === 'seed' || item.id === 'clean' || (settings.activeModules ?? ALL_MODULES).includes(item.id)
  );

  const activeItem = menuItems.find(m => m.id === activeTab);

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
      <header className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-200 px-3 sm:px-5 flex items-center gap-2 z-30 shrink-0">

        {/* Menu trigger + active module label */}
        <div className="flex items-center gap-2 shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-700 transition-all active:scale-95"
            title="Menú"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Active module chip */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-600 hover:border-secondary transition-all"
          >
            {activeItem?.icon}
            <span className="max-w-[120px] truncate">{activeItem?.label || 'Dashboard'}</span>
            <ChevronDown size={10} className={cn("transition-transform", menuOpen && "rotate-180")} />
          </button>

          {/* Floating menu overlay */}
          <AnimatePresence>
            {menuOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="fixed inset-0 z-40"
                  style={{ background: 'rgba(15,23,42,0.15)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
                  onClick={() => setMenuOpen(false)}
                />
                {/* Menu panel */}
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.95, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, scale: 0.96, filter: 'blur(6px)' }}
                  transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="absolute top-12 left-0 z-50 w-64 rounded-2xl p-2 overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.72)',
                    backdropFilter: 'blur(24px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    border: '1px solid rgba(255,255,255,0.55)',
                    boxShadow: '0 20px 60px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.8)'
                  }}
                >
                  {/* Logo */}
                  <div className="px-3 py-2 mb-1 border-b border-white/50">
                    <Logo avatarUrl={user?.photoURL} />
                  </div>
                  <nav className="space-y-0.5 py-1 max-h-[70vh] overflow-y-auto">
                    {menuItems.map((item, i) => (
                      <motion.button
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.18 }}
                        onClick={() => handleNav(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-all duration-200",
                          activeTab === item.id
                            ? "bg-secondary text-primary shadow-lg scale-[1.02] font-black"
                            : "text-slate-500 hover:bg-secondary/20 hover:text-slate-900 hover:scale-[1.03] hover:text-[11px] hover:font-black hover:shadow-sm"
                        )}
                      >
                        <span className={cn("shrink-0", activeTab === item.id ? "text-primary" : "")}>{item.icon}</span>
                        {item.label}
                        {activeTab === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                      </motion.button>
                    ))}
                  </nav>
                  <div className="border-t border-white/40 pt-1 mt-1">
                    <button
                      onClick={() => { signOut(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all"
                    >
                      <LogOut size={16} /> Salir del Sistema
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Global search */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-400 w-52 relative group transition-all focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/10">
          <Search size={14} className="shrink-0 group-focus-within:text-secondary" />
          <input
            type="text"
            placeholder="Buscar..."
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            onBlur={() => setTimeout(() => setGlobalSearch(''), 200)}
            className="bg-transparent border-none focus:outline-none text-[9px] font-black w-full uppercase tracking-widest placeholder:text-slate-300"
          />
          {globalResults.length > 0 && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
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

        {/* Company name — center */}
        <div className="hidden md:flex flex-col items-center flex-1 min-w-0">
          <h1 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] leading-tight truncate">{settings.companyName}</h1>
          <p className="text-[7px] font-bold text-secondary uppercase tracking-[0.2em]">EDIFICANDO EL FUTURO</p>
        </div>

        {/* Project filter selector */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Proyecto:</span>
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-[9px] font-black uppercase focus:outline-none focus:border-secondary shadow-sm max-w-[160px] cursor-pointer"
          >
            <option value="ALL">TODOS</option>
            {executingProjects.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name?.slice(0, 20)}</option>
            ))}
          </select>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto md:ml-0">
          <button onClick={toggleFullScreen} className="hidden sm:flex p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-xl transition-all">
            <Maximize size={15} />
          </button>
          <button className="hidden sm:flex p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-xl transition-all">
            <HelpCircle size={15} />
          </button>

          <TopBarClock />

          <button onClick={toggleTheme} className="p-2 bg-slate-50 text-slate-500 hover:text-primary rounded-xl border border-slate-100 transition-all">
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button onClick={handleOpenNotifications} className="relative p-2 bg-slate-50 text-slate-500 hover:text-primary rounded-xl border border-slate-100 transition-all">
              <Bell size={16} className="hover:rotate-12 transition-transform" />
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-secondary border-2 border-white rounded-full animate-pulse" />}
            </button>
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-50"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Notificaciones</span>
                    <span className="text-[8px] font-bold text-slate-300 uppercase">Todo leído</span>
                  </div>
                  <div className="space-y-3">
                    {liveNotifications.length === 0 ? (
                      <p className="text-[9px] text-slate-400 uppercase tracking-widest text-center py-3">Sin alertas activas</p>
                    ) : liveNotifications.map(n => (
                      <div key={n.id} onClick={() => { setActiveTab(n.module); setShowNotifications(false); }}
                        className="flex gap-3 cursor-pointer p-1.5 -m-1.5 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className={cn("w-1 rounded-full shrink-0", n.type === 'error' ? "bg-red-500" : n.type === 'warning' ? "bg-amber-500" : "bg-blue-500")} />
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-primary leading-tight line-clamp-2">{n.text}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest">Toca para ir al módulo</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
            <div className="hidden sm:block text-right">
              <p className="text-[9px] font-black text-primary uppercase leading-none truncate max-w-[90px]">{user?.displayName || 'Usuario'}</p>
              <p className="text-[7px] font-bold text-slate-400 mt-0.5 tracking-widest uppercase">Admin</p>
            </div>
            <div className="w-8 h-8 rounded-xl shadow-lg border-2 border-white ring-1 ring-slate-200 overflow-hidden bg-slate-900 flex items-center justify-center text-white text-[10px] font-bold cursor-pointer active:scale-95 transition-transform">
              {user?.photoURL
                ? <img src={user.photoURL} alt="Foto de perfil" className="w-full h-full object-cover" referrerPolicy="no-referrer"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden'); }}
                  />
                : null}
              <span className="uppercase" hidden={!!user?.photoURL}>{user?.displayName?.charAt(0) || 'U'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-3 py-3 md:px-4 md:py-3 scroll-smooth bg-transparent min-h-0">
        <div className="w-full max-w-[1800px] mx-auto h-full">
          {children}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="h-7 bg-white text-slate-400 text-[7px] font-bold flex items-center justify-between px-4 border-t border-slate-100 uppercase tracking-widest shrink-0">
        <span>© 2024 WM/M&S CONSTRUCTORA · Motor V2.4.1 PRO</span>
        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> En línea</span>
      </footer>
    </div>
  );
}
