import React from "react";
import { cn } from "../../utils/cn";

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  color = "var(--color-secondary)",
  size = "md",
  showLabel = false,
  animated = true,
  className,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const sizeClasses: Record<string, string> = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase tracking-wider">
            Progreso
          </span>
          <span className="text-[9px] font-black text-[var(--color-neutral-600)]">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div
        className={cn(
          "bg-[var(--color-neutral-200)] rounded-full overflow-hidden",
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out"
          )}
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}