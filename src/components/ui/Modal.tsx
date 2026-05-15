import React, { forwardRef } from "react";
import { cn } from "../../utils/cn";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
}

const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  {
    isOpen,
    onClose,
    title,
    description,
    children,
    size = "md",
    showCloseButton = true,
    closeOnOverlayClick = true,
  }: ModalProps,
  ref
) {
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
      setTimeout(() => {
        document.body.style.overflow = "";
      }, 200);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses: Record<string, string> = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-full max-h-full",
  };

  const handleOverlayClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[200] transition-all duration-300",
          isAnimating ? "bg-black/40 backdrop-blur-sm" : "bg-black/0 backdrop-blur-none"
        )}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      <div
        className={cn(
          "fixed inset-0 z-[201] flex items-center justify-center p-4",
          "overflow-y-auto"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
      >
        <div
            className={cn(
              "relative w-full rounded-2xl glass-card border border-[var(--color-neutral-100)] shadow-2xl transition-all duration-200",
              sizeClasses[size],
              isAnimating
                ? "scale-100 translate-y-0 opacity-100"
                : "scale-95 translate-y-4 opacity-0"
            )}
            onClick={(e) => e.stopPropagation()}
            ref={ref}
          >
          {(title || description || showCloseButton) && (
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-neutral-100)]">
              <div>
                {title && (
                  <h3 className="text-base font-black text-[var(--color-neutral-900)] uppercase tracking-tight">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs font-medium text-[var(--color-neutral-500)] mt-0.5">
                    {description}
                  </p>
                )}
              </div>
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="p-2 text-[var(--color-neutral-400)] hover:text-neutral-600 hover:bg-[var(--color-neutral-100)] rounded-xl transition-colors"
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
          <div className="p-6">{children}</div>
        </div>
      </div>
    </>
  );
});

Modal.displayName = "Modal";
export { Modal };