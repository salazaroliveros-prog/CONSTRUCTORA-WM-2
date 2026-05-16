import React from "react";
import { cn } from "../../utils/cn";

type AccentColor =
  | "dashboard" | "projects" | "execution" | "clients"
  | "inventory" | "suppliers" | "staff" | "analytics"
  | "seguimiento" | "gantt";

interface CardProps {
  children: React.ReactNode;
  accent?: AccentColor;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({ children, accent, className, padding = "md", hover = true }: CardProps) {
  return (
    <div
      className={cn(
        "bg-neutral-900/40 border border-border rounded-xl shadow-card relative overflow-hidden",
        hover && "hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-250",
        accent && `card-accent-${accent}`,
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function CardHeader({ children, className, action }: CardHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-3", className)}>
      <div className="flex-1 min-w-0">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export function StatCard({ icon, iconBg, label, value, trend, className }: StatCardProps) {
  return (
    <Card padding="md" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0", iconBg)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-n-500 truncate">
            {label}
          </p>
          <p className="text-xl font-extrabold text-n-900 tracking-tight leading-none mt-0.5">
            {value}
          </p>
        </div>
      </div>
      {trend && (
        <div className={cn("flex items-center gap-1 text-xs font-bold", trend.positive ? "text-success" : "text-error")}>
          <span>{trend.positive ? "↑" : "↓"}</span>
          <span>{trend.value}</span>
        </div>
      )}
    </Card>
  );
}

