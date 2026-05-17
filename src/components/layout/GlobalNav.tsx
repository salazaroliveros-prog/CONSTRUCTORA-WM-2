import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, Building2, ClipboardList, TrendingUp, 
  Calendar, Package, Truck, HardHat, Users, BarChart3, 
  Sparkles, Settings, LogOut, X, Menu, Home, ShoppingCart,
  GitCompareArrows, Layers, Palette
} from "lucide-react";
import { cn } from "../../utils/cn";
import { useAuth } from "../../contexts/AuthContext";

interface GlobalNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
}

export function GlobalNav({ activeTab, onNavigate, isMenuOpen, setIsMenuOpen }: GlobalNavProps) {
  const { signOut } = useAuth();

  const menuItems = [
    { id: "dashboard", label: "inicio", icon: <LayoutDashboard size={20} /> },
    { id: "projects", label: "proyectos", icon: <Building2 size={20} /> },
    { id: "clients", label: "clientes", icon: <Users size={20} /> },
    { id: "suppliers", label: "proveedores", icon: <Truck size={20} /> },
    { id: "execution", label: "bitácora", icon: <ClipboardList size={20} /> },
    { id: "purchase-orders", label: "órdenes compra", icon: <ShoppingCart size={20} /> },
    { id: "seguimiento", label: "seguimiento", icon: <TrendingUp size={20} /> },
    { id: "gantt", label: "gantt", icon: <Calendar size={20} /> },
    { id: "pert", label: "pert", icon: <GitCompareArrows size={20} /> },
    { id: "fisico-financiero", label: "físico-fin.", icon: <Layers size={20} /> },
    { id: "inventory", label: "stock", icon: <Package size={20} /> },
    { id: "staff", label: "rrhh", icon: <HardHat size={20} /> },
    { id: "analytics", label: "analíticas", icon: <BarChart3 size={20} /> },
    { id: "effects", label: "efectos", icon: <Palette size={20} /> },
    { id: "ai", label: "calculadora", icon: <Sparkles size={20} /> },
    { id: "settings", label: "ajustes", icon: <Settings size={20} /> },
  ];

  const handleItemClick = (id: string) => {
    onNavigate(id);
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="fixed top-6 left-6 z-[100001] lg:hidden">
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={cn(
            "burger-btn shadow-xl transition-all duration-500 hover:scale-110",
            isMenuOpen ? "bg-white text-black" : "bg-p-900 text-white"
          )}
          aria-label="Menú principal"
        >
          <AnimatePresence mode="wait">
            {isMenuOpen ? (
              <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                <X size={24} className="text-black" />
              </motion.div>
            ) : (
              <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} className="flex flex-col gap-1.5 items-center">
                <span className="w-6 h-[2px] bg-current block" />
                <span className="w-4 h-[2px] bg-current block mr-auto" />
                <span className="w-6 h-[2px] bg-current block" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Full Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="full-menu-overlay z-[100000] bg-black/90 backdrop-blur-2xl"
          >
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-5 sm:gap-8 max-w-4xl p-6 sm:p-10 overflow-y-auto max-h-screen">
              {menuItems.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleItemClick(item.id)}
                  className={cn(
                    "flex flex-col items-center gap-4 group",
                    activeTab === item.id ? "text-amber-500" : "text-white/60"
                  )}
                >
                    <div className={cn(
                      "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center transition-all duration-500 border border-white/10 bg-white/5 group-hover:bg-amber-500 group-hover:text-black group-hover:scale-110 group-hover:-rotate-3 shadow-2xl",
                      activeTab === item.id && "bg-white/10 border-amber-500/50"
                    )}>
                      {React.cloneElement(item.icon as React.ReactElement<any>, { size: 24 })}
                    </div>
                  <span className="text-xs font-black uppercase tracking-[0.3em] group-hover:text-white transition-colors">
                    {item.label}
                  </span>
                </motion.button>
              ))}

              {/* Special: Logout */}
              <motion.button
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                onClick={() => { signOut(); setIsMenuOpen(false); }}
                className="flex flex-col items-center gap-4 group text-red-400/60"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center transition-all duration-500 border border-red-500/20 bg-red-500/5 group-hover:bg-red-500 group-hover:text-white group-hover:scale-110 shadow-2xl">
                  <LogOut size={24} />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.3em] group-hover:text-white transition-colors">
                  salir
                </span>
              </motion.button>
            </div>

            {/* Background decorative elements */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-[120px] -z-10" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent link style footer (from your code) */}
      <div id="fixedlink" className="pointer-events-none opacity-40">
        <span className="uppercase tracking-[0.4em]">Constructora WM · Gestión de Obra Profesional</span>
      </div>
    </>
  );
}


