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
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        <div className="max-w-xs w-full flex flex-col items-center text-center space-y-6 animate-pulse">
          <Logo />
          <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, repeat: Infinity }}
              className="h-full bg-secondary" 
            />
          </div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] animate-bounce">Iniciando Sistemas...</p>
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
            <h1 className="text-2xl font-black text-primary uppercase tracking-tighter leading-tight italic">Technical Management<br/>System</h1>
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
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cargando Módulo...</p>
          </div>
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
