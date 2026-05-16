import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from '../../utils/cn';
import {
  ChevronLeft, ChevronRight, ChevronDown,
  LayoutDashboard, ClipboardList, Building2, Users, Truck, Package, HardHat,
  BarChart3, TrendingUp, Calendar, GitBranch, LineChart, Sparkles, Settings, HelpCircle
} from "lucide-react";
import { Tooltip } from "../ui/tooltip";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  isCollapsed: boolean;
  accent?: string;
  badge?: number;
  onClick: () => void;
}

const accentMap: Record<string, string> = {
  dashboard: "blue",
  execution: "amber",
  projects: "violet",
  clients: "emerald",
  suppliers: "orange",
  inventory: "teal",
  staff: "pink",
  analytics: "cyan",
  seguimiento: "indigo",
  gantt: "rose",
  pert: "purple",
  "fisico-financiero": "lime",
  ai: "fuchsia",
  settings: "slate",
};

const accentClasses: Record<string, { active: string; inactive: string; dot: string }> = {
  blue:   { active: "bg-blue-50 text-blue-700 border-l-2 border-blue-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-blue-500" },
  amber:  { active: "bg-amber-50 text-amber-700 border-l-2 border-amber-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-amber-500" },
  violet: { active: "bg-violet-50 text-violet-700 border-l-2 border-violet-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-violet-500" },
  emerald:{ active: "bg-emerald-50 text-emerald-700 border-l-2 border-emerald-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-emerald-500" },
  orange: { active: "bg-orange-50 text-orange-700 border-l-2 border-orange-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-orange-500" },
  teal:   { active: "bg-teal-50 text-teal-700 border-l-2 border-teal-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-teal-500" },
  pink:   { active: "bg-pink-50 text-pink-700 border-l-2 border-pink-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-pink-500" },
  cyan:   { active: "bg-cyan-50 text-cyan-700 border-l-2 border-cyan-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-cyan-500" },
  indigo: { active: "bg-indigo-50 text-indigo-700 border-l-2 border-indigo-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-indigo-500" },
  rose:   { active: "bg-rose-50 text-rose-700 border-l-2 border-rose-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-rose-500" },
  purple: { active: "bg-purple-50 text-purple-700 border-l-2 border-purple-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-purple-500" },
  lime:   { active: "bg-lime-50 text-lime-700 border-l-2 border-lime-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-lime-500" },
  fuchsia:{ active: "bg-fuchsia-50 text-fuchsia-700 border-l-2 border-fuchsia-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-fuchsia-500" },
  slate:  { active: "bg-slate-50 text-slate-700 border-l-2 border-slate-500", inactive: "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50", dot: "bg-slate-500" },
};

function NavItem({ icon, label, isActive, isCollapsed, badge, onClick }: NavItemProps) {
  const ac = accentClasses[accentMap[label.toLowerCase()] || "blue"];
  return (
    <Tooltip content={isCollapsed ? label : ""} side="right">
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-left overflow-hidden group",
          isActive ? ac.active : ac.inactive
        )}
      >
        <span className={cn("shrink-0 transition-transform duration-200", isActive && "scale-110")}>
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
            className={cn("w-1.5 h-1.5 rounded-full shrink-0", ac.dot)}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        {badge && !isCollapsed && (
          <span className="ml-auto shrink-0 bg-error text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center">
            {badge}
          </span>
        )}
      </button>
    </Tooltip>
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
        className="w-full flex items-center justify-between px-3 py-1 text-[9px] font-bold text-neutral-400 uppercase tracking-widest hover:text-neutral-600 transition-colors"
      >
        <span>{title}</span>
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={12} />
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
            <div className="space-y-0.5 pt-1">{children}</div>
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
        { id: "projects", label: "Proyectos", icon: <Building2 size={18} />, badge: 3 },
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
  ];

  return (
    <motion.nav
      animate={{ width: isCollapsed ? 64 : 248 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col h-full border-r border-border/50 bg-surface/90 backdrop-blur-xl z-20"
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-14 border-b border-border/50 px-3 shrink-0">
        <motion.div
          animate={{ width: isCollapsed ? 36 : 160 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2.5 overflow-hidden"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-xs font-black shrink-0 shadow-md">
            WM
          </div>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="text-sm font-black text-primary whitespace-nowrap"
            >
              Constructora
            </motion.span>
          )}
        </motion.div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto py-4 px-2">
        {navGroups.map((group) => (
          <NavGroup key={group.title} title={group.title} collapsed={isCollapsed} defaultOpen={group.defaultOpen}>
            {group.items.map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                isActive={activeTab === item.id}
                isCollapsed={isCollapsed}
                badge={item.badge}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </NavGroup>
        ))}

        {/* Bottom spacer */}
        <div className="mt-6" />

        {/* Extra utility items when expanded */}
        {!isCollapsed && (
          <>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-all text-sm font-medium">
              <HelpCircle size={16} />
              Ayuda y Soporte
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-all text-sm font-medium">
              <Sparkles size={16} />
              Asistente IA
            </button>
          </>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-center h-12 border-t border-border/50 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 transition-colors shrink-0"
        aria-label={isCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
      >
        <motion.span animate={{ rotate: isCollapsed ? 0 : 180 }} transition={{ duration: 0.3 }}>
          <ChevronLeft size={18} />
        </motion.span>
      </button>
    </motion.nav>
  );
}
