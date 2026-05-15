import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from '../../utils/cn';
import { X, ChevronUp } from "lucide-react";

interface MobileNavProps {
  menuItems: Array<{
    id: string;
    label: string;
    labelMobile: string;
    icon: React.ReactNode;
    iconMobile: React.ReactNode;
    active: boolean;
    onClick: (id: string) => void;
  }>;
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ menuItems, isOpen, onClose }: MobileNavProps) {
  return (
    <AnimatePresence mode="wait">
      {isOpen ? (
        <motion.div
          key="nav-open"
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-49"
        >
          {/* Background backdrop */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <div className="relative flex items-center justify-center pb-2 pt-1">
            <div className="flex items-stretch overflow-x-auto overflow-y-hidden no-scrollbar gap-0.5 px-1.5 py-1 rounded-t-2xl bg-surface border border-border shadow-[0_-4px_24px_rgba(0,0,0,0.1)] max-w-lg mx-auto w-[calc(100%-1rem)]">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.onClick(item.id);
                    onClose();
                  }}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 min-w-[3rem] flex-shrink-0 py-1.5 px-2 rounded-xl transition-all duration-200",
                    "hover:bg-neutral-50 hover:scale-[1.1] active:scale-95",
                    item.active
                      ? "text-primary font-bold"
                      : "text-neutral-400 hover:text-neutral-700"
                  )}
                  aria-label={item.label}
                  type="button"
                >
                  {/* Active indicator */}
                  {item.active && (
                    <motion.div
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary"
                      layoutId="mobileNavIndicator"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}

                  <span className="drop-shadow-sm">{item.iconMobile || item.icon}</span>
                  <span
                    className={cn(
                      "text-[6px] font-bold uppercase tracking-wider leading-none whitespace-nowrap",
                      item.active ? "text-primary" : "text-inherit"
                    )}
                  >
                    {item.labelMobile || item.label}
                  </span>
                </button>
              ))}

              {/* Close button */}
              <button
                onClick={onClose}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-all shrink-0 ml-1"
                aria-label="Cerrar menú"
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.button
          key="nav-closed"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          onClick={onClose} // Reuse to toggle open
          className="fixed bottom-4 left-1/2 z-49 -translate-x-1/2 w-12 h-12 rounded-full bg-surface border border-border/50 backdrop-blur-md shadow-lg flex items-center justify-center hover:scale-110 hover:shadow-xl active:scale-95 transition-all duration-200"
          aria-label="Abrir navegación"
          type="button"
        >
          <ChevronUp size={20} className="text-neutral-500" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}