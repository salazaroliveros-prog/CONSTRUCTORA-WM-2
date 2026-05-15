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
        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          "w-full bg-white/80 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-800",
          "placeholder:text-neutral-300 outline-none transition-all duration-200 resize-vertical min-h-[80px]",
          "focus:border-secondary focus:ring-2 focus:ring-secondary/10",
          error && "border-error focus:border-error focus:ring-error/10",
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