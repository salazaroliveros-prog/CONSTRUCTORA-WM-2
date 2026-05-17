import React, { forwardRef } from "react";
import { cn } from "../../utils/cn";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, required, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-[10px] font-bold text-(--color-neutral-500) uppercase tracking-wider">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <select
        ref={ref}
        className={cn(
          "w-full bg-(--color-surface-solid) border border-(--color-border) rounded-(--radius-lg) px-4 py-2.5 text-sm font-medium text-(--color-neutral-800)",
          "appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\") right 0.75rem center/12px no-repeat",
          "outline-none transition-all duration-200 focus:border-(--color-secondary) focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-secondary)_10%,transparent)]",
          "hover:border-(--color-border-hover) cursor-pointer",
          error && "border-(--color-error) focus:border-(--color-error)",
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-[9px] text-error font-medium">{error}</p>
      )}
    </div>
  )
);

Select.displayName = "Select";

