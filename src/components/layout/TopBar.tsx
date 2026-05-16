import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from '../../utils/cn';
import {
  Search, Maximize, HelpCircle, Bell, User, Sparkles,
  Settings, LogOut, ChevronDown, FileText
} from "lucide-react";
import { Tooltip } from "../ui/tooltip";
import TopBarClock from "./TopBarClock";

interface TopBarProps {
  onToggleFullscreen: () => void;
  onOpenNotifications: () => void;
  unreadCount: number;
  onOpenAI: () => void;
  onOpenSearch: () => void;
  userName: string;
  userPhoto?: string;
  companyName: string;
  breadcrumbs?: { label: string; href?: string }[];
}

export function TopBar({
  onToggleFullscreen,
  onOpenNotifications,
  unreadCount,
  onOpenAI,
  onOpenSearch,
  userName,
  userPhoto,
  companyName,
  breadcrumbs = [],
}: TopBarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const formatDate = (date: Date) =>
    date.toLocaleDateString("es-GT", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

  return (
    <header className="h-14 sm:h-16 backdrop-blur-xl bg-surface/80 border-b border-border/50 px-3 sm:px-5 flex items-center gap-2 shrink-0 z-30">
      {/* Left: Search */}
      <div className="flex items-center gap-1 shrink-0 min-w-0">
        <div className={cn(
          "hidden lg:flex items-center gap-2 bg-neutral-50 border border-border rounded-xl px-3 py-1.5 transition-all duration-200",
          searchFocused ? "border-secondary ring-2 ring-secondary/10 w-64" : "w-48 hover:border-neutral-300"
        )}>
          <Search size={16} className={cn("shrink-0 transition-colors", searchFocused ? "text-secondary" : "text-neutral-400")} />
          <input
            type="text"
            placeholder="Buscar proyectos, clientes..."
            className="bg-transparent border-none outline-none text-xs font-medium text-neutral-700 placeholder:text-neutral-400 w-full"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="hidden sm:inline text-[9px] font-bold text-neutral-400 bg-neutral-200/50 px-1.5 py-0.5 rounded shrink-0">⌘K</kbd>
        </div>
        <button
          onClick={onOpenSearch}
          className="lg:hidden p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
          aria-label="Buscar"
        >
          <Search size={18} />
        </button>
      </div>

      {/* Center: Breadcrumbs */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        <div className="hidden md:block text-center">
          <p className="text-[10px] sm:text-xs font-bold text-neutral-900 uppercase tracking-[0.15em] truncate max-w-[400px]">
            {companyName}
          </p>
          <p className="text-[8px] sm:text-[9px] font-medium text-neutral-400 uppercase tracking-wider">
            {breadcrumbs.length > 0 ? (
              breadcrumbs.map((b, i) => (
                <React.Fragment key={b.label}>
                  {i > 0 && <span className="mx-1 text-neutral-300">/</span>}
                  {b.href ? (
                    <a href={b.href} className="hover:text-secondary transition-colors">{b.label}</a>
                  ) : (
                    <span className="text-neutral-500">{b.label}</span>
                  )}
                </React.Fragment>
              ))
            ) : (
              <span className="text-neutral-400">Panel de Control</span>
            )}
          </p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Quick Actions Bar */}
        <div className="hidden sm:flex items-center gap-0.5 px-1 py-1 bg-neutral-50 rounded-lg">
          {/* Date */}
          <div className="hidden xl:block px-2">
            <span className="text-[9px] font-medium text-neutral-500 whitespace-nowrap capitalize">
              {formatDate(currentTime)}
            </span>
          </div>
          {/* Clock */}
          <div className="px-2 py-0.5 bg-white rounded-md shadow-sm border border-border/50">
            <span className="text-[10px] font-mono font-bold text-neutral-600">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

        {/* Fullscreen */}
        <Tooltip content="Pantalla completa">
          <button
            onClick={onToggleFullscreen}
            className="hidden sm:flex p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="Pantalla completa"
          >
            <Maximize size={16} />
          </button>
        </Tooltip>

        {/* Help */}
        <Tooltip content="Ayuda y guías">
          <button className="hidden sm:flex p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors relative group">
            <HelpCircle size={16} />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-secondary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </Tooltip>

        {/* AI Assistant */}
        <Tooltip content="Asistente IA">
          <button
            onClick={onOpenAI}
            className="relative p-2 rounded-lg transition-colors text-neutral-400 hover:text-secondary hover:bg-secondary/5 group"
            aria-label="Asistente IA"
          >
            <Sparkles size={16} className="group-hover:animate-pulse" />
            <motion.span
              className="absolute -top-1 -right-1 w-2 h-2 bg-secondary rounded-full"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </button>
        </Tooltip>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <Tooltip content={`${unreadCount > 0 ? `${unreadCount} notificaciones` : 'Sin notificaciones'}`}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg transition-colors text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
              aria-label="Notificaciones"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <motion.span
                  className="absolute -top-1 -right-1 w-2 h-2 bg-error border border-white rounded-full"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                />
              )}
            </button>
          </Tooltip>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 rounded-2xl bg-surface border border-border shadow-xl z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Notificaciones</p>
                  <span className="text-[9px] font-medium text-neutral-400">{unreadCount} nuevas</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div className="px-4 py-6 text-center">
                    <Bell size={24} className="mx-auto mb-2 text-neutral-300" />
                    <p className="text-sm text-neutral-500">No hay notificaciones nuevas</p>
                    <p className="text-[10px] text-neutral-400 mt-1">Las alertas aparecerán aquí</p>
                  </div>
                </div>
                <div className="px-4 py-2 border-t border-border bg-neutral-50">
                  <button className="w-full text-[10px] font-bold text-neutral-500 uppercase tracking-wider hover:text-neutral-700 transition-colors">
                    Ver todas
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-neutral-50 transition-colors group"
          >
            {userPhoto ? (
              <img
                src={userPhoto}
                alt=""
                className="w-7 h-7 rounded-lg object-cover ring-2 ring-border group-hover:ring-neutral-300 transition-all"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-[10px] font-black shadow-sm">
                {userName?.charAt(0)?.toUpperCase() || "W"}
              </div>
            )}
            <div className="hidden sm:block text-right min-w-0">
              <p className="text-[10px] font-bold text-neutral-700 truncate max-w-[100px]">{userName || "Usuario"}</p>
              <p className="text-[8px] font-medium text-neutral-400 uppercase tracking-wider">Admin</p>
            </div>
            <motion.span animate={{ rotate: showUserMenu ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={12} className="text-neutral-400" />
            </motion.span>
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface border border-border shadow-xl z-50 overflow-hidden"
              >
                {/* User info header */}
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-bold text-neutral-800 truncate">{userName}</p>
                  <p className="text-[10px] text-neutral-500 truncate">Administrador del sistema</p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                    <User size={15} className="text-neutral-400" />
                    Mi Perfil
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                    <Settings size={15} className="text-neutral-400" />
                    Configuración
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                    <FileText size={15} className="text-neutral-400" />
                    Reportes Rápidos
                  </button>
                </div>

                <div className="border-t border-border py-1">
                  <button
                    onClick={() => {}}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error/5 transition-colors"
                  >
                    <LogOut size={15} />
                    Cerrar Sesión
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
