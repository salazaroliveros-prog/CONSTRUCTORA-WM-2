/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Calculator, 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  Package, 
  Settings,
  Truck,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Plus,
  Bell,
  Search,
  Maximize,
  HelpCircle,
  Command,
  LogOut,
  BarChart3,
  ShieldCheck,
  Zap,
  HardHat
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import Logo from './Logo';
import TopBarClock from './TopBarClock';
import { Sun, Moon } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GlobalStyles = () => (
  <style>{`
    /* Tighten up mobile experience */
    @media (max-width: 640px) {
      input, select, textarea {
        font-size: 16px !important; /* Prevent iOS zoom on focus */
      }
    }
    
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `}</style>
);

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  isCollapsed: boolean;
  [key: string]: any;
}

const SidebarItem = ({ icon, label, active, onClick, isCollapsed }: SidebarItemProps) => (
  <button
    id={`nav-item-${label.toLowerCase()}`}
    onClick={onClick}
    title={isCollapsed ? label : undefined}
    className={cn(
      "w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all relative group",
      active 
        ? "bg-slate-900 text-white shadow-xl shadow-slate-900/20" 
        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
    )}
  >
    <div className={cn("flex-shrink-0 transition-transform duration-300", active ? "scale-110 text-secondary" : "group-hover:scale-110")}>{icon}</div>
    {!isCollapsed && (
      <span className="font-black text-[10px] uppercase tracking-widest whitespace-nowrap overflow-hidden">{label}</span>
    )}
    {active && !isCollapsed && (
      <motion.div 
        layoutId="active-indicator"
        className="absolute right-3 w-1.5 h-1.5 rounded-full bg-secondary"
      />
    )}
  </button>
);

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const NOTIFICATION_STORAGE_KEY = 'wm_read_notifications';

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [liveNotifications, setLiveNotifications] = useState<{id:string,text:string,type:string,module:string}[]>([]);
  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const { theme, toggleTheme } = useTheme();

  // Generar notificaciones reales desde Firestore
  useEffect(() => {
    if (!user) return;
    const unsubInv = (window as any).__notifUnsubInv;
    const unsubProj = (window as any).__notifUnsubProj;
    if (unsubInv) unsubInv();
    if (unsubProj) unsubProj();

    const { subscribeToCollection: sub } = require('../services/firestoreService');

    const u1 = sub('inventory', (items: any[]) => {
      const critical = items.filter(i => (i.stock || 0) <= (i.minStock || 0));
      setLiveNotifications(prev => {
        const filtered = prev.filter(n => !n.id.startsWith('inv-'));
        const newOnes = critical.slice(0, 3).map(i => ({
          id: `inv-${i.id}`,
          text: `Stock critico: ${i.name} (${i.stock} ${i.unit || 'un'})`,
          type: 'error',
          module: 'inventory'
        }));
        return [...newOnes, ...filtered].slice(0, 8);
      });
    });

    const u2 = sub('projects', (projects: any[]) => {
      const today = new Date();
      const delayed = projects.filter(p => {
        if (p.status !== 'EJECUCION' || !p.endDate) return false;
        return new Date(p.endDate) < today && (p.progress || 0) < 100;
      });
      setLiveNotifications(prev => {
        const filtered = prev.filter(n => !n.id.startsWith('proj-'));
        const newOnes = delayed.slice(0, 3).map(p => ({
          id: `proj-${p.id}`,
          text: `Proyecto atrasado: ${p.name}`,
          type: 'warning',
          module: 'projects'
        }));
        return [...filtered, ...newOnes].slice(0, 8);
      });
    });

    (window as any).__notifUnsubInv = u1;
    (window as any).__notifUnsubProj = u2;
    return () => { u1(); u2(); };
  }, [user]);

  const unreadCount = liveNotifications.filter(n => !readIds.includes(n.id)).length;

  const handleOpenNotifications = () => {
    const allIds = liveNotifications.map(n => n.id);
    setReadIds(allIds);
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(allIds));
    setShowNotifications(!showNotifications);
  };

  const handleNotificationClick = (module: string) => {
    setActiveTab(module);
    setShowNotifications(false);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleSidebarItemClick = (id: string) => {
    setActiveTab(id);
    setIsMobileMenuOpen(false);
  };

  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'clients', label: 'Clientes', icon: <Users size={20} /> },
    { id: 'projects', label: 'Proyectos', icon: <Building2 size={20} /> },
    { id: 'calculator', label: 'Presupuestos', icon: <Calculator size={20} /> },
    { id: 'execution', label: 'Seguimiento y Bitácora', icon: <ClipboardList size={20} /> },
    { id: 'suppliers', label: 'Proveedores', icon: <Truck size={20} /> },
    { id: 'inventory', label: 'Stock o Bodega', icon: <Package size={20} /> },
    { id: 'analytics', label: 'Analíticas', icon: <BarChart3 size={20} /> },
    { id: 'staff', label: 'Recursos Humanos', icon: <HardHat size={20} /> },
    { id: 'settings', label: 'Ajustes Visuales', icon: <Settings size={20} /> },
  ];

  const menuItems = allMenuItems.filter(item =>
    item.id === 'settings' || settings.activeModules.includes(item.id)
  );

  return (
    <div 
      id="app-root" 
      className={cn(
        "flex h-screen bg-[#F8FAFC] text-primary overflow-hidden fixed inset-0",
        settings.typography === 'inter' && 'font-inter',
        settings.typography === 'space' && 'font-space',
        settings.typography === 'mono' && 'font-mono'
      )}
      style={{ 
        '--primary': settings.primaryColor,
        '--secondary': settings.secondaryColor 
      } as any}
    >
      {/* Sidebar - Desktop */}
      <motion.aside
        id="desktop-sidebar"
        initial={false}
        animate={{ width: isCollapsed ? 70 : 260 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="hidden md:flex flex-col bg-white border-r border-slate-200 z-30"
      >
        <div className="p-4 h-20 flex items-center justify-between overflow-hidden border-b border-slate-100">
          {isCollapsed ? (
            <div className="w-full flex justify-center">
              <div className="w-10 h-10 relative">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt="Avatar de usuario" 
                    className="w-full h-full rounded-xl object-cover shadow-lg border-2 border-slate-900 p-0.5 bg-white"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-900 rounded-xl flex items-center justify-center text-secondary shadow-lg">
                    <Building2 size={20} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Logo avatarUrl={user?.photoURL} />
          )}
        </div>

        <nav id="sidebar-nav" className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.id}
              onClick={() => handleSidebarItemClick(item.id)}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-slate-50 space-y-3">
           {!isCollapsed && (
             <button 
               onClick={signOut}
               className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-red-50 text-red-500 hover:bg-red-50 transition-all text-[8px] font-black uppercase tracking-widest mb-1"
             >
               <LogOut size={14} /> Salir del Sistema
             </button>
           )}
           <button 
             onClick={() => setIsCollapsed(!isCollapsed)}
             className="w-full flex items-center justify-center p-2.5 rounded-xl border border-slate-100 text-slate-400 hover:text-primary hover:border-slate-300 transition-all bg-slate-50/50"
           >
             {isCollapsed ? <ChevronRight size={16} /> : (
               <div className="flex items-center gap-3">
                 <Command size={12} />
                 <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Colapsar</span>
               </div>
             )}
           </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main id="main-canvas" className="flex-1 flex flex-col min-w-0 relative">
        {/* Top Header */}
        <header id="main-header" className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              id="mobile-trigger"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2.5 bg-slate-900 text-white rounded-xl"
            >
              <Menu size={18} />
            </button>
            <div className="hidden lg:flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-slate-400 w-64 relative group transition-all focus-within:border-secondary focus-within:ring-4 focus-within:ring-secondary/10">
              <Search size={16} className="group-focus-within:text-secondary" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="bg-transparent border-none focus:outline-none text-[9px] font-black w-full uppercase tracking-widest placeholder:text-slate-300"
              />
            </div>
          </div>

          <div className="hidden md:flex flex-col items-center">
            <h1 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] leading-tight">{settings.companyName}</h1>
            <p className="text-[7px] font-bold text-secondary uppercase tracking-[0.2em]">EDIFICANDO EL FUTURO</p>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:flex items-center gap-1 border-r border-slate-100 pr-4 mr-1">
               <button 
                onClick={toggleFullScreen}
                className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-xl transition-all"
               >
                 <Maximize size={16} />
               </button>
               <button className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-xl transition-all">
                 <HelpCircle size={16} />
               </button>
            </div>

            <TopBarClock />
            
            <button 
              onClick={toggleTheme}
              className="p-2 sm:p-2.5 bg-slate-50 text-slate-500 hover:text-primary rounded-xl border border-slate-100 transition-all"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            <div className="relative">
               <button 
                onClick={handleOpenNotifications}
                className="relative p-2.5 bg-slate-50 text-slate-500 hover:text-primary rounded-xl border border-slate-100 transition-all group"
               >
                 <Bell size={18} className="group-hover:rotate-12 transition-transform" />
                 {unreadCount > 0 && (
                   <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-secondary border-2 border-white rounded-full ring-4 ring-secondary/10 animate-pulse" />
                 )}
               </button>

               <AnimatePresence>
                 {showNotifications && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10, scale: 0.95 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 10, scale: 0.95 }}
                     className="absolute right-0 mt-3 w-72 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 z-50 ring-1 ring-slate-900/5"
                   >
                     <div className="flex justify-between items-center mb-4">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Notificaciones</span>
                        <span className="text-[8px] font-bold text-slate-300 uppercase">Todo leído</span>
                     </div>
                     <div className="space-y-4">
                        {liveNotifications.length === 0 ? (
                          <p className="text-[9px] text-slate-400 uppercase tracking-widest text-center py-4">Sin alertas activas</p>
                        ) : liveNotifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => handleNotificationClick(n.module)}
                            className="flex gap-3 group cursor-pointer p-1.5 -m-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                          >
                             <div className={cn(
                               "w-1 h-auto rounded-full shrink-0",
                               n.type === 'error' ? "bg-red-500" : n.type === 'warning' ? "bg-amber-500" : n.type === 'info' ? "bg-blue-500" : "bg-green-500"
                             )} />
                             <div className="min-w-0">
                                <p className="text-[10px] font-black text-primary leading-tight group-hover:text-secondary transition-colors line-clamp-2">{n.text}</p>
                                <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Toca para ir al modulo</p>
                             </div>
                          </div>
                        ))}
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-100 h-8">
               <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-black text-primary uppercase leading-none truncate max-w-[100px]">{user?.displayName || 'Usuario'}</p>
                  <p className="text-[8px] font-bold text-slate-400 mt-1 tracking-widest uppercase truncate max-w-[100px]">Administrador</p>
               </div>
               <div className="w-9 h-9 rounded-xl shadow-xl shadow-primary/10 border-2 border-white ring-1 ring-slate-200 flex items-center justify-center font-bold text-[10px] text-white overflow-hidden cursor-pointer active:scale-95 transition-transform bg-slate-900">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="uppercase">{user?.displayName?.charAt(0) || 'U'}</span>
                  )}
               </div>
            </div>
          </div>
        </header>

        <section id="content-viewport" className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6 bg-[#F8FAFC] scroll-smooth custom-scrollbar">
           <div className="w-full max-w-[1600px] mx-auto min-h-full">
             {children}
           </div>
        </section>

        <footer className="h-8 bg-white text-slate-400 text-[8px] font-bold flex items-center justify-between px-6 border-t border-slate-100 uppercase tracking-widest shrink-0">
           <div className="flex gap-4">
              <span>© 2024 WM/M&S CONSTRUCTORA</span>
              <span className="hidden sm:inline">Motor: V 2.4.1 PRO</span>
           </div>
           <div className="flex gap-3">
              <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" /> En línea</span>
              <span className="hidden sm:inline">Latencia: 24ms</span>
           </div>
        </footer>
      </main>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            id="mobile-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] md:hidden"
          >
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-4/5 h-full bg-white p-8 flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-12">
                 <Logo />
                 <button onClick={() => setIsMobileMenuOpen(false)} className="p-3 bg-slate-100 rounded-xl text-primary">
                   <X size={20} />
                 </button>
              </div>
              <nav className="flex-1 space-y-4">
                 {menuItems.map((item) => (
                   <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all",
                      activeTab === item.id ? "bg-primary text-white shadow-2xl shadow-primary/20" : "text-slate-400"
                    )}
                   >
                     {item.icon}
                     {item.label}
                   </button>
                 ))}
              </nav>
              <div className="mt-auto border-t border-slate-100 pt-6">
                 <button 
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-4 px-6 py-4 text-red-500 font-black uppercase text-xs tracking-widest hover:bg-red-50 rounded-2xl transition-all"
                 >
                   <LogOut size={20} /> Salir del Sistema
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
