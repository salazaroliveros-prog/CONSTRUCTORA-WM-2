import React, { useState } from "react";
import { motion } from "motion/react";
import { cn } from '../../utils/cn';
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip } from "../ui/tooltip";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  isCollapsed: boolean;
  badge?: number;
  onClick: () => void;
}

function NavItem({ icon, label, isActive, isCollapsed, badge, onClick }: NavItemProps) {
  return (
    <Tooltip content={isCollapsed ? label : ""} side="right">
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-left overflow-hidden",
          isActive
            ? "bg-primary/10 text-primary font-bold shadow-sm"
            : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
        )}
      >
        <span className={cn(
          "shrink-0 transition-transform duration-200",
          isActive && "scale-110"
        )}>
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
  children: React.ReactNode;
}

function NavGroup({ title, collapsed, children }: NavGroupProps) {
  if (collapsed) {
    return <div className="space-y-0.5">{children}</div>;
  }
  return (
    <div className="mb-1">
      <p className="px-3 text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
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
  // Import nav items config
  const navGroups = [
    {
      title: "Operaciones",
      items: [
        { id: "dashboard", label: "Dashboard", icon: <LayoutDashboardIcon /> },
        { id: "execution", label: "Bitácora", icon: <ClipboardListIcon /> },
        { id: "projects", label: "Proyectos", icon: <Building2Icon />, badge: 3 },
      ],
    },
    {
      title: "Gestión",
      items: [
        { id: "clients", label: "Clientes", icon: <UsersIcon /> },
        { id: "suppliers", label: "Proveedores", icon: <TruckIcon /> },
        { id: "inventory", label: "Inventario", icon: <PackageIcon /> },
        { id: "staff", label: "Recursos Humanos", icon: <HardHatIcon /> },
      ],
    },
    {
      title: "Análisis",
      items: [
        { id: "analytics", label: "Analíticas", icon: <BarChartIcon /> },
        { id: "seguimiento", label: "Seguimiento", icon: <TrendingUpIcon /> },
        { id: "gantt", label: "Diagrama Gantt", icon: <CalendarIcon /> },
      ],
    },
  ];

  return (
    <motion.nav
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "flex flex-col h-full border-r border-border/50 bg-white/90 backdrop-blur-xl z-20",
        "transition-colors duration-300"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-14 border-b border-border/50 px-3 shrink-0">
        <motion.div
          animate={{ width: isCollapsed ? 36 : 148 }}
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
      <div className="flex-1 overflow-y-auto py-3">
        {navGroups.map((group) => (
          <NavGroup key={group.title} title={group.title} collapsed={isCollapsed}>
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
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-center h-12 border-t border-border/50 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 transition-colors shrink-0"
        aria-label={isCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
      >
        <motion.span
          animate={{ rotate: isCollapsed ? 0 : 180 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronLeft size={18} />
        </motion.span>
      </button>
    </motion.nav>
  );
}

// Placeholder icons — reemplazar con lucide-react
function LayoutDashboardIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>; }
function ClipboardListIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="10" rx="2"/><path d="M16 8V6a4 4 0 0 0-8 0v2"/><line x1="10" y1="14" x2="10" y2="14.01"/><line x1="14" y1="14" x2="14" y2="14.01"/></svg>; }
function Building2Icon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><path d="M10 10h.01M10 14h.01M10 18h.01"/></svg>; }
function UsersIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function TruckIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>; }
function PackageIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 23 16V8z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function HardHatIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Z"/><path d="M10 10V7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3"/><path d="M17 14.56V10a5 5 0 0 0-10 0v4.56"/><path d="M4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1H3v1Z"/></svg>; }
function BarChartIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M7 16h2v5H7zM11 11h2v10h-2zM15 8h2v13h-2zM19 5h2v16h-2z"/></svg>; }
function TrendingUpIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>; }
function CalendarIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }