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
    success: "bg-[color-mix(in_srgb,varsuccess_10%,transparent)] text-success border border-[color-mix(in_srgb,varsuccess_25%,transparent)]",
    warning: "bg-[color-mix(in_srgb,varwarning_10%,transparent)] text-warning border border-[color-mix(in_srgb,varwarning_25%,transparent)]",
    error: "bg-[color-mix(in_srgb,varerror_10%,transparent)] text-error border border-[color-mix(in_srgb,varerror_25%,transparent)]",
    info: "bg-[color-mix(in_srgb,varinfo_10%,transparent)] text-info border border-[color-mix(in_srgb,varinfo_25%,transparent)]",
    secondary: "bg-[color-mix(in_srgb,varsecondary_10%,transparent)] text-secondary border border-[color-mix(in_srgb,varsecondary_25%,transparent)]",
    neutral: "bg-neutral-100 text-neutral-600 border border-neutral-200",
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

