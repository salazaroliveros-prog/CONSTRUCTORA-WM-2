/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  TrendingUp, 
  Package,
  CheckCircle2,
  Plus,
  Building2,
  DollarSign,
  Zap,
  Truck,
  ShieldCheck,
  X,
  CreditCard,
  ArrowDownLeft,
   ArrowUpRight,
   RotateCcw,
   AlertTriangle,
   Pencil,
   Trash2,
   HardHat
 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';
import { fmtQ } from '../utils/format';
import { toast } from 'sonner';
import { subscribeToCollection, addDocument, updateDocument, getDocumentsForCollection, deleteDocument, parseError } from '../services/firestoreService';
import { useSettings } from '../contexts/SettingsContext';
import { useProjectFilter } from '../contexts/ProjectFilterContext';
import { Transaction } from '../constants';
import { useCountUp } from '../hooks/useCountUp';
import Modal from './ui/Modal';
import { AnimatedProgress, GlassCard, HoverCard, RevealOnScroll, PulsingBadge, MicroButton, staggerContainer, staggerItem } from './ui/Animations';
import { trackCRUD, trackEvent } from '../utils/logger';
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
  ComposedChart,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

function MiniRing({ value, color, label }: { value: number; color: string; label: string }) {
  const r = 16; const circ = 2 * Math.PI * r;
  const dash = Math.min(value / 100, 1) * circ;
  const trackColor = '#e2e8f0';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: 40, height: 40 }}>
        <svg width={40} height={40} className="-rotate-90">
          <circle cx={20} cy={20} r={r} fill="none" stroke={trackColor} strokeWidth={4} />
          <motion.circle cx={20} cy={20} r={r} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] font-black" style={{ color }}>{value}%</span>
        </div>
      </div>
       <span className="text-[7px] sm:text-[6px] font-black text-slate-600 uppercase tracking-wide leading-none">{label}</span>
    </div>
  );
}

// Gauge Chart Component para indicadores de rendimiento
function GaugeChart({ value, max = 100, label, color = '#f59e0b' }: { value: number; max?: number; label: string; color?: string }) {
  const percentage = Math.min((value / max) * 100, 100);
  const angle = (percentage / 100) * 180;
  const r = 60;
  const x1 = 70 + r * Math.cos((180 - angle) * Math.PI / 180);
  const y1 = 70 - r * Math.sin((180 - angle) * Math.PI / 180);

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
        {/* Background arc */}
        <path
          d="M 10 70 A 60 60 0 0 1 130 70"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={12}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <motion.path
          d={`M 10 70 A 60 60 0 ${angle > 90 ? 1 : 0} 1 ${x1} ${y1}`}
          fill="none"
          stroke={`url(#gaugeGrad-${label})`}
          strokeWidth={12}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: percentage / 100 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        {/* Center text */}
        <text x="70" y="65" textAnchor="middle" className="text-2xl font-black fill-current" style={{ fill: color }}>
          {Math.round(value)}%
        </text>
      </svg>
       <span className="text-[7px] font-black text-slate-700 uppercase tracking-widest -mt-1">{label}</span>
    </div>
  );
}

