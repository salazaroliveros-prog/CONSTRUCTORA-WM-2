/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy } from 'react';
import { useEffect } from 'react';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from './components/Logo';
import { Toaster } from 'sonner';
import { ProjectFilterProvider } from './contexts/ProjectFilterContext';

const Dashboard = lazy(() => import('./components/Dashboard'));
const CalculatorModule = lazy(() => import('./components/Calculator'));
const ExecutionModule = lazy(() => import('./components/Execution'));
const ClientsModule = lazy(() => import('./components/Clients'));
const InventoryModule = lazy(() => import('./components/Inventory'));
const ProjectsModule = lazy(() => import('./components/Projects'));
const SuppliersModule = lazy(() => import('./components/Suppliers'));
const StaffModule = lazy(() => import('./components/Staff'));
const AnalyticsModule = lazy(() => import('./components/Analytics'));
const SettingsModule = lazy(() => import('./components/Settings'));
const SeedDataModule = lazy(() => import('./components/SeedData'));
const SeguimientoModule = lazy(() => import('./components/Seguimiento'));
const CleanDataModule = lazy(() => import('./components/CleanData'));
const AIAssistantModule = lazy(() => import('./components/AIAssistant'));
const GanttChartModule = lazy(() => import('./components/GanttChart'));
const EffectsShowcaseModule = lazy(() => import('./components/EffectsShowcase'));

