import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { cn } from '../../../utils/cn';
import { TrendingUp, ShieldCheck, DollarSign, AlertTriangle, Zap, RotateCcw } from "lucide-react";

interface MiniRingProps {
  value: number;
  color: string;
  label: string;
}

function MiniRing({ value, color, label }: MiniRingProps) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(value / 100, 1) * circ;
  const trackColor = "var(--neutral-200)";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative w-10 h-10">
        <svg width={40} height={40} className="-rotate-90">
          <circle cx={20} cy={20} r={r} fill="none" stroke={trackColor} strokeWidth={4} />
          <motion.circle
            cx={20}
            cy={20}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] font-black [color:var(--ring-color)]" style={{ '--ring-color': color } as React.CSSProperties}>
            {value}%
          </span>
        </div>
      </div>
      <span className="text-[7px] font-black text-(--color-neutral-500) uppercase tracking-wider leading-none">
        {label}
      </span>
    </div>
  );
}

interface KpiCardProps {
  kpi: {
    label: string;
    value: string | number;
    currency?: boolean;
    icon: React.ReactNode;
    color: string;
    spark?: Array<{ v: number }> | null;
    sparkColor?: string;
    rings?: { fisico: number; financiero: number };
    pulse?: boolean;
    onNavigate?: () => void;
  };
  index: number;
}

function KpiCard({ kpi, index }: KpiCardProps) {
  const trend =
    kpi.spark && kpi.spark.length > 3
      ? kpi.spark.slice(-3).reduce((a: number, d: any) => a + d.v, 0) -
        kpi.spark.slice(0, 3).reduce((a: number, d: any) => a + d.v, 0)
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative bg-surface border border-border rounded-xl p-3 sm:p-4 cursor-default will-change-transform overflow-hidden group",
        "hover:border-border/80 hover:shadow-md transition-all duration-300"
      )}
    >
      {/* Color accent bar top */}
      <div className={cn("absolute top-0 left-0 right-0 h-0.5 rounded-t-xl", kpi.color)} />

      {/* Background sparkline */}
      {kpi.spark?.length > 1 && (
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <svg width="100%" height="100%" viewBox="0 0 200 60" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              points={kpi.spark
                .map((d: any, i: number) => {
                  const x = (i / (kpi.spark.length - 1)) * 200;
                  const y = 60 - ((d.v + 1000) / 2000) * 60;
                  return `${x},${y}`;
                })
                .join(" ")}
            />
          </svg>
        </div>
      )}

      <div className="flex items-start justify-between mb-2 relative z-10">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 [color:var(--kpi-icon-color)]",
              kpi.color.replace("bg-", "bg-opacity-15 bg-")
            )}
            style={{ '--kpi-icon-color': `var(--${kpi.color.replace("bg-", "")})` } as React.CSSProperties}
          >
            {kpi.icon}
          </div>
          {kpi.rings && (
            <motion.div
              onClick={kpi.onNavigate}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex gap-0.5 ml-1 cursor-pointer"
              title="Ver detalle en Seguimiento"
            >
              <MiniRing value={kpi.rings.fisico} color="var(--color-secondary)" label="Fís" />
              <MiniRing value={kpi.rings.financiero} color="var(--color-info)" label="Fin" />
            </motion.div>
          )}
        </div>
        {trend !== null && (
          <span
            className={cn(
              "text-[7px] sm:text-[6px] font-bold uppercase px-1 py-0.5 rounded-full flex items-center gap-0.5",
              trend > 0
                ? "bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-(--color-success)"
                : trend < 0
                ? "bg-error/10 text-error"
                : "bg-(--color-neutral-50) text-(--color-neutral-400)"
            )}
          >
            {trend > 0 ? "▲" : trend < 0 ? "▼" : "—"}
          </span>
        )}
      </div>

      <p className="text-[7px] sm:text-[6px] font-bold text-neutral-500 uppercase tracking-widest mb-0.5 relative z-10">
        {kpi.label}
      </p>
      <p className="text-base sm:text-lg font-black text-primary leading-none relative z-10">
        {kpi.currency
          ? typeof kpi.value === "number"
            ? `Q ${kpi.value.toLocaleString()}`
            : kpi.value
          : kpi.value}
      </p>

      {/* Mini sparkline bottom */}
      {kpi.spark?.length > 1 && (
        <div className="mt-1.5 h-5 relative z-10 opacity-50">
          <svg width="100%" height="100%" viewBox="0 0 200 20" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke={kpi.sparkColor || "var(--secondary)"}
              strokeWidth="1.2"
              points={kpi.spark
                .map((d: any, i: number) => {
                  const x = (i / (kpi.spark.length - 1)) * 200;
                  const y = 20 - ((d.v + 500) / 1000) * 20;
                  return `${x},${y}`;
                })
                .join(" ")}
            />
          </svg>
        </div>
      )}
    </motion.div>
  );
}

interface DashboardGridProps {
  kpis: KpiCardProps["kpi"][];
}

export function KpiGrid({ kpis }: DashboardGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
      {kpis.map((kpi, i) => (
        <KpiCard key={i} kpi={kpi} index={i} />
      ))}
    </div>
  );
}

// Re-export for backward compatibility with existing Dashboard
export { MiniRing };
export type { KpiCardProps, DashboardGridProps };
