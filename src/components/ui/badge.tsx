import React from "react";
import { cn } from "../../utils/cn";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "error" | "info" | "neutral" | "secondary";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "neutral",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const variants = {
    success: "bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-[var(--color-success)] border border-[color-mix(in_srgb,var(--color-success)_25%,transparent)]",
    warning: "bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] text-[var(--color-warning)] border border-[color-mix(in_srgb,var(--color-warning)_25%,transparent)]",
    error: "bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] text-[var(--color-error)] border border-[color-mix(in_srgb,var(--color-error)_25%,transparent)]",
    info: "bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] text-[var(--color-info)] border border-[color-mix(in_srgb,var(--color-info)_25%,transparent)]",
    secondary: "bg-[color-mix(in_srgb,var(--color-secondary)_10%,transparent)] text-[var(--color-secondary)] border border-[color-mix(in_srgb,var(--color-secondary)_25%,transparent)]",
    neutral: "bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)] border border-[var(--color-neutral-200)]",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[9px]",
    md: "px-2.5 py-1 text-[10px]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold uppercase tracking-wider",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}