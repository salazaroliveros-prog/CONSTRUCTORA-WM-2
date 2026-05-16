import React, { useState, useRef, useCallback } from "react";
import { cn } from "../../utils/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  required?: boolean;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, required, wrapperClassName, ...props }, ref) => {
    const inputId = `input-${Math.random().toString(36).slice(2)}`;

    return (
      <div className={cn("space-y-1.5", wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="block text-[10px] font-bold text-[var(--color-neutral-500)] uppercase tracking-wider">
            {label}
            {required && <span className="text-error ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral-400)] pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={hint || error ? `${inputId}-hint` : undefined}
            className={cn(
              "w-full glass-input placeholder:text-white/40",
              icon && "pl-10",
              error && "border-red-500/50 focus:border-red-500 focus:bg-red-500/10",
              props.disabled && "opacity-50 cursor-not-allowed",
              className
            )}
            {...props}
          />
        </div>
        {(hint || error) && (
          <p id={`${inputId}-hint`} className={cn("text-[9px] font-medium mt-0.5", error ? "text-error" : "text-[var(--color-neutral-400)]")}>
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

