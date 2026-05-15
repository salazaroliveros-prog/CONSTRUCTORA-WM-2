import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from '../../utils/cn';
import { Search, Maximize, HelpCircle, Bell, User, X, ChevronUp, Sparkles, Settings } from "lucide-react";
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
  const [showAI, setShowAI] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("es-GT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <header className="h-14 sm:h-16 backdrop-blur-xl bg-[var(--color-surface)]/80 dark:bg-[var(--color-surface-dark)]/80 border-b border-[var(--color-border)]/50 px-3 sm:px-5 flex items-center gap-3 shrink-0 z-30 transition-colors duration-300">
      {/* Left Section: Quick Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Mobile menu toggle would go here */}
        <button
          onClick={onOpenSearch}
          className="hidden lg:flex items-center gap-2 bg-[var(--color-neutral-50)] border border-[var(--color-border)] px-3 py-1.5 rounded-xl text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)] hover:border-neutral-300 transition-all focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/10 w-48 lg:w-56 group"
        >
          <Search className="h-4 w-4 group-focus-within:text-secondary shrink-0" />
          <span className="text-xs font-medium group-focus-within:hidden truncate">
            Buscar...
          </span>
          <span className="hidden text-[9px] font-bold text-[var(--color-neutral-400)] group-focus-within:block ml-auto">
            ⌘K
          </span>
        </button>

        {/* Mobile search icon */}
        <button
          onClick={onOpenSearch}
          className="lg:hidden p-2 text-[var(--color-neutral-500)] hover:text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)] rounded-lg transition-colors"
          aria-label="Buscar"
        >
          <Search size={18} />
        </button>
      </div>

      {/* Center: Breadcrumbs & Clock */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        <div className="hidden md:block text-center">
          <p className="text-[10px] sm:text-xs font-bold text-neutral-900 uppercase tracking-[0.15em] truncate max-w-[400px]">
            {companyName}
          </p>
          <p className="text-[8px] sm:text-[9px] font-medium text-[var(--color-neutral-400)] uppercase tracking-wider">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={b.label}>
                {i > 0 && <span className="mx-1 text-neutral-300">/</span>}
                {b.href ? (
                  <a href={b.href} className="hover:text-secondary">{b.label}</a>
                ) : (
                  <span className="text-[var(--color-neutral-500)]">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </p>
        </div>
      </div>

      {/* Right Section: Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Clock */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-[var(--color-neutral-50)] rounded-lg">
          <span className="text-[10px] font-mono font-bold text-[var(--color-neutral-500)]">
            {formatTime(currentTime)}
          </span>
        </div>

        {/* Fullscreen */}
        <Tooltip content="Pantalla completa">
          <button
            onClick={onToggleFullscreen}
            className="hidden sm:flex p-2 text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] rounded-lg transition-colors"
            aria-label="Pantalla completa"
          >
            <Maximize size={16} />
          </button>
        </Tooltip>

        {/* Help */}
        <Tooltip content="Ayuda">
          <button
            className="hidden sm:flex p-2 text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] rounded-lg transition-colors"
            aria-label="Ayuda"
          >
            <HelpCircle size={16} />
          </button>
        </Tooltip>

        {/* AI Assistant */}
        <Tooltip content="Asistente IA">
          <button
            onClick={onOpenAI}
            className={cn(
              "relative p-2 rounded-lg transition-colors",
              showAI
                ? "bg-primary/10 text-primary"
                : "text-[var(--color-neutral-400)] hover:text-[var(--color-secondary)] hover:bg-[color-mix(in_srgb,var(--color-secondary)_8%,transparent)]"
            )}
            aria-label="Asistente IA"
          >
            <Sparkles size={16} />
            {showAI && (
              <motion.span
                className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--color-secondary)] rounded-full"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              />
            )}
          </button>
        </Tooltip>

        {/* Notifications */}
        <div className="relative">
          <Tooltip content={`${unreadCount} notificaciones`}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg transition-colors text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)]"
              aria-label="Notificaciones"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <motion.span
                  className="absolute -top-1 -right-1 w-2 h-2 bg-error border border-[var(--color-neutral-200)] rounded-full"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                />
              )}
            </button>
          </Tooltip>

          {/* Notification dropdown — would use AnimatePresence for full animation */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-surface border border-border shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Notificaciones</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {/* Notification items would be mapped here */}
                <div className="px-4 py-3 border-b border-[var(--color-border)]/50 text-sm text-[var(--color-neutral-600)]">
                  No hay notificaciones nuevas
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />

        {/* User avatar */}
        <div className="flex items-center gap-2 pl-1">
          {userPhoto ? (
            <img
              src={userPhoto}
              alt="Foto de perfil"
              className="w-8 h-8 rounded-lg object-cover ring-2 ring-border"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[var(--color-neutral-50)] flex items-center justify-center text-white text-xs font-black shadow-sm">
              {userName?.charAt(0)?.toUpperCase() || "W"}
            </div>
          )}
          <div className="hidden sm:block text-right min-w-0">
            <p className="text-[10px] font-bold text-[var(--color-neutral-700)] truncate">{userName || "Usuario"}</p>
            <p className="text-[8px] font-medium text-[var(--color-neutral-400)] uppercase tracking-wider">Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
}