function AppContent() {
  const validTabs = new Set(['dashboard', 'calculator', 'execution', 'clients', 'inventory', 'projects', 'suppliers', 'staff', 'analytics', 'settings', 'seed', 'seguimiento', 'clean', 'ai', 'gantt', 'effects']);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return tab && validTabs.has(tab) ? tab : 'dashboard';
  });
  const { user, login, loading, isAuthorizedUser, signOut } = useAuth();

  const handleSetActiveTab = (tab: string) => {
    const nextTab = validTabs.has(tab) ? tab : 'dashboard';
    setActiveTab(nextTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', nextTab);
    window.history.replaceState(null, '', url);
  };

  useEffect(() => {
    if (user?.photoURL) {
      // Update favicon
      const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (link) {
        link.href = user.photoURL;
      }
      // Update apple-touch-icon
      const appleIcon: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
      if (appleIcon) {
        appleIcon.href = user.photoURL;
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, #0f2040 0%, #0a0f1e 60%, #000 100%)' }}>
        <style>{`
          @keyframes orbit1 { from { transform: rotateZ(0deg) rotateX(65deg) rotateZ(0deg); } to { transform: rotateZ(360deg) rotateX(65deg) rotateZ(-360deg); } }
          @keyframes orbit2 { from { transform: rotateZ(0deg) rotateX(65deg) rotateY(60deg) rotateZ(0deg); } to { transform: rotateZ(360deg) rotateX(65deg) rotateY(60deg) rotateZ(-360deg); } }
          @keyframes orbit3 { from { transform: rotateZ(0deg) rotateX(65deg) rotateY(120deg) rotateZ(0deg); } to { transform: rotateZ(360deg) rotateX(65deg) rotateY(120deg) rotateZ(-360deg); } }
          @keyframes nucleus { 0%,100% { transform: scale(1); box-shadow: 0 0 20px 6px #f59e0b, 0 0 60px 20px rgba(245,158,11,0.3); } 50% { transform: scale(1.18); box-shadow: 0 0 40px 12px #f59e0b, 0 0 100px 40px rgba(245,158,11,0.5); } }
          @keyframes sparkle { 0%,100% { opacity: 0; transform: scale(0); } 50% { opacity: 1; transform: scale(1); } }
          @keyframes scanline { from { transform: translateY(-100%); } to { transform: translateY(100vh); } }
          .orbit-ring { position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid rgba(245,158,11,0.5); }
          .orbit-ring::after { content: ''; position: absolute; top: -5px; left: 50%; width: 10px; height: 10px; background: #f59e0b; border-radius: 50%; box-shadow: 0 0 12px 4px #f59e0b, 0 0 24px 8px rgba(245,158,11,0.6); transform: translateX(-50%); }
          .ring1 { animation: orbit1 2.4s linear infinite; }
          .ring2 { animation: orbit2 3.2s linear infinite; }
          .ring3 { animation: orbit3 1.8s linear infinite; }
        `}</style>

        {/* Scanline effect */}
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', width: '100%', height: '2px', background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.15), transparent)', animation: 'scanline 4s linear infinite' }} />
        </div>

        {/* Atom */}
        <div style={{ position: 'relative', width: 200, height: 200, zIndex: 1 }}>
          {/* Nucleus */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 28, height: 28, borderRadius: '50%', background: 'radial-gradient(circle, #fbbf24, #f59e0b)', transform: 'translate(-50%,-50%)', animation: 'nucleus 1.6s ease-in-out infinite', zIndex: 10 }} />

          {/* Orbit rings */}
          <div className="orbit-ring ring1" />
          <div className="orbit-ring ring2" />
          <div className="orbit-ring ring3" />

          {/* Sparkles */}
          {[
            { top: '8%',  left: '20%', delay: '0s',    size: 6 },
            { top: '15%', left: '75%', delay: '0.4s',  size: 4 },
            { top: '70%', left: '10%', delay: '0.8s',  size: 5 },
            { top: '80%', left: '80%', delay: '1.2s',  size: 4 },
            { top: '45%', left: '92%', delay: '0.6s',  size: 6 },
            { top: '50%', left: '2%',  delay: '1.0s',  size: 5 },
            { top: '30%', left: '50%', delay: '1.4s',  size: 3 },
            { top: '88%', left: '45%', delay: '0.2s',  size: 4 },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', top: s.top, left: s.left, width: s.size, height: s.size, borderRadius: '50%', background: '#f59e0b', boxShadow: `0 0 ${s.size * 3}px ${s.size}px rgba(245,158,11,0.8)`, animation: `sparkle 1.8s ease-in-out infinite`, animationDelay: s.delay }} />
          ))}
        </div>

        {/* Text */}
        <motion.div className="flex flex-col items-center gap-3 mt-6" style={{ zIndex: 1 }}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}>
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-amber-400">Iniciando Sistema</p>
          {/* Dot loader */}
          <div className="flex gap-2">
            {[0, 1, 2, 3].map(i => (
              <motion.div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' }}
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
              />
            ))}
          </div>
          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.3em]">ERP CONSTRUCTORA · WM</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen dark flex items-center justify-center p-6" style={{background:'radial-gradient(ellipse 60% 55% at 50% -5%, rgba(200,160,60,0.55) 0%, rgba(120,90,20,0.25) 40%, transparent 70%), linear-gradient(to bottom, #0a0c14 55%, #0d1a3a 75%, #0a2060 88%, #0d2878 100%)'}}>
        <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl flex flex-col items-center text-center space-y-10 animate-in fade-in zoom-in duration-500">
          <Logo />
          <div>
            <h1 className="text-2xl font-black text-primary uppercase tracking-tighter leading-tight italic">Sistema de Gestión<br/>Constructora</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-4">Sistema de Gestión de Obra Profesional</p>
          </div>
          
          <button 
            onClick={() => login()}
            className="w-full flex items-center justify-center gap-4 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all group active:scale-95 shadow-xl shadow-slate-900/10"
          >
            <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
            Acceder con Google
          </button>
          
          <div className="pt-4 border-t border-slate-100 w-full">
            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Desarrollado para alta eficiencia operativa</p>
          </div>
        </div>
      </div>
    );
  }

  // Si el usuario no está autorizado, mostrar pantalla en blanco
  if (!isAuthorizedUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{background:'radial-gradient(ellipse 60% 55% at 50% -5%, rgba(100,100,120,0.3) 0%, rgba(60,60,80,0.15) 40%, transparent 70%), linear-gradient(to bottom, #0a0c14 55%, #1a1a2e 75%, #16213e 88%, #0f3460 100%)'}}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-10 text-center space-y-8"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-2xl">
            <LogIn size={32} className="text-white/60" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-wide">Bienvenido</h1>
            <p className="text-slate-400 text-sm mt-2">{user?.displayName}</p>
            <p className="text-slate-500 text-xs mt-1">{user?.email}</p>
          </div>
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
            <p className="text-slate-300 text-sm leading-relaxed">
              Tu cuenta ha sido registrada correctamente. Sin embargo, no tienes datos asociados en el sistema.
            </p>
            <p className="text-slate-500 text-xs mt-3">
              Contacta al administrador para obtener acceso a los datos del ERP.
            </p>
          </div>
          <button 
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-3 bg-slate-800 text-white py-4 rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all active:scale-95"
          >
            <LogIn size={18} className="rotate-180" />
            Cerrar Sesion
          </button>
        </motion.div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={handleSetActiveTab} />;
      case 'calculator':
        return <CalculatorModule />;
      case 'execution':
        return <ExecutionModule setActiveTab={handleSetActiveTab} />;
      case 'clients':
        return <ClientsModule />;
      case 'inventory':
        return <InventoryModule />;
      case 'projects':
        return <ProjectsModule />;
      case 'suppliers':
        return <SuppliersModule />;
      case 'staff':
        return <StaffModule />;
      case 'analytics':
        return <AnalyticsModule />;
      case 'settings':
        return <SettingsModule />;
      case 'seed':
        return <SeedDataModule />;
      case 'clean':
        return <CleanDataModule />;
      case 'ai':
        return <AIAssistantModule />;
      case 'seguimiento':
        return <SeguimientoModule />;
      case 'gantt':
        return <GanttChartModule />;
      case 'effects':
        return <EffectsShowcaseModule />;
      default:
        return <Dashboard setActiveTab={handleSetActiveTab} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={handleSetActiveTab}>
      <Suspense fallback={
        <div className="flex-1 p-4 space-y-3 animate-fade-in">
          {/* Header skeleton */}
          <div className="flex items-center gap-3 mb-6">
            <div className="skeleton w-8 h-8 rounded-lg" />
            <div className="skeleton w-40 h-5 rounded" />
          </div>
          {/* Cards skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
          {/* Content skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="skeleton h-48 rounded-xl md:col-span-2" />
            <div className="skeleton h-48 rounded-xl" />
          </div>
          <div className="skeleton h-32 rounded-xl" />
        </div>
      }>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.99 }}
          transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="h-full"
        >
          {renderContent()}
        </motion.div>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ProjectFilterProvider>
          <Toaster position="top-right" richColors />
          <AppContent />
        </ProjectFilterProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

