import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, Building2, ClipboardList, TrendingUp, 
  Calendar, Package, HardHat, BarChart3, 
  Sparkles, Settings, LogOut, ChevronRight, ChevronDown, Home
} from "lucide-react";
import { cn } from "../../utils/cn";
import { useAuth } from "../../contexts/AuthContext";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  children?: NavItem[];
}

const MENU_CONFIG: NavItem[] = [
  { id: "dashboard", label: "Inicio", icon: Home },
  { id: "projects", label: "Proyectos", icon: Building2, children: [
    { id: "execution", label: "Bitácora", icon: ClipboardList },
    { id: "gantt", label: "Gantt", icon: Calendar },
    { id: "pert", label: "PERT", icon: BarChart3 }
  ]},
  { id: "seguimiento", label: "Seguimiento", icon: TrendingUp },
  { id: "inventory", label: "Stock", icon: Package },
  { id: "staff", label: "Personal", icon: HardHat },
  { id: "analytics", label: "Analíticas", icon: BarChart3 },
  { id: "ai", label: "Calculadora", icon: Sparkles },
  { id: "settings", label: "Ajustes", icon: Settings },
];

interface SidebarNavigationProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function SidebarNavigation({ activeTab, onNavigate, isOpen, onToggle }: SidebarNavigationProps) {
  const { signOut } = useAuth();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const handleNavigate = (id: string) => {
    onNavigate(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className={cn(
      "fixed left-0 top-0 bottom-0 z-[9999] bg-[#0c1222] border-r border-white/5 transition-all duration-500 overflow-hidden flex flex-col",
      isOpen ? "w-64" : "w-20"
    )}>
      {/* Logo & Toggle */}
      <div className="h-20 flex items-center justify-between px-6 border-b border-white/5 shrink-0">
        <img src="/logo.png" alt="WM" className={cn("h-8 transition-opacity duration-300", isOpen ? "opacity-100" : "opacity-0")} />
        <button onClick={onToggle} className="text-white/40 hover:text-amber-500 transition-colors">
          {isOpen ? <ChevronRight className="rotate-180" /> : <ChevronRight />}
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
        {MENU_CONFIG.map((item) => {
          const isActive = activeTab === item.id || (item.children?.some(c => c.id === activeTab));
          const hasChildren = item.children && item.children.length > 0;

          return (
            <li key={item.id}>
              <button 
                onClick={() => hasChildren ? setOpenGroup(openGroup === item.id ? null : item.id) : handleNavigate(item.id)}
                className={cn(
                  "w-full flex items-center p-3 rounded-2xl transition-all duration-300 font-black uppercase text-[10px] tracking-widest",
                  isActive ? "bg-amber-500 text-black" : "text-white/40 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon size={20} className="shrink-0" />
                <span className={cn("ml-3 transition-opacity duration-300", isOpen ? "opacity-100" : "opacity-0 hidden")}>
                  {item.label}
                </span>
                {hasChildren && isOpen && (
                  <span className="ml-auto">
                    {openGroup === item.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                )}
              </button>
              
              {/* Acordeón */}
              {hasChildren && openGroup === item.id && isOpen && (
                <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="ml-4 pl-4 border-l border-white/10 mt-1 space-y-1">
                  {item.children.map(sub => (
                    <li key={sub.id}>
                      <button onClick={() => handleNavigate(sub.id)} className={cn(
                        "block w-full text-left py-2 text-[9px] font-bold uppercase tracking-widest transition-colors",
                        activeTab === sub.id ? "text-amber-500" : "text-white/30 hover:text-white"
                      )}>
                        {sub.label}
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* Footer Exit */}
      <div className="p-4 border-t border-white/5">
        <button 
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 p-3 rounded-2xl text-red-400/60 hover:text-red-400 hover:bg-red-900/10 transition-all font-black uppercase text-[10px] tracking-widest"
        >
          <LogOut size={20} />
          <span className={cn("transition-opacity duration-300", isOpen ? "opacity-100" : "opacity-0 hidden")}>Salir</span>
        </button>
      </div>
    </nav>
  );
}
