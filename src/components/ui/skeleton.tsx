import React from "react";
import { cn } from "../../utils/cn";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "title" | "card";
  width?: string | number;
  height?: string | number;
  pulse?: boolean;
}

export function Skeleton({
  className,
  variant = "rectangular",
  width,
  height,
  pulse = true,
}: SkeletonProps) {
  const variantStyles: Record<string, string> = {
    text: "h-3 rounded",
    circular: "rounded-full",
    rectangular: "rounded-xl",
    title: "h-5 rounded-lg w-3/5",
    card: "h-40 rounded-2xl",
  };

  return (
    <div
      role="status"
      aria-label="Cargando contenido"
      className={cn(
        "relative overflow-hidden bg-[var(--color-neutral-100)]",
        variantStyles[variant],
        className
      )}
      style={{ width, height }}
    >
      {pulse && (
        <div className="absolute inset-0 -translate-x-full animate-shimmer">
          <div className="h-full w-full bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.3)] to-transparent" />
        </div>
      )}
    </div>
  );
}

// Skeleton Card
export function SkeletonCard({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-2xl p-4 border border-[var(--color-neutral-100)]", className)}
    >
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      <Skeleton variant="rectangular" height={60} className="mb-3" />
      <div className="flex gap-2">
        <Skeleton variant="text" width={60} height={24} />
        <Skeleton variant="text" width={60} height={24} />
      </div>
    </div>
  );
}

// Skeleton Table Row
export function SkeletonTableRow({
  columns = 5,
}: {
  columns?: number;
}) {
  return (
    <tr className="border-b border-[var(--color-neutral-100)]">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton variant="text" height={12} width={`${Math.random() * 60 + 40}%`} />
        </td>
      ))}
    </tr>
  );
}

