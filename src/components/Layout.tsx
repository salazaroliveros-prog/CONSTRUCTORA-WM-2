import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Building2, LayoutDashboard, Users, ClipboardList,
  Package, Settings, Truck, Bell, Search, Maximize,
  HelpCircle, BarChart3, TrendingUp, Sparkles, Calendar,
  Activity, X, ChevronUp, Menu, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStore } from '../store/DataStore';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { ALL_MODULES } from '../contexts/SettingsContext';
import { useProjectFilter } from '../contexts/ProjectFilterContext';
import { toast } from 'sonner';
import TopBarClock from './TopBarClock';
import AIFloatingButton from './AIFloatingButton';
import { Sidebar } from './layout/Sidebar';

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
  const [navOpen, setNavOpen] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const { selectedProjectId, setSelectedProjectId, executingProjects, setExecutingProjects } = useProjectFilter();

  const store = useStore();
  useEffect(() => {
    if (!user) return;
    setExecutingProjects(store.projects.items.filter((p: any) => p.status === 'EJECUCION'));
  }, [user, store.projects.items.length]);

  const globalResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    const results: { label: string; sub: string; module: string }[] = [];
    store.projects.items
      .filter(p => p.name?.toLowerCase().includes(q) || p.clientName?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(p => results.push({ label: p.name, sub: `Proyecto · ${p.clientName || ''}`, module: 'projects' }));
    store.clients.items
      .filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(c => results.push({ label: c.name, sub: `Cliente · ${c.email || ''}`, module: 'clients' }));
    return results.slice(0, 8);
  }, [globalSearch, store]);

  useEffect(() => {
    if (!user) return;
    const projects = store.projects.items;
    const today = new Date();
    const delayed = projects.filter(p => p.status === 'EJECUCION' && p.endDate && new Date(p.endDate) < today && (p.progress || 0) < 100);
    setLiveNotifications(prev => [
      ...prev.filter(n => !n.id.startsWith('proj-')),
      ...delayed.slice(0, 3).map(p => ({ id: 'proj-'+p.id, text: 'Proyecto atrasado: '+p.name, type: 'warning', module: 'projects' }))
    ].slice(0, 8));
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
    { id: 'projects',    label: 'Proyectos',           labelMobile: 'Proyectos', icon: <Building2 size={18} />,       iconMobile: <Building2 size={18} />, priority: 1 },
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

  const mobileMenuItems = menuItems
    .filter(item => item.id === 'settings' || item.id === 'ai' || (settings.activeModules?.includes(item.id) ?? true));

  const activeItem = menuItems.find(m => m.id === activeTab);

  return (
    <div
      id="app-root"
      className={cn(
        "flex flex-col h-screen overflow-hidden fixed inset-0 bg-bg",
        settings.typography === 'inter' && 'font-inter',
        settings.typography === 'space' && 'font-space',
        settings.typography === 'mono' && 'font-mono'
      )}
      style={{ '--primary': settings.primaryColor, '--secondary': settings.secondaryColor } as React.CSSProperties}
    >
      {/* ── Topbar ─────────────────────────────────────── */}
      <header className="h-14 sm:h-16 backdrop-blur-md border-b border-border/60 px-2 sm:px-4 flex items-center shrink-0 z-30 bg-white/80">
        {/* Left: menu button (mobile) + branding */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setNavOpen(v => !v)}
            className="lg:hidden w-8 h-8 rounded-lg hover:bg-p-100 text-p-600 flex items-center justify-center transition-all"
            aria-label="Abrir menú"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2.5">
            <img src={settings.companyLogo || '/logo.png'} alt="" className="h-6 sm:h-7 w-auto" />
            <div className="hidden sm:block">
              <span className="text-sm sm:text-base font-black text-primary uppercase tracking-[0.1em] leading-tight block truncate max-w-[200px]">
                {settings.companyName}
              </span>
              <span className="text-[7px] font-semibold text-amber-500 tracking-[0.2em] uppercase leading-none block">
                edificando el futuro
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Right: actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-p-50 border border-p-200 px-3 py-1.5 rounded-lg text-p-500 w-48 relative transition-all focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10">
            <Search size={13} className="shrink-0" />
            <input
              type="text"
              placeholder="Buscar..."
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              onBlur={() => setTimeout(() => setGlobalSearch(''), 200)}
              className="bg-transparent border-none focus:outline-none text-[9px] font-bold w-full uppercase tracking-wider placeholder:text-p-300 text-p-700"
            />
            {globalResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-p-200 rounded-xl shadow-modal z-60 overflow-hidden">
                {globalResults.map((r, i) => (
                  <button key={i} onMouseDown={() => { setActiveTab(r.module); setGlobalSearch(''); }}
                    className="w-full text-left px-3 py-2 hover:bg-p-50 border-b border-p-50 last:border-0 transition-colors text-p-700">
                    <p className="text-[10px] font-black text-primary uppercase truncate">{r.label}</p>
                    <p className="text-[8px] text-p-400 font-bold uppercase">{r.sub}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <TopBarClock />

          {/* Notifications */}
          <div className="relative">
            <button onClick={handleOpenNotifications} className="relative p-2 rounded-lg hover:bg-p-100 text-p-500 hover:text-p-700 transition-all">
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full animate-pulse ring-2 ring-white" />
              )}
            </button>
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 rounded-2xl shadow-modal p-4 z-51 bg-white border border-p-200"
                >
                  <p className="text-[9px] font-black text-p-500 uppercase tracking-widest mb-3">Notificaciones</p>
                  {liveNotifications.length === 0 ? (
                    <p className="text-[11px] text-p-400 text-center py-4">Sin novedades</p>
                  ) : (
                    <div className="space-y-2">
                      {liveNotifications.map(n => (
                        <div key={n.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-p-50 transition-colors">
                          <span className={cn('w-2 h-2 rounded-full mt-1 shrink-0', n.type === 'warning' ? 'bg-amber' : 'bg-blue')} />
                          <div>
                            <p className="text-[10px] font-bold text-p-700">{n.text}</p>
                            <p className="text-[8px] text-p-400 uppercase tracking-wider">{n.module}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Fullscreen */}
          <button onClick={toggleFullScreen} className="hidden sm:flex p-2 rounded-lg hover:bg-p-100 text-p-500 hover:text-p-700 transition-all" title="Pantalla completa">
            <Maximize size={15} />
          </button>

          {/* AI */}
          <div className="relative">
            <button onClick={() => setShowAI(v => !v)} className="p-2 rounded-lg hover:bg-p-100 text-p-500 hover:text-p-700 transition-all" title="Asistente IA">
              {showAI ? <X size={15} /> : <Sparkles size={15} className="text-purple-500" />}
            </button>
            <AIFloatingButton variant="inline" open={showAI} onOpenChange={setShowAI} setActiveTab={setActiveTab} />
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-p-200">
            <div className="hidden sm:block text-right">
              <p className="text-[9px] font-black text-primary uppercase leading-none">{user?.displayName || 'Usuario'}</p>
              <p className="text-[7px] font-bold text-p-500 mt-0.5 tracking-widest uppercase">Admin</p>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden bg-brand flex items-center justify-center text-white text-[10px] font-bold cursor-pointer active:scale-95 transition-transform ring-2 ring-white shadow-sm">
              {user?.photoURL
                ? <img src={user?.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : null}
              <span className="uppercase" hidden={!!user?.photoURL}>{user?.displayName?.charAt(0) || 'U'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Body: Sidebar + Content ───────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex shrink-0">
          <Sidebar
            isCollapsed={sidebarCollapsed}
            activeTab={activeTab}
            onNavigate={setActiveTab}
            onToggleCollapse={() => setSidebarCollapsed(v => !v)}
          />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth px-3 sm:px-5 md:px-6 py-4 sm:py-5">
          <div className="w-full max-w-450 mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Nav ─────────────────────────── */}
      <AnimatePresence mode="wait">
        {navOpen ? (
          <motion.div
            key="nav-open"
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-49 flex justify-center"
          >
            <div className="flex items-stretch overflow-x-auto gap-0.5 px-1.5 py-1.5 bg-white/80 backdrop-blur-2xl shadow-[0_-2px_20px_rgba(0,0,0,0.08)] border-t border-border/60 w-full">
              {mobileMenuItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setNavOpen(false); }}
                    title={item.label}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] shrink-0 py-1.5 rounded-xl transition-all duration-200",
                      "hover:bg-p-100 active:scale-90",
                      isActive ? "text-amber-600 font-bold" : "text-p-500 hover:text-p-700"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="bottomNavIndicator"
                        className="absolute -top-1 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-accent"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="drop-shadow-sm">{item.iconMobile || item.icon}</span>
                    <span className={cn("text-[6px] font-bold uppercase tracking-wider leading-none", isActive ? "text-amber-600" : "text-inherit")}>
                      {item.labelMobile || item.label}
                    </span>
                  </button>
                );
              })}
              <button onClick={() => setNavOpen(false)} className="flex items-center justify-center w-8 h-8 rounded-lg text-p-400 hover:text-p-600 hover:bg-p-100 transition-all shrink-0 ml-1">
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
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-49 lg:hidden w-10 h-10 rounded-full bg-white/80 backdrop-blur-2xl shadow-elevated border border-border/60 flex items-center justify-center hover:scale-110 hover:shadow-glow-sm active:scale-95 transition-all duration-200"
            aria-label="Abrir navegación"
          >
            <ChevronUp size={18} className="text-p-500" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
