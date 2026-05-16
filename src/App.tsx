/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster } from "sonner";

// Auth & Providers
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ProjectFilterProvider } from "./contexts/ProjectFilterContext";
import { NetworkStatusProvider, useNetworkStatus } from "./contexts/NetworkStatusContext";

// Layout
import { AppShell } from "./components/layout/AppShell";
import { GlobalNav } from "./components/layout/GlobalNav";
import { PageTransition } from "./components/shared/PageTransition";
import ErrorBoundary from "./components/shared/ErrorBoundary";

// UI Components
import { CommandMenu } from "./components/ui/command";

// Icons
import { LogIn } from "lucide-react";
import Logo from "./components/Logo";

// Lazy-loaded modules
const Dashboard = lazy(() => import("./components/modules/Dashboard"));
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

// ── Login Screen ──
function LoginScreen({ login }: { login: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden login-bg">
      {/* Decorative elements */}
      <div className="absolute top-20 left-20 w-72 h-72 rounded-full login-deco-1" />
      <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full login-deco-2" />
      <div className="absolute top-1/2 right-1/3 w-48 h-48 rounded-full login-deco-3" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-8"
      >
        {/* Illustration from Freepik */}
        <div className="hidden sm:block w-48 lg:w-56 shrink-0">
          <img
            src="/login-bg.jpg"
            alt="Ilustración de inicio de sesión"
            className="w-full h-auto opacity-90"
          />
          <p className="text-[7px] text-white/20 text-center mt-1 tracking-wider">
            Designed by starline / Freepik
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl p-8 sm:p-10 login-glass-card w-full max-w-sm">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="/logo.png"
              alt="Constructora WM"
              className="h-16 w-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight">
              Sistema de Gestión
            </h1>
            <span className="text-2xl sm:text-3xl font-black bg-linear-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent tracking-tight">
              Constructora
            </span>
            <p className="text-xs font-medium text-white/40 uppercase tracking-[0.15em] mt-3">
              Panel de Control Profesional
            </p>
          </div>

          {/* Login Button with Google logo */}
          <motion.button
            onClick={login}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm transition-all login-btn-google"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Acceder con Google
          </motion.button>

          {/* Footer */}
          <div className="mt-6 pt-4 login-footer-divider">
            <p className="text-[10px] font-medium text-white/25 uppercase tracking-widest text-center">
              ERP Constructora WM · Gestión de Obra Profesional
            </p>
          </div>
        </div>
      </motion.div>
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
          {/* Avatar */}
          <div className="w-20 h-20 mx-auto rounded-full bg-linear-to-br from-neutral-700 to-neutral-900 flex items-center justify-center shadow-2xl">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <LogIn size={32} className="text-white/40" />
            )}
          </div>

          {/* Text */}
          <div>
            <h1 className="text-xl font-black text-white uppercase tracking-wide">
              Bienvenido
            </h1>
            <p className="text-neutral-400 text-sm mt-1">{user?.displayName}</p>
            <p className="text-neutral-500 text-xs mt-0.5">{user?.email}</p>
          </div>

          {/* Info */}
          <div className="bg-neutral-800/50 rounded-2xl p-5 border border-neutral-700/50">
            <p className="text-neutral-300 text-sm leading-relaxed">
              Tu cuenta ha sido registrada correctamente. Sin embargo, no tienes
              datos asociados en el sistema.
            </p>
            <p className="text-neutral-500 text-xs mt-2">
              Contacta al administrador para obtener acceso.
            </p>
          </div>

          {/* Logout button */}
          <motion.button
            onClick={() => signOut()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2 bg-neutral-800 text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-neutral-700 transition-all"
          >
            <LogIn size={16} className="rotate-180" />
            Cerrar Sesión
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
    if (syncStatus.lastSync) {
      const ago = Math.round((Date.now() - new Date(syncStatus.lastSync).getTime()) / 1000);
      if (ago < 30) return null;
    }
    return null;
  }
  return (
    <div className="fixed top-0 left-0 right-0 z-9999 bg-amber-500/90 backdrop-blur-md text-amber-950 text-center text-xs font-bold py-2 px-4 shadow-lg shadow-amber-500/20">
      Sin conexión a internet
      {syncStatus.pending > 0 && ` — ${syncStatus.pending} cambio${syncStatus.pending > 1 ? 's' : ''} pendiente${syncStatus.pending > 1 ? 's' : ''} de sincronizar`}
    </div>
  );
}

