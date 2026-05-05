/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy } from 'react';
import { useEffect } from 'react';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from './components/Logo';
import { Toaster } from 'sonner';

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

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { user, login, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'}}>
        <div className="flex flex-col items-center gap-8">
          {/* Ícono constructora animado */}
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 80 80" className="w-full h-full">
              {/* Base edificio */}
              <motion.rect x="15" y="35" width="30" height="30" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5"
                initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.5, delay: 0.1 }} style={{ transformOrigin: 'bottom' }} />
              {/* Techo triangular */}
              <motion.path d="M10 35 L30 10 L50 35 Z" fill="#f59e0b"
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.5 }} />
              {/* Torre derecha */}
              <motion.rect x="50" y="20" width="18" height="45" fill="#334155" stroke="#f59e0b" strokeWidth="1"
                initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.5, delay: 0.3 }} style={{ transformOrigin: 'bottom' }} />
              {/* Ventanas parpadeantes */}
              <motion.rect x="20" y="42" width="8" height="6" fill="#f59e0b" fillOpacity="0.3"
                animate={{ fillOpacity: [0.3, 0.9, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0 }} />
              <motion.rect x="32" y="42" width="8" height="6" fill="#f59e0b" fillOpacity="0.3"
                animate={{ fillOpacity: [0.3, 0.9, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }} />
              <motion.rect x="53" y="28" width="5" height="4" fill="#f59e0b" fillOpacity="0.3"
                animate={{ fillOpacity: [0.3, 0.9, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.8 }} />
              <motion.rect x="61" y="28" width="5" height="4" fill="#f59e0b" fillOpacity="0.3"
                animate={{ fillOpacity: [0.3, 0.9, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: 1.2 }} />
              {/* Grúa */}
              <motion.line x1="58" y1="20" x2="58" y2="5" stroke="#64748b" strokeWidth="1.5"
                initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.3, delay: 0.7 }} style={{ transformOrigin: 'bottom' }} />
              <motion.line x1="58" y1="5" x2="75" y2="5" stroke="#64748b" strokeWidth="1.5"
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.3, delay: 1 }} style={{ transformOrigin: 'left' }} />
              <motion.line x1="72" y1="5" x2="72" y2="12" stroke="#f59e0b" strokeWidth="1"
                animate={{ y: [0, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 1.2 }} />
            </svg>
          </div>

          {/* Barra de progreso */}
          <div className="w-48 space-y-2">
            <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="h-full bg-amber-500 rounded-full"
              />
            </div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] text-center">Iniciando sistema...</p>
          </div>
        </div>
      </div>
    );
  }

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

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl flex flex-col items-center text-center space-y-10 animate-in fade-in zoom-in duration-500">
          <Logo />
          <div>
            <h1 className="text-2xl font-black text-primary uppercase tracking-tighter leading-tight italic">Sistema de Gestión<br/>Constructora</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-4">Sistema de Gestión de Obra Profesional</p>
          </div>
          
          <button 
            onClick={() => login()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-4 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all group active:scale-95 shadow-xl shadow-slate-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
            )}
            {loading ? 'Iniciando sesión...' : 'Acceder con Google'}
          </button>
          
          <div className="pt-4 border-t border-slate-100 w-full">
            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Desarrollado para alta eficiencia operativa</p>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'calculator':
        return <CalculatorModule />;
      case 'execution':
        return <ExecutionModule />;
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
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <Suspense fallback={
        <div className="flex-1 p-6 space-y-4 animate-fade-in">
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
          initial={{ opacity: 0, y: 10, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
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
        <ThemeProvider>
          <Toaster position="top-right" richColors />
          <AppContent />
        </ThemeProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
