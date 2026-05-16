import React, { Suspense } from "react";
import { motion } from "motion/react";
import Dashboard from "../../Dashboard";

// Wrapper component for lazy loading compatibility
function DashboardWrapper(props: any) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
    </div>}>
      <Dashboard {...props} />
    </Suspense>
  );
}

// Add a default export for React.lazy compatibility
export default DashboardWrapper;

// Re-export individual components for direct imports
export { KpiGrid } from "./KpiCard";
export {
  CustomTooltip,
  ActivityHeatmap,
  GaugeChart,
  AnimatedProgress,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "./Charts";

