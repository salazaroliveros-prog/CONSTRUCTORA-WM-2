import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../utils/cn";

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  side?: "left" | "right" | "top" | "bottom";
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
}

const sizeVariants = {
  sm: "w-64",
  md: "w-80",
  lg: "w-[36rem]",
  xl: "w-[48rem]",
  full: "w-full",
};

const sideVariants = {
  left: { x: "-100%", y: 0 },
  right: { x: "100%", y: 0 },
  top: { x: 0, y: "-100%" },
  bottom: { x: 0, y: "100%" },
};

export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  side = "right",
  size = "md",
  showCloseButton = true,
}: SheetProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const prevOpen = useRef(isOpen);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
      setTimeout(() => {
        document.body.style.overflow = "";
      }, 200);
    }
    prevOpen.current = isOpen;
  }, [isOpen]);

  if (!isOpen && !prevOpen.current) return null;

  const isHorizontal = side === "left" || side === "right";

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: isAnimating ? 1 : 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-hidden="true"
      />

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            className={cn(
              "fixed z-[201] bg-surface border border-border shadow-2xl rounded-tl-2xl rounded-bl-2xl flex flex-col",
              isHorizontal ? "h-full" : "w-full",
              sizeVariants[size],
              {
                left: "left-0 top-0",
                right: "right-0 top-0",
                top: "top-0 left-0",
                bottom: "bottom-0 left-0",
              }[side]
            )}
            initial={sideVariants[side]}
            animate={{ x: 0, y: 0 }}
            exit={sideVariants[side]}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            role="dialog"
            aria-label={title || "Panel"}
          >
            {/* Header */}
            {(title || description || showCloseButton) && (
              <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
                <div>
                  {title && (
                    <h3 className="text-base font-black text-[var(--color-neutral-900)] uppercase tracking-tight">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="text-[10px] font-medium text-[var(--color-neutral-500)] mt-0.5">
                      {description}
                    </p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-2 text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-100)] rounded-xl transition-colors"
                    aria-label="Cerrar"
                    type="button"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto scroll-smooth p-6">
              {children}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}