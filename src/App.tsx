/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster } from "sonner";
import { cn } from "./utils/cn";

// Auth & Providers
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ProjectFilterProvider } from "./contexts/ProjectFilterContext";
import { NetworkStatusProvider, useNetworkStatus } from "./contexts/NetworkStatusContext";

// Layout
import { SidebarNavigation } from "./components/layout/SidebarNavigation";
import { GlobalNav } from "./components/layout/GlobalNav";
import { TopBar } from "./components/layout/TopBar";
import ErrorBoundary from "./components/shared/ErrorBoundary";

// Icons
import { LogIn } from "lucide-react";

// Lazy-loaded modules
const Dashboard = lazy(() => import("./components/Dashboard"));
const ExecutionModule = lazy(() => import("./components/Execution"));
const ClientsModule = lazy(() => import("./components/Clients"));
const InventoryModule = lazy(() => import("./components/Inventory"));
const ProjectsModule = lazy(() => import("./components/Projects"));
const SuppliersModule = lazy(() => import("./components/Suppliers"));
const StaffModule = lazy(() => import("./components/Staff"));
const AnalyticsModule = lazy(() => import("./components/Analytics"));
const SettingsModule = lazy(() => import("./components/Settings"));
const SeguimientoModule = lazy(() => import("./components/Seguimiento"));
const AIAssistantModule = lazy(() => import("./components/AIAssistant"));
const GanttChartModule = lazy(() => import("./components/GanttChart"));
const PERTChartModule = lazy(() => import("./components/modules/PERTChart"));
const PhysicalFinancialModule = lazy(() => import("./components/modules/PhysicalFinancialDashboard"));
const PurchaseOrdersModule = lazy(() => import("./components/PurchaseOrders"));
const EffectsShowcaseModule = lazy(() => import("./components/EffectsShowcase"));

// ── Loading Spinner Component ──
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="relative">
        <div className="w-10 h-10 border-3 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}

// ── App Content ──
function AppContent() {
  const [isNavOpen, setIsNavOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const validTabs = new Set([
    "dashboard", "execution", "clients", "inventory", "projects", "suppliers", 
    "staff", "analytics", "settings", "seguimiento", "ai", "gantt", "pert", 
    "fisico-financiero", "purchase-orders", "effects"
  ]);

  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab && validTabs.has(tab) ? tab : "dashboard";
  });

  const { user, login, loading, isAuthorizedUser, signOut } = useAuth();

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTab);
    window.history.replaceState(null, "", url);
  }, [activeTab]);

  useEffect(() => {
    if (user?.photoURL) {
      const link = document.querySelector("link[rel*='icon']");
      if (link) (link as HTMLLinkElement).href = user.photoURL;
    }
  }, [user]);

  const handleNavigate = (tab: string) => {
    if (validTabs.has(tab)) {
      setActiveTab(tab);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0c1222 0%, #ffffff 100%)' }}>
      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );
  if (!user) return <LoginScreen login={login} />;
  if (!isAuthorizedUser) return <UnauthorizedScreen user={user} signOut={signOut} />;

  const renderModule = () => {
    switch (activeTab) {
      case "dashboard": return <Dashboard key="dashboard" setActiveTab={handleNavigate} />;
      case "execution": return <ExecutionModule key="execution" setActiveTab={handleNavigate} />;
      case "clients": return <ClientsModule key="clients" />;
      case "inventory": return <InventoryModule key="inventory" />;
      case "projects": return <ProjectsModule key="projects" />;
      case "suppliers": return <SuppliersModule key="suppliers" />;
      case "staff": return <StaffModule key="staff" />;
      case "analytics": return <AnalyticsModule key="analytics" />;
      case "settings": return <SettingsModule key="settings" />;
      case "seguimiento": return <SeguimientoModule key="seguimiento" />;
      case "ai": return <AIAssistantModule key="ai" />;
      case "gantt": return <GanttChartModule key="gantt" />;
      case "pert": return <PERTChartModule key="pert" />;
      case "fisico-financiero": return <PhysicalFinancialModule key="fisico-financiero" />;
      case "purchase-orders": return <PurchaseOrdersModule key="purchase-orders" />;
      case "effects": return <EffectsShowcaseModule key="effects" />;
      default: return <Dashboard key="default" setActiveTab={handleNavigate} />;
    }
  };

  return (
    <>
      <OfflineBanner />
      <SidebarNavigation 
        activeTab={activeTab} 
        onNavigate={handleNavigate} 
        isOpen={isNavOpen} 
        onToggle={() => setIsNavOpen(!isNavOpen)} 
      />
      <GlobalNav
        activeTab={activeTab}
        onNavigate={handleNavigate}
        isMenuOpen={isMobileMenuOpen}
        setIsMenuOpen={setIsMobileMenuOpen}
      />
      <div className={cn(
        "min-h-screen transition-all duration-500",
        isNavOpen ? "lg:pl-64" : "lg:pl-20"
      )}>
        <TopBar onNavigate={handleNavigate} activeTab={activeTab} />
        <main className="pt-24 pb-10 px-4 sm:px-6 md:px-8">
           <Suspense fallback={<LoadingSpinner />}>
             {renderModule()}
           </Suspense>
        </main>
      </div>
    </>
  );
}

