import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "../../utils/cn";
import { Search } from "lucide-react";

interface CommandMenuProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
}

interface CommandInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

interface CommandGroupProps {
  children: React.ReactNode;
  heading?: string;
}

interface CommandItemProps {
  children: React.ReactNode;
  onSelect: () => void;
  className?: string;
}

interface CommandEmptyProps {
  children: React.ReactNode;
}

// Main Command Menu
function CommandMenu({
  children,
  open,
  onOpenChange,
  placeholder = "Buscar...",
}: CommandMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
        if (!open) setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100" onClick={() => onOpenChange(false)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative flex items-start justify-center pt-[15vh] px-4">
        <div
          className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center border-b border-border px-4">
            <Search className="h-5 w-5 text-neutral-400 mr-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
className="flex-1 h-12 bg-transparent outline-none text-sm text-neutral-800 placeholder:text-neutral-400"
              onChange={(e) => {
                // Parent should handle this via children props
              }}
            />
            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-neutral-200 bg-neutral-50 px-1.5 font-mono text-[10px] text-neutral-400">
              ⌘K
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-y-auto scroll-smooth">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// Command Input (for external control)
function CommandInput({ value, onValueChange, placeholder, ...props }: CommandInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 h-12 bg-transparent outline-none text-sm text-neutral-800 placeholder:text-neutral-400"
      {...props}
    />
  );
}

// Command Group
function CommandGroup({ children, heading }: CommandGroupProps) {
  if (!heading) return <div className="py-1">{children}</div>;
  return (
    <div className="py-1">
      <p className="px-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
        {heading}
      </p>
      {children}
    </div>
  );
}

// Command Item
function CommandItem({ children, onSelect, className }: CommandItemProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex items-center w-full px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors",
        className
      )}
    >
      {children}
    </button>
  );
}

// Command Separator
function CommandSeparator() {
  return <div className="my-1 h-px bg-border" />;
}

// Command Empty
function CommandEmpty({ children }: CommandEmptyProps) {
  return (
    <div className="py-6 text-center text-sm text-neutral-400">
      {children}
    </div>
  );
}

export {
  CommandMenu,
  CommandInput,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandEmpty,
};