// Calendar Heatmap para visualizar actividad
function ActivityHeatmap({ data }: { data: { date: string; value: number }[] }) {
  const weeks = 12;
  const days = 7;
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  const getColor = (value: number) => {
    if (value === 0) return 'rgba(148,163,184,0.2)';
    const intensity = value / maxValue;
    if (intensity < 0.25) return 'rgba(16,185,129,0.3)';
    if (intensity < 0.5) return 'rgba(16,185,129,0.5)';
    if (intensity < 0.75) return 'rgba(16,185,129,0.7)';
    return 'rgba(16,185,129,1)';
  };

  return (
    <div className="flex gap-1">
      {Array.from({ length: weeks }).map((_, w) => (
        <div key={w} className="flex flex-col gap-1">
          {Array.from({ length: days }).map((_, d) => {
            const idx = w * 7 + d;
            const value = data[idx]?.value || 0;
            return (
              <motion.div
                key={d}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: idx * 0.005, duration: 0.2 }}
                className="w-4 h-4 rounded-sm cursor-pointer hover:ring-2 hover:ring-slate-400 transition-all"
                style={{ backgroundColor: getColor(value) }}
                title={`${data[idx]?.date || ''}: ${value} actividades`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function KpiCard({ kpi, cardClass, index }: { kpi: any; cardClass: string; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    el.style.transform = `perspective(700px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.01)`;
    el.style.boxShadow = `${x * -6}px ${y * -6}px 16px rgba(15,23,42,0.1)`;
  }, []);
  const onMouseLeave = useCallback(() => {
    if (ref.current) { ref.current.style.transform = ''; ref.current.style.boxShadow = ''; }
  }, []);

  // Trend: compare last half vs first half of spark data
  const trend = kpi.spark?.length > 3
    ? kpi.spark.slice(-3).reduce((a: number, d: any) => a + d.v, 0) - kpi.spark.slice(0, 3).reduce((a: number, d: any) => a + d.v, 0)
    : null;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
      className="relative bg-white border border-slate-100 rounded-xl p-3 cursor-default will-change-transform overflow-hidden group
                 hover:border-slate-200 hover:shadow-md shimmer-effect"
    >
      {/* Color accent bar top */}
      <div className={cn("absolute top-0 left-0 right-0 h-0.5 rounded-t-xl", kpi.color)} />

      {/* Sparkline full-card background */}
      {kpi.spark?.length > 1 && (
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kpi.spark} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Line type="monotone" dataKey="v" stroke="var(--text-faint)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {/* Icon with professional static gradient */}
          <div className={cn("icon-box", kpi.color)}>
            {React.cloneElement(kpi.icon as React.ReactElement<{ size?: number }>, { size: 14 })}
          </div>
          {/* Mini ring charts next to icon */}
          {kpi.rings && (
            <motion.div
              onClick={kpi.onNavigate}
              title="Ver detalle en Seguimiento"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              className="flex gap-0.5 cursor-pointer"
            >
              <MiniRing value={kpi.rings.fisico} color="#f59e0b" label="Fís" />
              <MiniRing value={kpi.rings.financiero} color="#06b6d4" label="Fin" />
            </motion.div>
          )}
        </div>
        {/* Trend badge */}
        {trend !== null && (
          <span className={cn(
            "text-[7px] sm:text-[6px] font-black uppercase px-1 py-0.5 rounded-full flex items-center gap-0.5",
            trend > 0 ? "bg-emerald-50 text-emerald-600" : trend < 0 ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-400"
          )}>
            {trend > 0 ? "▲" : trend < 0 ? "▼" : "—"}
          </span>
        )}
      </div>

      <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-0.5">{kpi.label}</p>
      <p className="text-base font-black text-primary leading-none">
        <AnimatedKpi value={kpi.value} currency={kpi.currency} />
      </p>

      {/* Mini sparkline bottom */}
      {kpi.spark?.length > 1 && (
        <div className="mt-1.5 h-6 w-full opacity-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kpi.spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <Line type="monotone" dataKey="v" stroke={kpi.sparkColor || 'color: var(--text-secondary)'} strokeWidth={1.2} dot={false} isAnimationActive={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

    </motion.div>
  );
}

function AnimatedKpi({ value, currency }: { value: string | number; currency?: boolean }) {
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  const animated = useCountUp(isNaN(num) ? 0 : num, 900);
  if (isNaN(num)) return <span>{value}</span>;
  if (currency) return <span>{fmtQ(animated)}</span>;
  if (typeof value === 'number') return <span>{animated.toLocaleString()}</span>;
  // legacy string format fallback
  const prefix = String(value).match(/^[^0-9-]*/)?.[0] || '';
  const suffix = String(value).match(/[^0-9.]+$/)?.[0] || '';
  return <span>{prefix}{Number.isInteger(num) ? animated : animated.toFixed(1)}{suffix}</span>;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 shadow-2xl text-left min-w-[120px]">
      {label && <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-[8px] font-bold text-slate-300 uppercase">{entry.name}:</span>
          <span className="text-[9px] font-black text-white">Q{Number(entry.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const { settings } = useSettings();
  const [projects, setProjects] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState({ projects: false, inventory: false, transactions: false });
  const [resetting, setResetting] = useState(false);
  const [isAccountingModalOpen, setIsAccountingModalOpen] = useState(false);
  const [editTx, setEditTx] = useState<any | null>(null);
  const [editTxForm, setEditTxForm] = useState({ description: '', amount: 0, type: 'GASTO', category: '', date: '' });
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetData, setResetData] = useState<Record<string, {items: any[], selected: string[]}>>({});
  const [resetLoading, setResetLoading] = useState(false);
  const { selectedProjectId, setSelectedProjectId, executingProjects: ctxExecutingProjects, setExecutingProjects } = useProjectFilter();
  const [selectedYear, setSelectedYear] = useState<string>('todos');

  const [accountingForm, setAccountingForm] = useState({
    type: 'Salida' as 'Entrada' | 'Salida',
    quantity: 1,
    cost: 0,
    description: '',
    category: 'Materiales',
    date: new Date().toISOString().split('T')[0],
    projectId: ''
  });

const entryCategories = ['Aporte Cliente', 'Anticipo de Obra', 'Pago por Avance', 'Pago Final', 'Anteproyecto', 'Estudios y Diseno', 'Agrimensura', 'Cuantificacion', 'Venta de Material', 'Devolucion de Proveedor', 'Subvencion / Subsidio', 'Prestamo / Financiamiento', 'Otros Ingresos'];
const exitCategories = ['Materiales', 'Mano de Obra', 'Herramienta y Equipo', 'Sub-contratos', 'Administrativo', 'Personales', 'Hogar'];

  useEffect(() => {
    const unsubProjects = subscribeToCollection('projects', (data) => {
      setProjects(data);
      setLoaded(p => ({ ...p, projects: true }));
    });
    const unsubInventory = subscribeToCollection('inventory', (data) => {
      setInventory(data);
      setLoaded(p => ({ ...p, inventory: true }));
    });
    const unsubTransactions = subscribeToCollection('transactions', (data) => {
      setTransactions(data);
      setLoaded(p => ({ ...p, transactions: true }));
    });
    
    return () => {
      unsubProjects();
      unsubInventory();
      unsubTransactions();
    };
  }, []);

  const handleAccountingSubmit = () => {
    const label = accountingForm.type === 'Entrada' ? 'ingreso' : 'gasto';
    toast('¿Confirmar registro contable?', {
      description: accountingForm.description || 'Registro Contable Directo',
      action: { label: 'Confirmar', onClick: async () => {
        try {
          await addDocument('transactions', { description: accountingForm.description || 'Registro Contable Directo', amount: accountingForm.cost * accountingForm.quantity, qty: accountingForm.quantity, unitCost: accountingForm.cost, type: accountingForm.type === 'Entrada' ? 'INGRESO' : 'GASTO', category: accountingForm.category, date: accountingForm.date, projectId: accountingForm.projectId || null, createdAt: new Date().toISOString() });
          setIsAccountingModalOpen(false);
          setAccountingForm({ type: 'Salida', quantity: 1, cost: 0, description: '', category: exitCategories[0], date: new Date().toISOString().split('T')[0], projectId: '' });
          toast.success('Registro contable guardado');
        } catch (e) { toast.error('Error al registrar contabilidad', { description: parseError(e) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleSystemReset = async () => {
    if (!window.confirm('¿ESTÁ SEGURO? Esta acción eliminará permanentemente TODOS los datos de proyectos, inventario, transacciones, clientes, proveedores y personal. Esta acción no se puede deshacer.')) return;
    
    const collections = ['projects', 'inventory', 'transactions', 'staff', 'suppliers', 'clients'];
    setResetting(true);
    
    try {
      for (const collName of collections) {
        const docs = await getDocumentsForCollection(collName);
        for (const d of docs) {
          await deleteDocument(collName, d.id);
        }
      }
      toast.success('Sistema reiniciado', { description: 'Todos los datos han sido eliminados' });
    } catch (e) {
      console.error(e);
      toast.error('Error al reiniciar', { description: parseError(e) });
    } finally {
      setResetting(false);
    }
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      for (const [col, { selected }] of Object.entries(resetData)) {
        for (const id of selected) {
          await deleteDocument(col, id);
        }
      }
      toast.success('Datos eliminados');
      setIsResetModalOpen(false);
      setResetData({});
    } catch (e) {
      console.error(e);
      toast.error('Error al eliminar', { description: parseError(e) });
    } finally {
      setResetting(false);
    }
  };
  // Sync executingProjects to context for topbar filter
  useEffect(() => { setExecutingProjects(projects.filter((p: any) => p.status === 'EJECUCION')); }, [projects]);

  // Calculations
  const executingProjects = projects.filter(p => p.status === 'EJECUCION');
  const finishedOrPausedProjects = projects.filter(p => p.status === 'FINALIZADO' || p.status === 'PAUSADO');

  const filteredProjects = selectedProjectId === 'ALL'
    ? executingProjects
    : executingProjects.filter(p => p.id === selectedProjectId);

  const availableYears = ['todos', ...new Set(projects.map(p => p.startDate ? new Date(p.startDate).getFullYear().toString() : '').filter(Boolean))].sort();
  const projectsByYear = selectedYear === 'todos' ? filteredProjects : filteredProjects.filter(p => p.startDate && new Date(p.startDate).getFullYear().toString() === selectedYear);

  // Transactions filtered by project when one is selected
  // Transactions store optional projectId; fall back to global when ALL
  const filteredTransactions = selectedProjectId === 'ALL'
    ? transactions
    : transactions.filter(t => t.projectId === selectedProjectId);

  // Financial KPIs — respect project filter
  const totalIncome = filteredTransactions.filter(t => t.type === 'INGRESO').reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalExpenses = filteredTransactions.filter(t => t.type === 'GASTO').reduce((acc, t) => acc + (t.amount || 0), 0);
  const netCash = totalIncome - totalExpenses;

  // Global values for sidebar (always all transactions)
  const globalIncome = transactions.filter(t => t.type === 'INGRESO').reduce((acc, t) => acc + (t.amount || 0), 0);
  const globalExpenses = transactions.filter(t => t.type === 'GASTO').reduce((acc, t) => acc + (t.amount || 0), 0);

  // Budget KPIs — respect the project filter
  const executingBudget = filteredProjects.reduce((acc, p) => acc + (p.budget || 0), 0);
  const finishedPausedBudget = finishedOrPausedProjects.reduce((acc, p) => acc + (p.budget || 0), 0);

  const criticalStock = inventory.filter(i => (i.stock || 0) <= (i.minStock || 0)).length;

  // Progress averages for mini ring charts in KPI cards
  const avgFisico = filteredProjects.length
    ? Math.round(filteredProjects.reduce((a, p) => a + (p.progress || 0), 0) / filteredProjects.length)
    : 0;
  // Financial progress: use real transaction expenses vs budget (consistent with Seguimiento)
  const avgFinanciero = filteredProjects.length
    ? Math.round(filteredProjects.reduce((a, p) => {
        const txExpense = transactions.filter(t => t.projectId === p.id && t.type === 'GASTO').reduce((s: number, t: any) => s + (t.amount || 0), 0);
        const budget = p.budget || 1;
        return a + Math.round((txExpense / budget) * 100);
      }, 0) / filteredProjects.length)
    : 0;

  // Sparkline data — last 8 weeks using filtered transactions
  const sparkWeeks = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - (7 * (7 - i)));
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() - (7 * (6 - i)));
    const weekTx = filteredTransactions.filter(t => {
      if (!t.date) return false;
      const td = new Date(t.date);
      return td >= weekStart && td < weekEnd;
    });
    const inc = weekTx.filter(t => t.type === 'INGRESO').reduce((a, t) => a + (t.amount || 0), 0);
    const exp = weekTx.filter(t => t.type === 'GASTO').reduce((a, t) => a + (t.amount || 0), 0);
    return { v: inc - exp, inc, exp };
  });
  const sparkInc = sparkWeeks.map(d => ({ v: d.inc }));
  const sparkExp = sparkWeeks.map(d => ({ v: d.exp }));
  const sparkNet = sparkWeeks.map(d => ({ v: d.v }));

  // Pie Chart Data: Expenses by Category — use real transactions
  const expenseByCategory = (() => {
    const txSource = selectedProjectId !== 'ALL'
      ? filteredTransactions.filter(t => t.type === 'GASTO')
      : transactions.filter(t => t.type === 'GASTO');
    const cats = selectedProjectId !== 'ALL' ? [...exitCategories, 'Indirectos', 'Administrativo', 'Personal'] : exitCategories;
    return cats.map(cat => ({
      name: cat,
      value: txSource.filter(t => t.category === cat).reduce((acc, t) => acc + (t.amount || 0), 0)
    })).filter(cat => cat.value > 0);
  })();

  // Cash flow chart: when project selected, show project transactions by month;
    // when ALL, show global transactions by month
    const chartData = (() => {
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const currentMonthIndex = new Date().getMonth();
      const lastMonths = [
        (currentMonthIndex - 2 + 12) % 12,
        (currentMonthIndex - 1 + 12) % 12,
        currentMonthIndex
      ];

      return lastMonths.map(monthIdx => {
        const monthTx = filteredTransactions.filter(t => {
          if (!t.date) return false;
          const d = new Date(t.date);
          return d.getMonth() === monthIdx && d.getFullYear() === new Date().getFullYear();
        });
        return {
          name: months[monthIdx],
          ingresos: monthTx.filter(t => t.type === 'INGRESO').reduce((acc, t) => acc + (t.amount || 0), 0),
          gastos: monthTx.filter(t => t.type === 'GASTO').reduce((acc, t) => acc + (t.amount || 0), 0)
        };
      });
    })();

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4', '#fb923c', '#a3e635'];

  // Radar chart data - Rendimiento por área
  const radarData = [
    { area: 'Presupuesto', value: Math.min(100, (executingBudget > 0 ? (totalIncome / executingBudget) * 100 : 0)), fullMark: 100 },
    { area: 'Avance', value: avgFisico, fullMark: 100 },
    { area: 'Liquidez', value: Math.min(100, netCash > 0 ? 85 : 30), fullMark: 100 },
    { area: 'Inventario', value: Math.max(0, 100 - (criticalStock * 10)), fullMark: 100 },
    { area: 'Proyectos', value: Math.min(100, executingProjects.length * 15), fullMark: 100 },
    { area: 'Eficiencia', value: avgFinanciero > 0 ? Math.min(100, (avgFisico / avgFinanciero) * 100) : 50, fullMark: 100 },
  ];

  // Table data - Estado de cuentas por proyecto
  const tableData = projectsByYear.map(p => {
    const aportes = transactions
      .filter(t => t.type === 'INGRESO' && t.category === 'Aporte Cliente' && t.projectId === p.id)
      .reduce((acc, t) => acc + (t.amount || 0), 0);
    const costoTotal = p.budget || 0;
    const pendiente = Math.max(0, costoTotal - aportes);
    return { id: p.id, name: p.name || 'Sin nombre', costoTotal, aportes, pendiente, progress: p.progress || 0 };
  }).sort((a, b) => b.pendiente - a.pendiente);

  // Activity heatmap data - Últimos 84 días de actividad
  const heatmapData = Array.from({ length: 84 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (83 - i));
    const dateStr = date.toISOString().split('T')[0];
    const dayTx = transactions.filter(t => t.date === dateStr).length;
    return { date: dateStr, value: dayTx };
  });

  const getCardStyle = () => {
    switch (settings.cardStyle) {
      case 'flat': return 'bg-slate-50 border border-slate-100 shadow-none';
      case 'glass': return 'bg-white/40 backdrop-blur-md border border-white/50 shadow-xl';
      case 'bordered': return 'bg-white border-2 border-slate-900 shadow-none';
      case 'elevated':
      default: return 'bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow';
    }
  };

  const cardClass = getCardStyle();


  const handleDeleteTx = (id: string) => {
    toast('Eliminar movimiento?', {
      description: 'Esta accion no se puede deshacer.',
      action: { label: 'Eliminar', onClick: async () => { try { await deleteDocument('transactions', id); toast.success('Movimiento eliminado'); } catch (e) { toast.error('Error', { description: parseError(e) }); } } },
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleEditTxSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTx) return;
    toast('Guardar cambios?', {
      description: editTxForm.description || 'Movimiento financiero',
      action: { label: 'Confirmar', onClick: async () => {
        try {
          await updateDocument('transactions', editTx.id, editTxForm);
          setEditTx(null);
          toast.success('Movimiento actualizado');
        } catch (err) { toast.error('Error', { description: parseError(err) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };
  const loading = !loaded.projects || !loaded.inventory || !loaded.transactions || resetting;

  return loading ? (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
    </div>
  ) : (
    <div id="dashboard-container" className="flex flex-col gap-2 h-full min-h-0 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] scroll-mb-[calc(4rem+env(safe-area-inset-bottom,0px))]">

      {/* Accounting Modal */}
      <Modal 
        isOpen={isAccountingModalOpen} 
        onClose={() => setIsAccountingModalOpen(false)}
        title="Registro Contable"
      >
        <div className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tipo Registro</label>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button 
                  type="button"
                  onClick={() => setAccountingForm({ ...accountingForm, type: 'Entrada', category: entryCategories[0] })}
                  className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", accountingForm.type === 'Entrada' ? "bg-white text-green-600 shadow-sm" : "text-slate-400")}
                >
                  <ArrowDownLeft size={10} className="inline mr-1" />
                  Ingreso (+)
                </button>
                <button 
                  type="button"
                  onClick={() => setAccountingForm({ ...accountingForm, type: 'Salida', category: exitCategories[0] })}
                  className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", accountingForm.type === 'Salida' ? "bg-white text-red-600 shadow-sm" : "text-slate-400")}
                >
                  <ArrowUpRight size={10} className="inline mr-1" />
                  Gasto (-)
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="accounting-date" className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Fecha</label>
              <input 
                id="accounting-date"
                type="date"
                value={accountingForm.date}
                onChange={(e) => setAccountingForm({ ...accountingForm, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-secondary shadow-sm"
                title="Fecha del movimiento"
              />
            </div>
          </div>

          <div>
            <label htmlFor="accounting-category" className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Categoría</label>
            <select 
              id="accounting-category"
              value={accountingForm.category}
              onChange={(e) => setAccountingForm({ ...accountingForm, category: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase focus:outline-none focus:border-secondary shadow-sm"
              title="Seleccionar categoría"
            >
              {(accountingForm.type === 'Entrada' ? entryCategories : exitCategories).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="accounting-project" className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Proyecto (opcional)</label>
            <select
              id="accounting-project"
              value={accountingForm.projectId}
              onChange={(e) => setAccountingForm({ ...accountingForm, projectId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase focus:outline-none focus:border-secondary shadow-sm"
              title="Asignar a proyecto"
            >
              <option value="">Sin proyecto especifico</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="accounting-quantity" className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Cantidad / Unidades</label>
              <input 
                id="accounting-quantity"
                type="number"
                step="0.01"
                value={accountingForm.quantity || ''}
                onChange={(e) => setAccountingForm({ ...accountingForm, quantity: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black focus:outline-none focus:border-secondary shadow-sm"
                placeholder="1"
                title="Cantidad"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="accounting-cost" className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Costo / Precio Unit. (Q)</label>
              <input 
                id="accounting-cost"
                type="number"
                step="0.01"
                value={accountingForm.cost || ''}
                onChange={(e) => setAccountingForm({ ...accountingForm, cost: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black focus:outline-none focus:border-secondary shadow-sm"
                placeholder="0.00"
                title="Costo unitario"
              />
            </div>
          </div>

          <div>
            <label htmlFor="accounting-description" className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Descripción de la Factura / Movimiento</label>
            <textarea 
              id="accounting-description"
              value={accountingForm.description}
              onChange={(e) => setAccountingForm({ ...accountingForm, description: e.target.value })}
              placeholder="Ej: Pago sub-contrato Fase 1, Compra de cemento..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase focus:outline-none focus:border-secondary shadow-sm min-h-[80px]"
              title="Descripción del movimiento"
            />
          </div>

          <button 
            type="button"
            onClick={handleAccountingSubmit}
            disabled={accountingForm.cost <= 0 || accountingForm.quantity <= 0}
            className="w-full bg-primary text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2 shadow-xl shadow-primary/10"
          >
            Registrar en Contabilidad
          </button>
        </div>
      </Modal>

      {/* Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Limpiar Datos del Sistema</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Selecciona los registros a eliminar</p>
              </div>
              <button title="Cerrar" onClick={() => setIsResetModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {Object.entries(resetData).map(([col, { items, selected }]) => {
                const labels: Record<string, string> = { projects: 'Proyectos', inventory: 'Inventario', transactions: 'Transacciones', staff: 'Personal', suppliers: 'Proveedores', clients: 'Clientes' };
                const allChecked = selected.length === items.length;
                return (
                  <div key={col} className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <input title="Seleccionar todos" type="checkbox" checked={allChecked} onChange={() => setResetData(prev => ({ ...prev, [col]: { ...prev[col], selected: allChecked ? [] : items.map((d: any) => d.id) } }))} className="w-4 h-4 accent-red-500 cursor-pointer" />
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex-1">{labels[col] || col}</span>
                      <span className="text-[8px] font-bold text-slate-400">{selected.length}/{items.length} seleccionados</span>
                    </div>
                    <div className="divide-y divide-slate-50 max-h-40 overflow-y-auto">
                      {items.map((item: any) => (
                        <label key={item.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer transition-colors">
                          <input title={`Seleccionar ${item.name || item.description}`} type="checkbox" checked={selected.includes(item.id)}
                            onChange={() => setResetData(prev => {
                              const sel = prev[col].selected;
                              return { ...prev, [col]: { ...prev[col], selected: sel.includes(item.id) ? sel.filter(s => s !== item.id) : [...sel, item.id] } };
                            })} className="w-3.5 h-3.5 accent-red-500 cursor-pointer shrink-0" />
                          <span className="text-[9px] font-bold text-slate-600 truncate">{item.name || item.description || item.id.slice(0, 12)}</span>
                          <span className="text-[7px] text-slate-300 font-mono ml-auto shrink-0">{item.id.slice(0, 8)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {Object.keys(resetData).length === 0 && (
                <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest py-8">No hay datos para eliminar</p>
              )}
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsResetModalOpen(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all">Cancelar</button>
              <button onClick={handleConfirmReset} disabled={resetting || Object.values(resetData).every(v => v.selected.length === 0)}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                {resetting ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Eliminando...</> : <><AlertTriangle size={12} /> Eliminar Seleccionados</>}
              </button>
            </div>
          </motion.div>
        </div>
      )}


      {/* KPI Ribbon */}
      <div className="shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { label: selectedProjectId === 'ALL' ? 'Proyectos Activos' : 'Proyecto Seleccionado', value: filteredProjects.length, currency: false, icon: <Zap size={16} />, color: 'bg-blue-500', spark: null, pulse: executingProjects.length > 0, rings: { fisico: avgFisico, financiero: avgFinanciero }, onNavigate: () => setActiveTab?.('seguimiento') },
            { label: 'Efectivo Neto', value: netCash, currency: true, icon: <DollarSign size={16} />, color: netCash >= 0 ? 'bg-emerald-500' : 'bg-red-500', spark: sparkNet, sparkColor: netCash >= 0 ? '#34d399' : '#f87171', pulse: false },
            { label: selectedProjectId === 'ALL' ? 'Presp. Ejecución' : 'Presp. Proyecto', value: executingBudget, currency: true, icon: <TrendingUp size={16} />, color: 'bg-amber-500', spark: sparkInc, sparkColor: '#f59e0b', pulse: false },
            { label: 'Presp. Fin/Pausa', value: finishedPausedBudget, currency: true, icon: <CheckCircle2 size={16} />, color: 'bg-slate-500', spark: null, pulse: false },
            { label: 'Alertas Stock', value: criticalStock, currency: false, icon: <ShieldCheck size={16} />, color: criticalStock > 0 ? 'bg-red-500' : 'bg-emerald-500', spark: sparkExp, sparkColor: criticalStock > 0 ? '#f87171' : '#34d399', pulse: criticalStock > 0 },
          ].map((kpi, i) => (
            <KpiCard key={i} kpi={kpi} cardClass={cardClass} index={i} />
          ))}
        </div>
      </div>

      {/* Main + Sidebar */}
      <div className="flex gap-2 flex-1 min-h-0 overflow-y-auto">
      <section className="flex-1 min-w-0 flex flex-col gap-2">
        {/* Row 1: Cash Flow & Expenses */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
           <div className={cn(cardClass, "md:col-span-2 rounded-xl p-3 text-left")}>
              <div className="flex justify-between items-center mb-1">
                <div>
                  <h2 className="text-[11px] font-black text-primary uppercase tracking-tight">{selectedProjectId === 'ALL' ? 'Flujo de Caja' : 'Flujo del Proyecto'}</h2>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ingresos vs Gastos</p>
                </div>
              </div>
              <div className="h-[160px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {settings.graphType === 'bar' ? (
                    <ComposedChart data={chartData}>
                      <defs>
                        <linearGradient id="barGradIngresos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={settings.secondaryColor} stopOpacity={1} />
                          <stop offset="100%" stopColor={settings.secondaryColor} stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="barGradGastos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={settings.primaryColor} stopOpacity={1} />
                          <stop offset="100%" stopColor={settings.primaryColor} stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} />
                      <YAxis fontSize={9} axisLine={false} tickLine={false} />
                      <ChartTooltip cursor={{fill: 'rgba(248,250,252,0.05)'}} content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase' }} />
                      <Bar dataKey="ingresos" fill="url(#barGradIngresos)" radius={[3, 3, 0, 0]} barSize={15} />
                      <Bar dataKey="gastos" fill="url(#barGradGastos)" radius={[3, 3, 0, 0]} barSize={15} />
                    <Line type="monotone" dataKey="ingresos" stroke={settings.secondaryColor} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                    </ComposedChart>
                  ) : settings.graphType === 'line' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} />
                      <YAxis fontSize={9} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="ingresos" stroke={settings.secondaryColor} strokeWidth={2} dot={{ r: 3, fill: settings.secondaryColor }} />
                      <Line type="monotone" dataKey="gastos" stroke={settings.primaryColor} strokeWidth={2} dot={{ r: 3, fill: settings.primaryColor }} />
                    </LineChart>
                  ) : (
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={settings.secondaryColor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={settings.secondaryColor} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={settings.primaryColor} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={settings.primaryColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} />
                      <YAxis fontSize={9} axisLine={false} tickLine={false} />
                      <ChartTooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="ingresos" stroke={settings.secondaryColor} strokeWidth={1.5} fill="url(#gradIngresos)" />
                      <Area type="monotone" dataKey="gastos" stroke={settings.primaryColor} strokeWidth={1.5} fill="url(#gradGastos)" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
           </div>

           <div className={cn(cardClass, "rounded-xl p-3 text-left")}>
              <div className="flex justify-between items-center mb-1">
                <div>
                  <h2 className="text-[11px] font-black text-primary uppercase tracking-tight">Gastos</h2>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Por Categoría</p>
                </div>
              </div>
              <div className="h-[160px] w-full flex flex-col items-center justify-center">
                <div className="h-3/4 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseByCategory.length > 0 ? expenseByCategory : [{ name: 'Sin Datos', value: 1 }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={60}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {expenseByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
                   {expenseByCategory.slice(0, 4).map((item, i) => (
                     <div key={i} className="flex items-center gap-1 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-[7px] font-black uppercase truncate text-slate-500">{item.name}</span>
                     </div>
                   ))}
                </div>
              </div>
           </div>
        </div>

        {/* Row 2: Advanced Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* Radar Chart */}
          <div className={cn(cardClass, "rounded-xl p-3 text-left")}>
            <h2 className="text-[11px] font-black text-primary uppercase tracking-tight mb-1">Rendimiento</h2>
            <div className="h-[130px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="area" tick={{ fontSize: 7, fontWeight: 900, fill: 'var(--text-subtle)' }} />
                  <Radar name="Rendimiento" dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gauge Charts */}
          <div className={cn(cardClass, "rounded-xl p-3 text-left")}>
            <h2 className="text-[11px] font-black text-primary uppercase tracking-tight mb-1">Avances</h2>
            <div className="flex justify-around items-center h-[130px]">
              <GaugeChart value={avgFisico} label="Físico" color="#10b981" />
              <GaugeChart value={avgFinanciero} label="Financiero" color="#3b82f6" />
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className={cn(cardClass, "rounded-xl p-3 text-left")}>
            <h2 className="text-[11px] font-black text-primary uppercase tracking-tight mb-1">Actividad</h2>
            <div className="flex flex-col items-center justify-center h-[130px]">
              <ActivityHeatmap data={heatmapData} />
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-sm bg-slate-200" />
                  <span className="text-[7px] sm:text-[6px] font-bold text-slate-400 uppercase">Baja</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-sm bg-emerald-500" />
                  <span className="text-[7px] sm:text-[6px] font-bold text-slate-400 uppercase">Alta</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Tabla de cuentas & Progress Tracker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Tabla Estado de Cuentas */}
          <div className={cn(cardClass, "rounded-xl p-3 text-left")}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-black text-primary uppercase tracking-tight">Estado de Cuentas por Proyecto</h2>
              {availableYears.length > 2 && (
                <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                  className="text-[8px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-secondary">
                  {availableYears.map(y => <option key={y} value={y}>{y === 'todos' ? 'Todos' : y}</option>)}
                </select>
              )}
            </div>
            <div className="overflow-x-auto overflow-y-auto">
              <table className="w-full text-[9px]">
                <thead className="sticky top-0 bg-inherit">
                  <tr className="border-b border-slate-200">
                    <th className="text-left font-black text-slate-500 uppercase tracking-wider pb-1.5 pr-2">Proyecto</th>
                    <th className="text-right font-black text-slate-500 uppercase tracking-wider pb-1.5 px-1">Costo Total</th>
                    <th className="text-right font-black text-slate-500 uppercase tracking-wider pb-1.5 px-1">Aportes</th>
                    <th className="text-right font-black text-slate-500 uppercase tracking-wider pb-1.5 pl-1">Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map(row => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-1 pr-2 font-bold text-primary truncate max-w-[130px] sm:max-w-[180px]">{row.name}</td>
                      <td className="py-1 text-right font-mono font-bold px-1">{fmtQ(row.costoTotal)}</td>
                      <td className="py-1 text-right font-mono font-bold text-emerald-600 px-1">{fmtQ(row.aportes)}</td>
                      <td className={cn("py-1 text-right font-mono font-bold pl-1", row.pendiente > 0 ? "text-amber-600" : "text-slate-400")}>{fmtQ(row.pendiente)}</td>
                    </tr>
                  ))}
                </tbody>
                {tableData.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300">
                      <td className="py-1.5 pr-2 font-black text-primary text-[10px]">TOTAL</td>
                      <td className="py-1.5 text-right font-mono font-black text-[10px] px-1">{fmtQ(tableData.reduce((a, r) => a + r.costoTotal, 0))}</td>
                      <td className="py-1.5 text-right font-mono font-black text-emerald-600 text-[10px] px-1">{fmtQ(tableData.reduce((a, r) => a + r.aportes, 0))}</td>
                      <td className={cn("py-1.5 text-right font-mono font-black text-[10px] pl-1", tableData.some(r => r.pendiente > 0) ? "text-amber-600" : "text-slate-400")}>{fmtQ(tableData.reduce((a, r) => a + r.pendiente, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
              {tableData.length === 0 && <p className="text-[9px] text-slate-400 text-center py-4">Sin proyectos</p>}
            </div>
          </div>

          {/* Progress Tracker */}
          <div className={cn(cardClass, "rounded-xl p-3 text-left")}>
            <h2 className="text-[11px] font-black text-primary uppercase tracking-tight mb-1">Cronograma</h2>
            <div className="space-y-1.5 overflow-y-auto max-h-[130px] pr-1">
              {filteredProjects.length > 0 ? filteredProjects.slice(0, 6).map((p) => (
                <div key={p.id} className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex justify-between text-[8px] font-black uppercase mb-1">
                    <span className="truncate">{p.name}</span>
                    <span className="text-secondary">{p.progress || 0}%</span>
                  </div>
                  <div className="h-1.5 bg-white rounded-full overflow-hidden border border-slate-200">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${p.progress || 0}%` }}
                      className="h-full bg-slate-900 rounded-full"
                    />
                  </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center opacity-30 py-4">
                   <Building2 size={20} className="mb-1" />
                   <p className="text-[7px] font-black uppercase">Sin Proyectos</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 4: Transactions Table */}
        <div className={cn(cardClass, 'rounded-xl p-3 text-left')}>
          <div className='flex items-center justify-between mb-1'>
            <h4 className='text-[9px] font-black text-slate-400 uppercase tracking-widest'>Movimientos Recientes</h4>
            <span className='text-[7px] font-bold text-slate-400'>{filteredTransactions.length} registros</span>
          </div>
          <div className='overflow-auto max-h-36'>
            <table className='w-full text-left table-fixed'>
              <thead className='sticky top-0 bg-slate-50 z-10'>
                <tr className='border-b border-slate-100'>
                  <th className='w-16 px-2 py-1.5 text-[7px] font-black text-slate-400 uppercase tracking-widest'>Fecha</th>
                  <th className='px-2 py-1.5 text-[7px] font-black text-slate-400 uppercase tracking-widest'>Descripcion</th>
                  <th className='w-20 px-2 py-1.5 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right'>Monto (Q)</th>
                  <th className='w-16 px-2 py-1.5 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right'>Accion</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-50'>
                {filteredTransactions.slice(0, 20).map((t, i) => (
                  <tr key={t.id || i} className='hover:bg-slate-50/50 transition-colors group'>
                    <td className='px-2 py-1.5 text-[7px] font-bold text-slate-500 whitespace-nowrap'>{t.date?.slice(5) || '--'}</td>
                    <td className='px-2 py-1.5 text-[8px] font-black text-primary uppercase truncate'>{t.description || '--'}</td>
                    <td className={cn('px-2 py-1.5 text-[8px] font-black text-right', t.type === 'INGRESO' ? 'text-emerald-600' : 'text-red-500')}>
                      Q{(t.amount || 0).toLocaleString()}
                    </td>
                    <td className='px-2 py-1.5 text-right'>
                      <div className='flex gap-1 justify-end'>
                        <button title="Editar" onClick={() => { setEditTx(t); setEditTxForm({ description: t.description || '', amount: t.amount || 0, type: t.type || 'GASTO', category: t.category || '', date: t.date || '' }); }} className='btn-edit p-1'><Pencil size={10} /></button>
                        <button title="Eliminar" onClick={() => handleDeleteTx(t.id)} className='btn-delete p-1'><Trash2 size={10} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Side Actions / Live Feed */}
      <aside className="hidden lg:flex flex-col gap-2 w-64 shrink-0">
          <div className={cn(cardClass, "rounded-2xl p-3 text-left relative overflow-hidden")}>
             <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Accesos Rápidos</h4>
             <div className="space-y-2">
                {/* Cotización */}
                <button
                  onClick={() => setActiveTab?.('projects')}
                  className="btn-primary-enhanced btn-liquid w-full flex items-center gap-3 p-3 rounded-xl font-black tracking-widest uppercase text-[8px] transition-all hover:scale-[1.02] active:scale-95 shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                >
                  <Plus size={14} />
                  Nueva Cotización
                </button>

                {/* Registro Contable */}
                <button
                  onClick={() => setIsAccountingModalOpen(true)}
                  className="btn-primary-enhanced btn-liquid w-full flex items-center gap-3 p-3 rounded-xl font-black tracking-widest uppercase text-[8px] transition-all hover:scale-[1.02] active:scale-95 shadow-lg bg-gradient-to-r from-green-500 to-green-600 text-white"
                >
                  <ArrowUpRight size={14} />
                  Registro Contable
                </button>

                {/* Otras acciones */}
                {[
                  { label: 'Ver Inventario', icon: <Package size={14} />, color: 'bg-slate-100 text-primary hover:bg-slate-200', tab: 'inventory' },
                  { label: 'Reporte de Obra', icon: <TrendingUp size={14} />, color: 'bg-slate-100 text-primary hover:bg-slate-200', tab: 'seguimiento' },
                  { label: 'Administrar Personal', icon: <HardHat size={14} />, color: 'bg-slate-100 text-primary hover:bg-slate-200', tab: 'staff' },
                ].map((action, i) => (
                  <button key={i} onClick={() => setActiveTab?.(action.tab as string)} className={cn(
                    "interactive-card w-full flex items-center gap-3 p-2.5 rounded-lg font-bold tracking-widest uppercase text-[7px] transition-all border border-transparent hover:border-slate-300",
                    action.color
                  )}>
                    {action.icon}
                    {action.label}
                  </button>
                ))}

                <div className="pt-2 border-t border-slate-200">
                  <button
                    onClick={handleSystemReset}
                    className="w-full flex items-center gap-3 p-2 rounded-lg font-bold tracking-widest uppercase text-[7px] transition-all hover:bg-red-50 text-red-500 border border-dashed border-red-200"
                  >
                    <RotateCcw size={12} />
                    Reiniciar Sistema
                  </button>
                </div>
             </div>
          </div>

         <div className="bg-slate-900 rounded-2xl p-3 text-left relative overflow-hidden highlight-glow">
            <div className="absolute top-0 right-0 p-2 opacity-10 text-white"><ShieldCheck size={40} /></div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Estatus Financiero</h4>
            <div className="space-y-4">
               <div>
                  <div className="flex justify-between text-[9px] font-black uppercase text-white mb-1">
                     <span>Liquidez</span>
                     <span className="text-secondary">{(globalIncome - globalExpenses) > 0 ? 'ALTA' : 'CRÍTICA'}</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                     <div className="progress-neon-fill h-full w-[85%] rounded-full" />
                  </div>
               </div>
               <div className="pt-4 border-t border-white/5 space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                     <span>Ingresos</span>
                     <span className="text-emerald-400">+ Q{globalIncome.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400">
                     <span>Egresos</span>
                     <span className="text-red-400">- Q{globalExpenses.toLocaleString()}</span>
                  </div>
               </div>
            </div>
         </div>

         <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 p-5 rounded-2xl text-primary shadow-lg border-animated">
             <div className="flex items-center gap-2 mb-3">
                <Zap size={16} className="fill-current" />
                <span className="text-[9px] font-black uppercase tracking-widest">Tip Constructivo</span>
             </div>
             <p className="text-[10px] font-black leading-relaxed uppercase tracking-tight">
               Asegúrate de registrar cada factura inmediatamente para mantener el análisis de rentabilidad actualizado.
             </p>
          </div>
      </aside>
      </div>

      {/* Edit Transaction Modal */}
      {editTx && (
        <div className='fixed inset-0 z-[200] flex items-center justify-center p-4'>
          <div className='absolute inset-0 bg-slate-900/40 backdrop-blur-sm' onClick={() => setEditTx(null)} />
          <div className='relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-slate-200'>
            <h3 className='text-sm font-black text-primary uppercase tracking-widest mb-5'>Editar Movimiento</h3>
            <form onSubmit={handleEditTxSave} className='space-y-4 text-left'>
              <div className='grid grid-cols-2 gap-3'>
                <div><label htmlFor="edit-tx-type" className='text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1'>Tipo</label><select id="edit-tx-type" title="Tipo de movimiento" value={editTxForm.type} onChange={e => setEditTxForm({ ...editTxForm, type: e.target.value })} className='w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-secondary'><option value='INGRESO'>INGRESO</option><option value='GASTO'>GASTO</option></select></div>
                <div><label htmlFor="edit-tx-date" className='text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1'>Fecha</label><input id="edit-tx-date" title="Fecha" type='date' value={editTxForm.date} onChange={e => setEditTxForm({ ...editTxForm, date: e.target.value })} className='w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-secondary' /></div>
              </div>
              <div><label htmlFor="edit-tx-desc" className='text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1'>Descripcion</label><input id="edit-tx-desc" title="Descripción" type='text' value={editTxForm.description} onChange={e => setEditTxForm({ ...editTxForm, description: e.target.value })} className='w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-secondary' /></div>
              <div className='grid grid-cols-2 gap-3'>
                <div><label htmlFor="edit-tx-cat" className='text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1'>Categoria</label><input id="edit-tx-cat" title="Categoría" type='text' value={editTxForm.category} onChange={e => setEditTxForm({ ...editTxForm, category: e.target.value })} className='w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-secondary' /></div>
                <div><label htmlFor="edit-tx-amount" className='text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1'>Monto (Q)</label><input id="edit-tx-amount" title="Monto" type='number' step='0.01' value={editTxForm.amount} onChange={e => setEditTxForm({ ...editTxForm, amount: parseFloat(e.target.value) || 0 })} className='w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-secondary' /></div>
              </div>
              <div className='flex gap-2 pt-2'>
                <button type='button' onClick={() => setEditTx(null)} className='flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase'>Cancelar</button>
                <button type='submit' className='flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase hover:bg-secondary hover:text-primary transition-all'>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