// ── Login Screen (Refactored) ──
function LoginScreen({ login }: { login: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6" style={{ background: 'linear-gradient(135deg, #0c1222 0%, #ffffff 100%)' }}>
      <div className="w-full max-w-[360px]">
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[24px] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Constructora WM" className="h-14 sm:h-16 w-auto mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Bienvenido
            </h2>
            <p className="text-white/70 text-sm sm:text-base">Inicia sesión con tu cuenta de Google</p>
          </div>

          <button
            onClick={login}
            className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl py-3.5 sm:py-4 text-white font-medium flex items-center justify-center gap-3 transition-all active:scale-[0.98] hover:-translate-y-0.5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Continuar con Google</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Unauthorized Screen ──
function UnauthorizedScreen({ user, signOut }: { user: any; signOut: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-linear-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-surface/10 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-linear-to-br from-neutral-700 to-neutral-900 flex items-center justify-center shadow-2xl">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <LogIn size={32} className="text-white/40" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-wide">Bienvenido</h1>
            <p className="text-neutral-400 text-sm mt-1">{user?.displayName}</p>
            <p className="text-neutral-500 text-xs mt-0.5">{user?.email}</p>
          </div>
          <div className="bg-neutral-800/50 rounded-2xl p-5 border border-neutral-700/50">
            <p className="text-neutral-300 text-sm leading-relaxed">Tu cuenta ha sido registrada correctamente. Sin embargo, no tienes datos asociados.</p>
          </div>
          <motion.button onClick={() => signOut()} className="w-full flex items-center justify-center gap-2 bg-neutral-800 text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-neutral-700 transition-all">
            <LogIn size={16} className="rotate-180" /> Cerrar Sesión
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Offline Banner ──
function OfflineBanner() {
  const { isOnline, syncStatus } = useNetworkStatus();
  if (isOnline) {
    if (syncStatus.syncing) {
      return (
        <div className="fixed top-0 left-0 right-0 z-9999 bg-blue-500/90 backdrop-blur-md text-white text-center text-xs font-bold py-2 px-4 shadow-lg shadow-blue-500/20">
          Sincronizando datos con el servidor…
        </div>
      );
    }
    return null;
  }
  return (
    <div className="fixed top-0 left-0 right-0 z-9999 bg-amber-500/90 backdrop-blur-md text-amber-950 text-center text-xs font-bold py-2 px-4 shadow-lg shadow-amber-500/20">
      Sin conexión a internet
    </div>
  );
}

// ── Root App ──
export default function App() {
  return (
    <NetworkStatusProvider>
      <AuthProvider>
        <SettingsProvider>
          <ProjectFilterProvider>
            <Toaster position="bottom-right" richColors />
            <AppContent />
          </ProjectFilterProvider>
        </SettingsProvider>
      </AuthProvider>
    </NetworkStatusProvider>
  );
}
