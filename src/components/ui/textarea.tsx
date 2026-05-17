import React, { forwardRef } from "react";
import { cn } from "../../utils/cn";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, required, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-[10px] font-bold text-(--color-neutral-500) uppercase tracking-wider">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          "w-full bg-(--color-surface-solid) border border-(--color-border) rounded-xl px-4 py-2.5 text-sm font-medium text-(--color-neutral-800)",
          "placeholder:text-(--color-neutral-400) outline-none transition-all duration-200 resize-vertical min-h-20",
          "focus:border-(--color-secondary) focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-secondary)_10%,transparent)]",
          error && "border-(--color-error) focus:border-(--color-error) focus:ring-[color-mix(in_srgb,var(--color-error)_10%,transparent)]",
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

Textarea.displayName = "Textarea";