// ── Loading Screen (app startup) ──
function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,#0f2040_0%,#0a0f1e_60%,#000_100%)]"
    >
      {/* Animated logo */}
      <div className="relative w-20 h-20 z-10">
        <div className="absolute inset-0 rounded-full bg-linear-to-br from-amber-500 to-amber-600 shadow-xl shadow-amber-500/30 animate-pulse" />
        <div className="absolute inset-2 rounded-full bg-primary flex items-center justify-center">
          <img src="/logo.png" alt="WM" className="w-10 h-10 object-contain" />
        </div>
      </div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="flex flex-col items-center gap-3 mt-6"
      >
        <p className="text-sm font-black uppercase tracking-widest text-amber-400">
          Iniciando Sistema
        </p>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-amber-500"
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
          ERP Constructora · WM
        </p>
      </motion.div>
    </div>
  );
}

// ── Main App Component ──
function AppContent() {
  const validTabs = new Set([
    "dashboard",
    "execution",
    "clients",
    "inventory",
    "projects",
    "suppliers",
    "staff",
    "analytics",
    "settings",
    "seguimiento",
    "ai",
    "gantt",
    "pert",
    "fisico-financiero",
    "effects",
  ]);

  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab && validTabs.has(tab) ? tab : "dashboard";
  });

  const { user, login, loading, isAuthorizedUser, signOut } = useAuth();

  // Sync tab with URL
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTab);
    window.history.replaceState(null, "", url);
  }, [activeTab]);

  // User favicon
  useEffect(() => {
    if (user?.photoURL) {
      const link = document.querySelector("link[rel*='icon']");
      if (link) (link as HTMLLinkElement).href = user.photoURL;
    }
  }, [user]);

  // Tab navigation helper
  const handleNavigate = (tab: string) => {
    if (validTabs.has(tab)) {
      setActiveTab(tab);
    }
  };

  // All menu items for sidebar and mobile nav
  const allMenuItems = [
    {
      id: "dashboard",
      label: "Inicio",
      labelMobile: "Inicio",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      ),
    },
    {
      id: "projects",
      label: "Proyectos",
      labelMobile: "Proyectos",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
        </svg>
      ),
    },
    {
      id: "execution",
      label: "Bitácora",
      labelMobile: "Bitácora",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="8" width="12" height="10" rx="2" />
          <path d="M16 8V6a4 4 0 0 0-8 0v2" />
          <line x1="10" y1="14" x2="10.01" y2="14" />
          <line x1="14" y1="14" x2="14.01" y2="14" />
        </svg>
      ),
    },
    {
      id: "seguimiento",
      label: "Seguimiento",
      labelMobile: "Seguim.",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      ),
    },
    {
      id: "gantt",
      label: "Gantt",
      labelMobile: "Gantt",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    },
    {
      id: "pert",
      label: "PERT",
      labelMobile: "PERT",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="6" r="3" />
          <circle cx="12" cy="6" r="3" />
          <circle cx="19" cy="6" r="3" />
          <circle cx="5" cy="18" r="3" />
          <circle cx="12" cy="18" r="3" />
          <circle cx="19" cy="18" r="3" />
          <line x1="8" y1="6" x2="9" y2="6" />
          <line x1="15" y1="6" x2="16" y2="6" />
          <line x1="5" y1="9" x2="5" y2="15" />
          <line x1="12" y1="9" x2="12" y2="15" />
          <line x1="19" y1="9" x2="19" y2="15" />
          <line x1="8" y1="18" x2="9" y2="18" />
          <line x1="15" y1="18" x2="16" y2="18" />
        </svg>
      ),
    },
    {
      id: "fisico-financiero",
      label: "Físico-Fin.",
      labelMobile: "Fís-Fin",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="M7 16h2v5H7zM11 11h2v10h-2zM15 8h2v13h-2zM19 5h2v16h-2z" />
          <path d="M3 13c4-6 12-6 16 0" />
        </svg>
      ),
    },
    {
      id: "inventory",
      label: "Stock",
      labelMobile: "Stock",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 23 16V8z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
    },
    {
      id: "suppliers",
      label: "Proveedores",
      labelMobile: "Proveed.",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="2" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    },
    {
      id: "staff",
      label: "Recursos Humanos",
      labelMobile: "RRHH",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: "clients",
      label: "Clientes",
      labelMobile: "Clientes",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: "analytics",
      label: "Analíticas",
      labelMobile: "Analít.",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v16a2 2 0 0 0 2 2h16" />
          <path d="M7 16h2v5H7zM11 11h2v10h-2zM15 8h2v13h-2zM19 5h2v16h-2z" />
        </svg>
      ),
    },
    {
      id: "ai",
      label: "Calculadora de Presupuestos",
      labelMobile: "Calc.",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Ajustes",
      labelMobile: "Ajustes",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
  ];

  // Get menu items (respecting activeModules settings)
  const menuItems = allMenuItems.filter(
    (item) =>
      item.id === "settings" ||
      item.id === "ai" ||
      true // All modules active by default
  );

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Rendering
  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen login={login} />;
  }

  if (!isAuthorizedUser) {
    return (
      <UnauthorizedScreen user={user} signOut={signOut} />
    );
  }

  const renderModule = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard key="dashboard" />;
      case "execution":
        return <ExecutionModule key="execution" />;
      case "clients":
        return <ClientsModule key="clients" />;
      case "inventory":
        return <InventoryModule key="inventory" />;
      case "projects":
        return <ProjectsModule key="projects" />;
      case "suppliers":
        return <SuppliersModule key="suppliers" />;
      case "staff":
        return <StaffModule key="staff" />;
      case "analytics":
        return <AnalyticsModule key="analytics" />;
      case "settings":
        return <SettingsModule key="settings" />;
      case "seguimiento":
        return <SeguimientoModule key="seguimiento" />;
      case "ai":
        return <AIAssistantModule key="ai" />;
      case "gantt":
        return <GanttChartModule key="gantt" />;
      case "pert":
        return <PERTChartModule key="pert" />;
      case "fisico-financiero":
        return <PhysicalFinancialModule key="fisico-financiero" />;
      case "effects":
        return <EffectsShowcaseModule key="effects" />;
      default:
        return <Dashboard key="default" />;
    }
  };

  return (
    <>
      <OfflineBanner />
      <GlobalNav 
        activeTab={activeTab}
        onNavigate={handleNavigate}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />
      <AppShell isMenuOpen={isMenuOpen}>
        {renderModule()}
      </AppShell>
    </>
  );
}

// ── Root App ──
export default function App() {
  return (
    <NetworkStatusProvider>
      <AuthProvider>
        <SettingsProvider>
          <ProjectFilterProvider>
            <Toaster
              position="bottom-right"
              richColors
              toastOptions={{
                classNames: {
                  success: "border-l-emerald-500",
                  error: "border-l-red-500",
                  warning: "border-l-amber-500",
                  info: "border-l-blue-500",
                },
              }}
            />
            <AppContent />
          </ProjectFilterProvider>
        </SettingsProvider>
      </AuthProvider>
    </NetworkStatusProvider>
  );
}

