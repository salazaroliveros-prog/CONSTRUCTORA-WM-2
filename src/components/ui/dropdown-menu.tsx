import React, { useState, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { cn } from "../../utils/cn";
import { MoreVertical } from "lucide-react";

interface DropdownMenuProps {
  children: React.ReactNode;
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "bottom" | "top" | "left" | "right";
}

interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  shortcut?: string;
  destructive?: boolean;
}

interface DropdownMenuGroupProps {
  children: React.ReactNode;
  label?: string;
}

function DropdownMenu({
  children,
  trigger,
  align = "start",
  side = "bottom",
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    },
    []
  );

  React.useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative inline-flex" ref={triggerRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            ref={menuRef}
            className={cn(
              "absolute z-50 min-w-32 bg-(--color-surface) border border-(--color-border) rounded-xl shadow-xl py-1 overflow-hidden",
              align === "end" && "right-0",
              align === "center" && "left-1/2 -translate-x-1/2",
              side === "top" && "bottom-full mb-1",
              side === "bottom" && "mt-1"
            )}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            role="menu"
          >
            {children}
          </motion.div>
        </>
      )}
    </div>
  );
}

function DropdownMenuItem({
  children,
  onClick,
  disabled,
  icon,
  shortcut,
  destructive,
}: DropdownMenuItemProps) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onClick?.();
      }}
      className={cn(
        "flex items-center w-full px-4 py-2 text-sm transition-colors",
        disabled
          ? "text-(--color-neutral-400) cursor-not-allowed"
          : destructive
          ? "text-error hover:bg-error/10"
          : "text-neutral-700 hover:bg-(--color-neutral-50)",
        icon && "gap-3"
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1 text-left">{children}</span>
      {shortcut && (
        <span className="text-xs text-neutral-400 ml-auto">{shortcut}</span>
      )}
    </button>
  );
}

function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}

function DropdownMenuGroup({ children, label }: DropdownMenuGroupProps) {
  return (
    <div className="py-1">
      {label && (
        <p className="px-4 text-[10px] font-bold text-(--color-neutral-400) uppercase tracking-wider mb-1">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}

export { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuGroup };

