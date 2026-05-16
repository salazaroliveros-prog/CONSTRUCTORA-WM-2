import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, Building2, ClipboardList, TrendingUp, 
  Calendar, Package, Truck, HardHat, Users, BarChart3, 
  Sparkles, Settings, LogOut, X, Menu, Home 
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
  const [isSticky, setIsSticky] = useState(false);
  const { signOut, user } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const menuItems = [
    { id: "dashboard", label: "inicio", icon: <LayoutDashboard size={20} /> },
    { id: "projects", label: "proyectos", icon: <Building2 size={20} /> },
    { id: "execution", label: "bitácora", icon: <ClipboardList size={20} /> },
    { id: "seguimiento", label: "seguimiento", icon: <TrendingUp size={20} /> },
    { id: "gantt", label: "gantt", icon: <Calendar size={20} /> },
    { id: "inventory", label: "stock", icon: <Package size={20} /> },
    { id: "staff", label: "rrhh", icon: <HardHat size={20} /> },
    { id: "analytics", label: "analíticas", icon: <BarChart3 size={20} /> },
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
      <header className={cn(
        "fixed top-0 left-0 right-0 z-[100000] flex flex-col items-center transition-all duration-700 pointer-events-none",
        isSticky ? "pt-5 sticky" : "pt-8"
      )}>
        {/* Logo area */}
        <motion.div 
          initial={false}
          animate={{ 
            opacity: isSticky ? 0 : 1,
            scale: isSticky ? 0.8 : 1,
            y: isSticky ? -20 : 0
          }}
          className="mb-6 pointer-events-auto"
        >
          <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain filter invert brightness-200" />
        </motion.div>

        {/* Floating Nav Bar */}
        <nav className={cn(
          "flex items-center justify-center nav-glass transition-all duration-1000 ease-[cubic-bezier(0.075,0.82,0.165,1)] pointer-events-auto",
          isSticky 
            ? "w-[80px] h-[80px] rounded-full" 
            : "w-[90%] max-w-[600px] h-[70px] rounded-[100px] px-6"
        )}>
          {/* Main Nav Items (Hidden when sticky) */}
          <div className={cn(
            "flex items-center gap-2 transition-all duration-500",
            isSticky ? "opacity-0 scale-50 pointer-events-none hidden" : "opacity-100 scale-100"
          )}>
            {menuItems.slice(0, 5).map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={cn(
                  "nav-item-minimal hover:text-amber-400 transition-colors",
                  activeTab === item.id && "text-amber-500"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Burger Button (Always active when sticky, or as extra when not) */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={cn(
              "burger-btn transition-all duration-700",
              isSticky ? "scale-100 opacity-100" : "absolute right-4 w-10 h-10 bg-transparent border-none"
            )}
          >
            <AnimatePresence mode="wait">
              {isMenuOpen ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                  <X size={24} className="text-white" />
                </motion.div>
              ) : (
                <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} className="flex flex-col gap-1.5 items-center">
                  <span className="w-6 h-[2px] bg-neutral-900/40 block" />
                  <span className="w-4 h-[2px] bg-neutral-900/40 block ml-auto" />
                  <span className="w-6 h-[2px] bg-neutral-900/40 block" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </nav>
      </header>

      {/* Full Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="full-menu-overlay z-[99999]"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 max-w-4xl p-10">
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
                    "w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-500 border border-white/10 bg-white/5 group-hover:bg-amber-500 group-hover:text-black group-hover:scale-110 group-hover:-rotate-3 shadow-2xl",
                    activeTab === item.id && "bg-white/10 border-amber-500/50"
                  )}>
                    {React.cloneElement(item.icon as React.ReactElement, { size: 32 })}
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
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-500 border border-red-500/20 bg-red-500/5 group-hover:bg-red-500 group-hover:text-white group-hover:scale-110 shadow-2xl">
                  <LogOut size={32} />
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

