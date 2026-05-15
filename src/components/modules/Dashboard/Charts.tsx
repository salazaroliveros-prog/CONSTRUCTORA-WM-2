import React, { useMemo } from "react";
import { motion } from "motion/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { cn } from '../../../utils/cn';

// ── Custom Tooltip ──
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

export function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-neutral-900/95 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2 shadow-2xl text-left min-w-[120px]">
      {label && (
        <p className="text-[8px] font-black text-neutral-300 uppercase tracking-widest mb-1.5">
          {label}
        </p>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[8px] font-bold text-white uppercase">
            {entry.name}:
          </span>
          <span className="text-[9px] font-black text-white">
            Q{Number(entry.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Activity Heatmap ──
interface ActivityHeatmapProps {
  data: Array<{ date: string; value: number }>;
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const weeks = 12;
  const days = 7;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const getColor = (value: number) => {
    if (value === 0) return "rgba(168, 162, 158, 0.15)";
    const intensity = value / maxValue;
    if (intensity < 0.25) return "rgba(16, 185, 129, 0.25)";
    if (intensity < 0.5) return "rgba(16, 185, 129, 0.45)";
    if (intensity < 0.75) return "rgba(16, 185, 129, 0.65)";
    return "rgba(16, 185, 129, 1)";
  };

  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: weeks }).map((_, w) => (
        <div key={w} className="flex flex-col gap-[2px]">
          {Array.from({ length: days }).map((_, d) => {
            const idx = w * 7 + d;
            const value = data[idx]?.value ?? 0;
            return (
              <motion.div
                key={d}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: idx * 0.003, duration: 0.2 }}
                className="w-3 h-3 rounded-[2px] cursor-pointer hover:ring-1 hover:ring-neutral-400 transition-all"
                style={{ backgroundColor: getColor(value) }}
                title={`${data[idx]?.date ?? ""}: ${value} actividades`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Gauge Chart ──
interface GaugeChartProps {
  value: number;
  max?: number;
  label: string;
  color?: string;
}

export function GaugeChart({
  value,
  max = 100,
  label,
  color = "#f59e0b",
}: GaugeChartProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const r = 60;
  const x1 = 70 + r * Math.cos(((180 - (percentage / 100) * 180) * Math.PI) / 180);
  const y1 = 70 - r * Math.sin(((180 - (percentage / 100) * 180) * Math.PI) / 180);

  return (
    <div className="flex flex-col items-center">
      <svg width="100%" height={60} viewBox="0 0 140 85" className="max-w-[100px]">
        <defs>
          <linearGradient id={`gaugeGrad-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path
          d="M 10 70 A 60 60 0 0 1 130 70"
          fill="none"
          stroke="var(--neutral-200)"
          strokeWidth={12}
          strokeLinecap="round"
        />
        <motion.path
          d={`M 10 70 A 60 60 0 ${percentage > 50 ? 1 : 0} 1 ${x1} ${y1}`}
          fill="none"
          stroke={`url(#gaugeGrad-${label})`}
          strokeWidth={12}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: percentage / 100 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
        <text
          x="70"
          y="65"
          textAnchor="middle"
          className="text-2xl font-black"
          style={{ fill: color }}
        >
          {Math.round(value)}%
        </text>
      </svg>
      <span className="text-[7px] font-black text-neutral-600 uppercase tracking-widest -mt-1">
        {label}
      </span>
    </div>
  );
}

// ── Animated Progress ──
interface AnimatedProgressProps {
  value: number;
  max?: number;
  className?: string;
  color?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function AnimatedProgress({
  value,
  max = 100,
  className,
  color = "#f59e0b",
  showLabel = false,
  size = "md",
}: AnimatedProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">
            Progreso
          </span>
          <span className="text-[8px] font-black text-neutral-600">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div className={cn("bg-neutral-100 rounded-full overflow-hidden", sizeClasses[size])}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ChartTooltip as Tooltip,
};