import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from '../../utils/cn';
import {
  ChevronLeft, ChevronDown,
  LayoutDashboard, ClipboardList, Building2, Users, Truck, Package, HardHat,
  BarChart3, TrendingUp, Calendar, GitBranch, LineChart, Sparkles, HelpCircle, Settings
} from "lucide-react";

const dotColorMap: Record<string, string> = {
  dashboard: "bg-violet-500",
  execution: "bg-cyan-500",
  projects: "bg-amber-500",
  clients: "bg-blue-500",
  suppliers: "bg-rose-500",
  inventory: "bg-emerald-500",
  staff: "bg-purple-500",
  analytics: "bg-indigo-500",
  seguimiento: "bg-pink-500",
  gantt: "bg-orange-500",
  pert: "bg-purple-500",
  "fisico-financiero": "bg-lime-500",
  ai: "bg-teal-500",
};

const iconColorMap: Record<string, string> = {
  dashboard: "text-violet-400",
  execution: "text-cyan-400",
  projects: "text-amber-400",
  clients: "text-blue-400",
  suppliers: "text-rose-400",
  inventory: "text-emerald-400",
  staff: "text-purple-400",
  analytics: "text-indigo-400",
  seguimiento: "text-pink-400",
  gantt: "text-orange-400",
  pert: "text-purple-400",
  "fisico-financiero": "text-lime-400",
  ai: "text-teal-400",
};

interface NavItemProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  isCollapsed: boolean;
  accent?: string;
  onClick: () => void;
}

function NavItem({ id, icon, label, isActive, isCollapsed, onClick }: NavItemProps) {
  const dotColor = dotColorMap[id] || "bg-amber-500";
  const iconColor = iconColorMap[id] || "text-amber-400";
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={cn(
          "sidebar-item",
          isActive && "active"
        )}
      >
        <span className={cn("shrink-0 transition-transform duration-200", isActive && "scale-110", iconColor)}>
          {icon}
        </span>
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="whitespace-nowrap text-sm font-medium truncate flex-1"
          >
            {label}
          </motion.span>
        )}
        {isActive && !isCollapsed && (
          <motion.span
            layoutId="activeDot"
            className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
      </button>
    </div>
  );
}

interface NavGroupProps {
  title: string;
  collapsed: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function NavGroup({ title, collapsed, defaultOpen = true, children }: NavGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  if (collapsed) {
    return <div className="space-y-0.5 mb-3">{children}</div>;
  }
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="sidebar-group-title w-full flex items-center justify-between hover:opacity-80 transition-opacity"
      >
        <span>{title}</span>
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={10} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 pt-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SidebarProps {
  isCollapsed: boolean;
  activeTab: string;
  onNavigate: (tab: string) => void;
  onToggleCollapse: () => void;
}

export function Sidebar({ isCollapsed, activeTab, onNavigate, onToggleCollapse }: SidebarProps) {
  const navGroups = [
    {
      title: "Operaciones",
      defaultOpen: true,
      items: [
        { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
        { id: "execution", label: "Bitácora", icon: <ClipboardList size={18} /> },
        { id: "projects", label: "Proyectos", icon: <Building2 size={18} /> },
      ],
    },
    {
      title: "Gestión",
      defaultOpen: true,
      items: [
        { id: "clients", label: "Clientes", icon: <Users size={18} /> },
        { id: "suppliers", label: "Proveedores", icon: <Truck size={18} /> },
        { id: "inventory", label: "Inventario", icon: <Package size={18} /> },
        { id: "staff", label: "Recursos Humanos", icon: <HardHat size={18} /> },
      ],
    },
    {
      title: "Planificación & Control",
      defaultOpen: true,
      items: [
        { id: "gantt", label: "Gantt", icon: <Calendar size={18} /> },
        { id: "pert", label: "PERT / CPM", icon: <GitBranch size={18} /> },
        { id: "fisico-financiero", label: "Físico-Financiero", icon: <LineChart size={18} /> },
      ],
    },
    {
      title: "Análisis",
      defaultOpen: false,
      items: [
        { id: "analytics", label: "Analíticas", icon: <BarChart3 size={18} /> },
        { id: "seguimiento", label: "Seguimiento", icon: <TrendingUp size={18} /> },
      ],
    },
    {
      title: "Sistema",
      defaultOpen: false,
      items: [
        { id: "ai", label: "Calc. Presupuestos", icon: <Sparkles size={18} /> },
        { id: "settings", label: "Ajustes", icon: <Settings size={18} /> },
      ],
    },
  ];

  return (
    <motion.nav
      animate={{ width: isCollapsed ? 64 : 248 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="sidebar flex flex-col h-full z-20"
    >
      {/* Logo */}
      <div className="sidebar-logo flex items-center justify-center h-14 px-3 shrink-0">
        <motion.div
          animate={{ width: isCollapsed ? 36 : 160 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2.5 overflow-hidden"
        >
          <img src="/logo.png" alt="WM" className="w-8 h-8 object-contain" />
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="text-sm font-black text-white/90 whitespace-nowrap tracking-tight"
            >
              Constructora
            </motion.span>
          )}
        </motion.div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto py-4 px-2.5 scrollbar-thin">
        {navGroups.map((group) => (
          <NavGroup key={group.title} title={group.title} collapsed={isCollapsed} defaultOpen={group.defaultOpen}>
            {group.items.map((item) => (
              <NavItem
                key={item.id}
                id={item.id}
                icon={item.icon}
                label={item.label}
                isActive={activeTab === item.id}
                isCollapsed={isCollapsed}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </NavGroup>
        ))}

      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className="sidebar-collapse-btn"
        aria-label={isCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
      >
        <motion.span animate={{ rotate: isCollapsed ? 0 : 180 }} transition={{ duration: 0.3 }}>
          <ChevronLeft size={18} />
        </motion.span>
      </button>
    </motion.nav>
  );
}
