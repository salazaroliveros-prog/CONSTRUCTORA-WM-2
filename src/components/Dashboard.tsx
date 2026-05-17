/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  HardHat,
  Calendar as CalendarIcon,
  Printer
  } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';
import { fmtQ, precise } from '../engine/precision';
import { toast } from 'sonner';
import { addDocument, updateDocument, deleteDocument, getDocumentsForCollection, parseError } from '../services/firestoreService';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useProjectFilter } from '../contexts/ProjectFilterContext';

import { useCountUp } from '../hooks/useCountUp';
import { Modal } from './ui/Modal';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { AnimatedProgress, GlassCard, HoverCard, RevealOnScroll, PulsingBadge, MicroButton, staggerContainer, staggerItem } from './ui/Animations';
import { Avatar } from './ui/avatar';
import { trackCRUD, trackEvent } from '../utils/logger';
import { PMath } from '../engine/precision';
import { useStore, useExistingProjectFilter } from '../store/DataStore';
import { validateAll, ValidationIssue } from '../utils/validators';
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
  const trackColor = 'varneutral-200';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="mini-ring-wrap">
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
           <span className="text-[8px] font-black mini-ring-pct" style={{ '--c': color } as React.CSSProperties}>{value}%</span>
        </div>
      </div>
        <span className="text-[7px] sm:text-[6px] font-black text-neutral-600 uppercase tracking-wide leading-none">{label}</span>
    </div>
  );
}

// Gauge Chart Component para indicadores de rendimiento
function GaugeChart({ value, max = 100, label, color = 'varsecondary' }: { value: number; max?: number; label: string; color?: string }) {
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
             <stop offset="0%" stopColor="varerror" />
             <stop offset="50%" stopColor="varsecondary" />
             <stop offset="100%" stopColor="varsuccess" />
          </linearGradient>
        </defs>
        {/* Background arc */}
        <path
          d="M 10 70 A 60 60 0 0 1 130 70"
          fill="none"
           stroke="varneutral-200"
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
        <text x="70" y="65" textAnchor="middle" className="text-2xl font-black fill-current gauge-center-val" style={{ '--c': color } as React.CSSProperties}>
          {Math.round(value)}%
        </text>
      </svg>
        <span className="text-[7px] font-black text-neutral-700 uppercase tracking-widest -mt-1">{label}</span>
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
                className="w-4 h-4 rounded-sm cursor-pointer hover:ring-2 hover:ring-(--color-p-400) transition-all"
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
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="relative bg-white rounded-3xl p-5 shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all duration-500"
    >
      <div className={cn("absolute top-0 left-0 w-full h-1", kpi.color)} />
      
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg", kpi.color)}>
          {React.cloneElement(kpi.icon as React.ReactElement<any>, { size: 20, strokeWidth: 2.5 })}
        </div>
        {kpi.rings && (
          <div className="flex gap-1.5">
            <MiniRing value={kpi.rings.fisico} color="var(--color-amber)" label="Fís" />
            <MiniRing value={kpi.rings.financiero} color="var(--color-blue)" label="Fin" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
        <h3 className="text-xl font-black text-slate-900 tracking-tight">
          <AnimatedKpi value={kpi.value} currency={kpi.currency} />
        </h3>
      </div>

      {kpi.spark && (
        <div className="mt-4 h-10 w-full opacity-30 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={kpi.spark}>
              <defs>
                <linearGradient id={`sparkGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={kpi.sparkColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={kpi.sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={kpi.sparkColor} strokeWidth={2} fill={`url(#sparkGrad-${index})`} dot={false} />
            </AreaChart>
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
  if (typeof value === 'number') return <span>{animated.toLocaleString('es-GT')}</span>;
  // legacy string format fallback
  const prefix = String(value).match(/^[^0-9-]*/)?.[0] || '';
  const suffix = String(value).match(/[^0-9.]+$/)?.[0] || '';
  return <span>{prefix}{Number.isInteger(num) ? animated.toLocaleString('es-GT') : animated.toLocaleString('es-GT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{suffix}</span>;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-neutral-900/95 backdrop-blur-sm border border-(--color-border) rounded-lg px-3 py-2 shadow-2xl text-left min-w-30">
      {label && <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
          <div className="w-1.5 h-1.5 rounded-full shrink-0 dot-color" style={{ '--dot-bg': entry.color } as React.CSSProperties} />
          <span className="text-[8px] font-bold text-neutral-300 uppercase">{entry.name}:</span>
          <span className="text-[9px] font-black text-neutral-50">{fmtQ(Number(entry.value))}</span>
        </div>
      ))}
    </div>
  );
}

interface DashboardProps {
  setActiveTab?: (tab: string) => void;
}

export default function Dashboard({ setActiveTab }: DashboardProps) {
   const { settings } = useSettings();
   const store = useStore();
   const { user } = useAuth();
    const [resetting, setResetting] = useState(false);
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[] | null>(null);
    const [validationSummary, setValidationSummary] = useState({ high: 0, medium: 0, low: 0 });
    const [isAccountingModalOpen, setIsAccountingModalOpen] = useState(false);
    const [editTx, setEditTx] = useState<any | null>(null);
    const [editTxForm, setEditTxForm] = useState({ description: '', amount: 0, type: 'GASTO', category: '', date: '' });
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [resetData, setResetData] = useState<Record<string, {items: any[], selected: string[]}>>({});
    const { selectedProjectId, setSelectedProjectId, executingProjects: ctxExecutingProjects, setExecutingProjects } = useProjectFilter();
   const [selectedYear, setSelectedYear] = useState<string>('todos');
   const [reportDateFrom, setReportDateFrom] = useState(() => {
     const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0];
   });
   const [reportDateTo, setReportDateTo] = useState(() => new Date().toISOString().split('T')[0]);
   const [reportProjectId, setReportProjectId] = useState<string>('ALL');
   const [generating, setGenerating] = useState(false);
   const reportCaptureRef = useRef<HTMLDivElement>(null);

   // Agenda State (Lifting it for the widget)
   const [agendaEvents, setAgendaEvents] = useState<{ id: string, date: string, title: string, time: string }[]>(() => {
     const saved = localStorage.getItem('app-agenda-events');
     return saved ? JSON.parse(saved) : [];
   });

   useEffect(() => {
     localStorage.setItem('app-agenda-events', JSON.stringify(agendaEvents));
   }, [agendaEvents]);

const [accountingForm, setAccountingForm] = useState({
      type: 'Salida' as 'Entrada' | 'Salida',
      quantity: 1,
      cost: 0,
      description: '',
      category: 'Materiales',
      date: new Date().toISOString().split('T')[0],
      projectId: '',
      budgetLineId: ''
    });

    const entryCategories = ['Aporte Cliente', 'Anticipo de Obra', 'Pago por Avance', 'Pago Final', 'Anteproyecto', 'Estudios y Diseno', 'Agrimensura', 'Cuantificacion', 'Venta de Material', 'Devolucion de Proveedor', 'Subvencion / Subsidio', 'Prestamo / Financiamiento', 'Otros Ingresos'];
    const exitCategories = ['Materiales', 'Mano de Obra', 'Herramienta y Equipo', 'Sub-contratos', 'Administrativo', 'Personales', 'Hogar'];

    // ── DataStore: datos centralizados ──────────────────────────────────────
    const projects = store.projects.items;
    const allTransactions = store.transactions.items;
    const inventory = store.inventory.items;
    const loaded = store.projects.isLoading || store.transactions.isLoading || store.inventory.isLoading;

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleAccountingSubmit = async () => {
      try {
        const isEntry = accountingForm.type === 'Entrada';
        const doc = {
          date: accountingForm.date,
          description: accountingForm.description,
          type: isEntry ? 'INGRESO' : 'GASTO',
          category: accountingForm.category,
          amount: isEntry ? accountingForm.quantity * accountingForm.cost : -(accountingForm.quantity * accountingForm.cost),
          projectId: accountingForm.projectId || undefined,
          budgetLineId: accountingForm.budgetLineId || undefined,
          unitCost: accountingForm.cost,
          qty: accountingForm.quantity,
          createdAt: new Date().toISOString(),
        };
        await addDocument('transactions', doc);
        toast.success('Movimiento registrado');
        setAccountingForm({ type: 'Salida', quantity: 1, cost: 0, description: '', category: 'Materiales', date: new Date().toISOString().split('T')[0], projectId: '', budgetLineId: '' });
      } catch (e) { toast.error('Error', { description: parseError(e) }); }
    };

    const handleConfirmReset = async () => {
      setResetting(true);
      try {
        for (const [col, { selected }] of Object.entries(resetData)) {
          for (const id of selected) await deleteDocument(col as any, id);
        }
        toast.success('Datos eliminados');
        setResetData({});
        setIsResetModalOpen(false);
      } catch (e) { toast.error('Error', { description: parseError(e) }); } finally { setResetting(false); }
    };

    const handleSystemReset = async () => {
      if (!confirm('¿Está seguro de reiniciar el sistema? Esto eliminará TODOS los datos.')) return;
      setResetting(true);
      try {
        const cols = ['projects', 'transactions', 'inventory', 'staff', 'suppliers', 'clients'] as const;
        for (const col of cols) {
          const docs = await getDocumentsForCollection(col);
          for (const d of docs) await deleteDocument(col, d.id);
        }
        toast.success('Sistema reiniciado');
        setResetData({});
      } catch (e) { toast.error('Error', { description: parseError(e) }); } finally { setResetting(false); }
    };

    // Sync executingProjects to context for topbar filter
   useEffect(() => { setExecutingProjects(projects.filter((p: any) => p.status === 'EJECUCION')); }, [projects]);

   // ── Cálculos derivados con PMath ────────────────────────────────────────
   const executingProjects = useMemo(() => projects.filter(p => p.status === 'EJECUCION'), [projects]);
   const finishedOrPausedProjects = useMemo(() => projects.filter(p => p.status === 'FINALIZADO' || p.status === 'PAUSADO'), [projects]);

   const filteredProjects = useMemo(() => selectedProjectId === 'ALL'
     ? executingProjects
     : executingProjects.filter(p => p.id === selectedProjectId),
   [executingProjects, selectedProjectId]);

   const finishedFilteredProjects = useMemo(() => selectedProjectId === 'ALL'
     ? finishedOrPausedProjects
     : finishedOrPausedProjects.filter(p => p.id === selectedProjectId),
   [finishedOrPausedProjects, selectedProjectId]);

   const availableYears = useMemo(() => ['todos', ...new Set(projects.map(p => p.startDate ? new Date(p.startDate).getFullYear().toString() : '').filter(Boolean))].sort(), [projects]);
   const projectsByYear = useMemo(() => selectedYear === 'todos' ? filteredProjects : filteredProjects.filter(p => p.startDate && new Date(p.startDate).getFullYear().toString() === selectedYear), [filteredProjects, selectedYear]);

   const existingProjectIds = useMemo(() => new Set(projects.filter(p => p.id).map(p => p.id)), [projects]);

   // Filtrar transacciones huérfanas con DataStore
   const filteredTransactions = useMemo(() => {
     const txs = selectedProjectId === 'ALL'
       ? allTransactions.filter(t => t.projectId && existingProjectIds.has(t.projectId))
       : allTransactions.filter(t => t.projectId === selectedProjectId);
     return txs;
   }, [allTransactions, existingProjectIds, selectedProjectId]);

   const totalIncome = useMemo(() => PMath.sum(filteredTransactions.filter(t => t.type === 'INGRESO').map(t => t.amount || 0)), [filteredTransactions]);
   const totalExpenses = useMemo(() => PMath.sum(filteredTransactions.filter(t => t.type === 'GASTO').map(t => t.amount || 0)), [filteredTransactions]);
const netCash = PMath.sub(totalIncome, totalExpenses);

    const globalIncome = useMemo(() => PMath.sum(allTransactions.filter(t => t.type === 'INGRESO').map(t => t.amount || 0)), [allTransactions]);
    const globalExpenses = useMemo(() => PMath.sum(allTransactions.filter(t => t.type === 'GASTO').map(t => t.amount || 0)), [allTransactions]);

    const liquidityPct = useMemo(() => {
      if (globalIncome <= 0) return 0;
      return Math.min(100, Math.max(0, PMath.div(PMath.mul(netCash, 100), globalIncome)));
    }, [globalIncome, globalExpenses, netCash]);

    const executingBudget = useMemo(() => PMath.sum(filteredProjects.map(p => p.budget || 0)), [filteredProjects]);
    const finishedPausedBudget = useMemo(() => PMath.sum(finishedFilteredProjects.map(p => p.budget || 0)), [finishedFilteredProjects]);

   const criticalStock = useMemo(() => inventory.filter(i => (i.stock || 0) <= (i.minStock || 0) && (selectedProjectId !== 'ALL' ? i.projectId === selectedProjectId : (i.projectId && existingProjectIds.has(i.projectId)))).length, [inventory, existingProjectIds, selectedProjectId]);

const avgFisico = useMemo(() => filteredProjects.length
      ? precise(PMath.div(filteredProjects.reduce((a, p) => PMath.add(a, p.progress || 0), 0), filteredProjects.length), 0)
      : 0, [filteredProjects]);
    const avgFinanciero = useMemo(() => filteredProjects.length
      ? precise(PMath.div(
          filteredProjects.reduce((a, p) => {
            const txExpense = allTransactions.filter(t => t.projectId === p.id && t.type === 'GASTO').reduce((s, t) => PMath.add(s, t.amount || 0), 0);
            return PMath.add(a, precise(PMath.div(PMath.mul(txExpense, 100), p.budget || 1), 0));
          }, 0),
          filteredProjects.length
        ), 0)
      : 0, [filteredProjects, allTransactions]);

// Sparkline data — last 8 weeks using filtered transactions
   const sparkWeeks = Array.from({ length: 8 }, (_, i) => {
     const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - (7 * (7 - i)));
     const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() - (7 * (6 - i)));
     const weekTx = filteredTransactions.filter(t => {
       if (!t.date) return false;
       const td = new Date(t.date);
       return td >= weekStart && td < weekEnd;
     });
     const inc = PMath.sum(weekTx.filter(t => t.type === 'INGRESO').map(t => t.amount || 0));
     const exp = PMath.sum(weekTx.filter(t => t.type === 'GASTO').map(t => t.amount || 0));
     return { v: PMath.sub(inc, exp), inc, exp };
   });
  const sparkInc = sparkWeeks.map(d => ({ v: d.inc }));
  const sparkExp = sparkWeeks.map(d => ({ v: d.exp }));
  const sparkNet = sparkWeeks.map(d => ({ v: d.v }));

// Pie Chart Data: Expenses by Category — use real transactions
   const expenseByCategory = (() => {
     const txSource = selectedProjectId !== 'ALL'
       ? filteredTransactions.filter(t => t.type === 'GASTO')
       : filteredTransactions.filter(t => t.type === 'GASTO');
     const cats = selectedProjectId !== 'ALL' ? [...exitCategories, 'Indirectos', 'Administrativo', 'Personal'] : exitCategories;
     return cats.map(cat => ({
       name: cat,
       value: PMath.sum(txSource.filter(t => t.category === cat).map(t => t.amount || 0))
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
           ingresos: PMath.sum(monthTx.filter(t => t.type === 'INGRESO').map(t => t.amount || 0)),
           gastos: PMath.sum(monthTx.filter(t => t.type === 'GASTO').map(t => t.amount || 0))
         };
       });
     })();

const generateReport = async () => {
     setGenerating(true);
     try {
       const { default: jsPDF } = await import('jspdf');
       const target = reportCaptureRef.current;
       if (!target) { toast.error('Error al generar reporte'); setGenerating(false); return; }

       // Populate report data
       const projList = reportProjectId === 'ALL' ? projects : projects.filter(p => p.id === reportProjectId);
       const from = new Date(reportDateFrom);
       const to = new Date(reportDateTo);
       const allTxs = store.transactions.items;
       const txRange = allTxs.filter(t => t.date && new Date(t.date) >= from && new Date(t.date) <= to);
       const income = PMath.sum(txRange.filter(t => t.type === 'INGRESO').map(t => t.amount || 0));
       const expenses = PMath.sum(txRange.filter(t => t.type === 'GASTO').map(t => t.amount || 0));

       // Build hidden report HTML
       target.innerHTML = `
         <div style="font-family:Inter,sans-serif;padding:30px;color:#0f172a;background:#fff;width:780px">
           <div style="text-align:center;border-bottom:2px solid #f59e0b;padding-bottom:16px;margin-bottom:20px">
             <h1 style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;margin:0">${settings.companyName}</h1>
             <p style="font-size:9px;color:#64748b;margin:4px 0 0">Reporte de Gestión · ${reportDateFrom} al ${reportDateTo}</p>
             <p style="font-size:9px;color:#64748b;margin:2px 0 0">${reportProjectId === 'ALL' ? 'Todos los proyectos' : (projects.find(p => p.id === reportProjectId)?.name || 'Proyecto específico')}</p>
           </div>
           <div style="display:flex;gap:12px;margin-bottom:20px">
             <div style="flex:1;padding:12px;background:#f8fafc;border-radius:8px;text-align:center;border:1px solid #e2e8f0">
               <p style="font-size:8px;color:#64748b;text-transform:uppercase;font-weight:900;letter-spacing:0.1em;margin:0">Ingresos</p>
               <p style="font-size:18px;font-weight:900;color:#10b981;margin:4px 0">Q. ${fmtQ(income)}</p>
             </div>
             <div style="flex:1;padding:12px;background:#f8fafc;border-radius:8px;text-align:center;border:1px solid #e2e8f0">
               <p style="font-size:8px;color:#64748b;text-transform:uppercase;font-weight:900;letter-spacing:0.1em;margin:0">Gastos</p>
               <p style="font-size:18px;font-weight:900;color:#ef4444;margin:4px 0">Q. ${fmtQ(expenses)}</p>
             </div>
             <div style="flex:1;padding:12px;background:#f8fafc;border-radius:8px;text-align:center;border:1px solid #e2e8f0">
               <p style="font-size:8px;color:#64748b;text-transform:uppercase;font-weight:900;letter-spacing:0.1em;margin:0">Neto</p>
               <p style="font-size:18px;font-weight:900;color:${PMath.sub(income, expenses) >= 0 ? '#10b981' : '#ef4444'};margin:4px 0">Q. ${fmtQ(PMath.sub(income, expenses))}</p>
             </div>
             <div style="flex:1;padding:12px;background:#f8fafc;border-radius:8px;text-align:center;border:1px solid #e2e8f0">
               <p style="font-size:8px;color:#64748b;text-transform:uppercase;font-weight:900;letter-spacing:0.1em;margin:0">Proyectos</p>
               <p style="font-size:18px;font-weight:900;color:#0f172a;margin:4px 0">${projList.length}</p>
             </div>
           </div>
           <div style="display:flex;gap:12px;margin-bottom:20px">
             <div style="flex:1;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;min-height:160px">
               <p style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px">Transacciones por Categoría</p>
               <div id="report-pie" style="height:140px;display:flex;align-items:center;justify-content:center;gap:12px;">
                 ${entryCategories.filter(c => txRange.filter(t => t.category === c).length > 0).slice(0,5).map((cat, i) => {
                   const val = PMath.sum(txRange.filter(t => t.category === cat).map(t => t.amount || 0));
                   const colors = ['#f59e0b','#3b82f6','#10b981','#8b5cf6','#f43f5e'];
                   return `<div style="display:flex;align-items:center;gap:4px;font-size:7px"><div style="width:8px;height:8px;border-radius:2px;background:${colors[i%5]}"></div>${cat}</div>`;
                 }).join('')}
               </div>
             </div>
             <div style="flex:2;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
               <p style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px">Proyectos — Estado de Cuentas</p>
               <table style="width:100%;font-size:7px;border-collapse:collapse">
                 <thead><tr style="border-bottom:1px solid #e2e8f0">
                   <th style="text-align:left;padding:4px 6px;font-weight:900;color:#64748b;text-transform:uppercase">Proyecto</th>
                   <th style="text-align:right;padding:4px 6px;font-weight:900;color:#64748b;text-transform:uppercase">Presupuesto</th>
                   <th style="text-align:right;padding:4px 6px;font-weight:900;color:#64748b;text-transform:uppercase">Avance</th>
                   <th style="text-align:right;padding:4px 6px;font-weight:900;color:#64748b;text-transform:uppercase">Ingresos</th>
                   <th style="text-align:right;padding:4px 6px;font-weight:900;color:#64748b;text-transform:uppercase">Gastos</th>
                   <th style="text-align:right;padding:4px 6px;font-weight:900;color:#64748b;text-transform:uppercase">Neto</th>
                 </tr></thead>
                 <tbody>${projList.slice(0, 15).map(p => {
                   const pin = PMath.sum(txRange.filter(t => t.type === 'INGRESO' && t.projectId === p.id).map(t => t.amount || 0));
                   const pout = PMath.sum(txRange.filter(t => t.type === 'GASTO' && t.projectId === p.id).map(t => t.amount || 0));
                   const neto = PMath.sub(pin, pout);
                   return `<tr style="border-bottom:1px solid #f1f5f9">
                     <td style="padding:3px 6px;font-weight:700">${p.name || '—'}</td>
                     <td style="padding:3px 6px;text-align:right;font-family:monospace">Q. ${fmtQ(p.budget || 0)}</td>
                     <td style="padding:3px 6px;text-align:right">${p.progress || 0}%</td>
                     <td style="padding:3px 6px;text-align:right;font-family:monospace;color:#10b981">Q. ${fmtQ(pin)}</td>
                     <td style="padding:3px 6px;text-align:right;font-family:monospace;color:#ef4444">Q. ${fmtQ(pout)}</td>
                     <td style="padding:3px 6px;text-align:right;font-family:monospace;color:${neto >= 0 ? '#10b981' : '#ef4444'}">Q. ${fmtQ(neto)}</td>
                   </tr>`;
                 }).join('')}</tbody>
               </table>
               ${projList.length > 15 ? `<p style="font-size:7px;color:#94a3b8;text-align:center;margin-top:4px">Mostrando 15 de ${projList.length} proyectos</p>` : ''}
             </div>
           </div>
           <div style="font-size:6px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:8px">
             Generado el ${new Date().toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · WM/M&S Constructora ERP
           </div>
         </div>
       `;
      target.style.display = 'block';
      target.style.position = 'fixed';
      target.style.left = '-9999px';
      target.style.top = '0';

      const canvas = await (await import('html2canvas')).default(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = 210;
      const pdfH = (canvas.height * pdfW) / canvas.width;
      let heightLeft = pdfH;
      let position = 0;
      const pageH = 297;

      pdf.addImage(imgData, 'PNG', 0, position, pdfW, pdfH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - pdfH;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfW, pdfH);
        heightLeft -= pageH;
      }

      target.style.display = 'none';
      pdf.save(`reporte-${reportDateFrom}-al-${reportDateTo}.pdf`);
      toast.success('Reporte generado exitosamente');
    } catch (e) {
      console.error(e);
      toast.error('Error al generar reporte');
    } finally {
      setGenerating(false);
    }
  };

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4', '#fb923c', '#a3e635'];

// Radar chart data - Rendimiento por área
   const radarData = [
     { area: 'Presupuesto', value: executingBudget > 0 ? Math.min(100, PMath.div(PMath.mul(totalIncome, 100), executingBudget)) : 0, fullMark: 100 },
     { area: 'Avance', value: avgFisico, fullMark: 100 },
     { area: 'Liquidez', value: netCash > 0 && totalIncome > 0 ? Math.min(100, PMath.div(PMath.mul(netCash, 100), totalIncome)) : 0, fullMark: 100 },
     { area: 'Inventario', value: inventory.length > 0 ? Math.max(0, 100 - (criticalStock * 10)) : 0, fullMark: 100 },
     { area: 'Proyectos', value: Math.min(100, executingProjects.length * 15), fullMark: 100 },
     { area: 'Eficiencia', value: avgFinanciero > 0 ? Math.min(100, PMath.div(PMath.mul(avgFisico, 100), avgFinanciero)) : 0, fullMark: 100 },
   ];

// Table data - Estado de cuentas por proyecto
   const tableData = projectsByYear.map(p => {
      const aportes = PMath.sum(
        allTransactions
          .filter(t => t.type === 'INGRESO' && t.category === 'Aporte Cliente' && t.projectId === p.id)
          .map(t => t.amount || 0)
      );
     const costoTotal = p.budget || 0;
     const pendiente = PMath.sub(costoTotal, aportes);
     return { id: p.id, name: p.name || 'Sin nombre', costoTotal, aportes, pendiente: Math.max(0, pendiente), progress: p.progress || 0 };
   }).sort((a, b) => b.pendiente - a.pendiente);

   // Activity heatmap data - Últimos 84 días de actividad
   const heatmapData = Array.from({ length: 84 }).map((_, i) => {
     const date = new Date();
     date.setDate(date.getDate() - (83 - i));
     const dateStr = date.toISOString().split('T')[0];
     const dayTx = allTransactions.filter(t => t.date === dateStr).length;
     return { date: dateStr, value: dayTx };
   });

  const getCardStyle = () => {
    switch (settings.cardStyle) {
      case 'flat': return 'bg-neutral-50 border border-neutral-100 shadow-none';
      case 'glass': return 'bg-(--color-surface-solid)/40 backdrop-blur-md border border-[rgba(255,255,255,0.5)] shadow-xl';
      case 'bordered': return 'bg-(--color-surface-solid) border-2 border-neutral-900 shadow-none';
      case 'elevated':
      default: return 'bg-(--color-surface-solid) border border-neutral-200 shadow-sm hover:shadow-md transition-shadow';
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
  const loading = loaded || resetting;

  return loading ? (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
    </div>
  ) : (
    <div id="dashboard-container" className="flex flex-col gap-2 h-full min-h-0 pb-[calc(4rem+env(safe-area-inset-bottom,0))] scroll-mb-[calc(4rem+env(safe-area-inset-bottom,0))]">

      {/* Accounting Modal */}
      <Modal 
        isOpen={isAccountingModalOpen} 
        onClose={() => setIsAccountingModalOpen(false)}
        title="Registro Contable"
      >
        <div className="space-y-4 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Tipo Registro</label>
              <div className="flex bg-neutral-100 p-1 rounded-xl gap-1">
                <button 
                  type="button"
                  onClick={() => setAccountingForm({ ...accountingForm, type: 'Entrada', category: entryCategories[0] })}
                  className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", accountingForm.type === 'Entrada' ? "bg-(--color-surface-solid) text-success shadow-sm" : "text-neutral-400")}
                >
                  <ArrowDownLeft size={10} className="inline mr-1" />
                  Ingreso (+)
                </button>
                <button 
                  type="button"
                  onClick={() => setAccountingForm({ ...accountingForm, type: 'Salida', category: exitCategories[0] })}
                  className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", accountingForm.type === 'Salida' ? "bg-(--color-surface-solid) text-error shadow-sm" : "text-neutral-400")}
                >
                  <ArrowUpRight size={10} className="inline mr-1" />
                  Gasto (-)
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="accounting-date" className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Fecha</label>
               <input 
                 id="accounting-date"
                 type="date"
                 value={accountingForm.date}
                 onChange={(e) => setAccountingForm({ ...accountingForm, date: e.target.value })}
                 className="w-full input-modern text-[10px] font-black focus:outline-none focus:ring-1 focus:ring-secondary"
                 title="Fecha del movimiento"
               />
            </div>
          </div>

          <div>
              <label htmlFor="accounting-category" className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Categoría</label>
               <select 
                 id="accounting-category"
                 value={accountingForm.category}
                 onChange={(e) => setAccountingForm({ ...accountingForm, category: e.target.value })}
                 className={cn("w-full input-modern text-[9px] font-black uppercase py-1.5 px-3", accountingForm.type === 'Entrada' ? 'text-success' : 'text-error')}
                 title="Seleccionar categoría"
             >
               {(accountingForm.type === 'Entrada' ? entryCategories : exitCategories).map(cat => (
                 <option key={cat} value={cat}>{cat}</option>
               ))}
             </select>
          </div>
          <div>
              <label htmlFor="accounting-project" className="label">Proyecto (opcional)</label>
              <select
                id="accounting-project"
                value={accountingForm.projectId}
                onChange={(e) => setAccountingForm({ ...accountingForm, projectId: e.target.value })}
                className="select"
                title="Asignar a proyecto"
            >
              <option value="">Sin proyecto especifico</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {accountingForm.projectId && (() => {
            const proj = projects.find(p => p.id === accountingForm.projectId);
            const budgetLines: { id: string; code: string; description: string }[] = [];
            const flatten = (lines: any[]) => {
              for (const l of lines || []) {
                if (l.code && l.description) budgetLines.push({ id: l.id || l.code, code: l.code, description: l.description });
                if (l.children) flatten(l.children);
              }
            };
            flatten(proj?.budgetTree || proj?.items || []);
            if (budgetLines.length === 0) return null;
            return (
              <div>
                <label htmlFor="accounting-budgetline" className="label">Renglón del presupuesto (opcional)</label>
                <select
                  id="accounting-budgetline"
                  value={accountingForm.budgetLineId}
                  onChange={(e) => setAccountingForm({ ...accountingForm, budgetLineId: e.target.value })}
                  className="select"
                  title="Vincular a renglón"
                >
                  <option value="">Sin renglón específico</option>
                  {budgetLines.map(bl => (
                    <option key={bl.id} value={bl.id}>{bl.code} — {bl.description}</option>
                  ))}
                </select>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="accounting-quantity" className="label">Cantidad / Unidades</label>
               <input 
                  id="accounting-quantity"
                  type="number"
                  step="0.01"
                  value={accountingForm.quantity || ''}
                  onChange={(e) => setAccountingForm({ ...accountingForm, quantity: parseFloat(e.target.value) || 0 })}
                  className="input"
                 placeholder="1"
                 title="Cantidad"
               />
            </div>
            <div className="space-y-2">
              <label htmlFor="accounting-cost" className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Costo / Precio Unit. (Q)</label>
               <input 
                 id="accounting-cost"
                 type="number"
                 step="0.01"
                 value={accountingForm.cost || ''}
                 onChange={(e) => setAccountingForm({ ...accountingForm, cost: parseFloat(e.target.value) || 0 })}
                 className="w-full input-modern text-[10px] font-black focus:outline-none focus:ring-1 focus:ring-secondary"
                 placeholder="0.00"
                 title="Costo unitario"
               />
            </div>
          </div>

          <div>
              <label htmlFor="accounting-description" className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">Descripción de la Factura / Movimiento</label>
               <textarea 
                 id="accounting-description"
                 value={accountingForm.description}
                 onChange={(e) => setAccountingForm({ ...accountingForm, description: e.target.value })}
                 placeholder="Ej: Pago sub-contrato Fase 1, Compra de cemento..."
                 className="w-full input-modern text-[10px] font-black uppercase focus:outline-none focus:border-secondary min-h-20"
                 title="Descripción del movimiento"
             />
          </div>

          <Button
            type="button"
            onClick={handleAccountingSubmit}
            disabled={accountingForm.cost <= 0 || accountingForm.quantity <= 0}
            className="w-full mt-2"
          >
            Registrar en Contabilidad
          </Button>
        </div>
      </Modal>

      {/* Reset Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-(--color-surface-solid) rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-neutral-100">
              <div>
                <h3 className="text-sm font-black text-neutral-900 uppercase tracking-tight">Limpiar Datos del Sistema</h3>
                <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">Selecciona los registros a eliminar</p>
              </div>
              <button title="Cerrar" onClick={() => setIsResetModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-xl transition-all"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {Object.entries(resetData).map(([col, { items, selected }]) => {
                const labels: Record<string, string> = { projects: 'Proyectos', inventory: 'Inventario', transactions: 'Transacciones', staff: 'Personal', suppliers: 'Proveedores', clients: 'Clientes' };
                const allChecked = selected.length === items.length;
                return (
                  <div key={col} className="border border-neutral-100 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-neutral-50 border-b border-neutral-100">
                      <input title="Seleccionar todos" type="checkbox" checked={allChecked} onChange={() => setResetData(prev => ({ ...prev, [col]: { ...prev[col], selected: allChecked ? [] : items.map((d: any) => d.id) } }))} className="w-4 h-4 accent-red-500 cursor-pointer" />
                      <span className="text-[10px] font-black text-neutral-700 uppercase tracking-widest flex-1">{labels[col] || col}</span>
                      <span className="text-[8px] font-bold text-(--color-p-500)">{selected.length}/{items.length} seleccionados</span>
                    </div>
                    <div className="divide-y divide-neutral-50 max-h-40 overflow-y-auto">
                      {items.map((item: any) => (
                        <label key={item.id} className="flex items-center gap-3 px-4 py-2 hover:bg-neutral-50 cursor-pointer transition-colors">
                          <input title={`Seleccionar ${item.name || item.description}`} type="checkbox" checked={selected.includes(item.id)}
                            onChange={() => setResetData(prev => {
                              const sel = prev[col].selected;
                              return { ...prev, [col]: { ...prev[col], selected: sel.includes(item.id) ? sel.filter(s => s !== item.id) : [...sel, item.id] } };
                            })} className="w-3.5 h-3.5 accent-red-500 cursor-pointer shrink-0" />
                          <span className="text-[9px] font-bold text-neutral-600 truncate">{item.name || item.description || item.id.slice(0, 12)}</span>
                          <span className="text-[7px] text-(--color-p-400) font-mono ml-auto shrink-0">{item.id.slice(0, 8)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {Object.keys(resetData).length === 0 && (
                <p className="text-center text-[10px] text-neutral-400 uppercase tracking-widest py-8">No hay datos para eliminar</p>
              )}
            </div>
            <div className="p-5 border-t border-neutral-100 flex gap-3">
              <Button variant="ghost" onClick={() => setIsResetModalOpen(false)} className="flex-1">Cancelar</Button>
              <Button variant="danger" onClick={handleConfirmReset} disabled={resetting || Object.values(resetData).every((v: any) => v.selected.length === 0)} className="flex-1">
                {resetting ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Eliminando...</> : <><AlertTriangle size={12} /> Eliminar Seleccionados</>}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Hidden report capture */}
      <div ref={reportCaptureRef} className="hidden" />

      {/* Dashboard Top Header (Professional & Current) */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-2 bg-[#0c1222]/50 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Zap size={24} className="text-black" />
          </div>
          <div className="text-left">
            <h2 className="text-base md:text-lg font-black text-white uppercase tracking-tight leading-none">Panel de Control</h2>
            <p className="text-[9px] md:text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mt-1 opacity-70">Resumen Estratégico WM/M&S</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2 bg-black/30 px-4 py-2.5 rounded-2xl border border-white/5 group hover:border-amber-500/30 transition-all">
            <CalendarIcon size={14} className="text-amber-500" />
            <input 
              type="date" 
              value={reportDateFrom} 
              onChange={e => setReportDateFrom(e.target.value)}
              className="bg-transparent text-[10px] font-black text-white uppercase focus:outline-none w-28 cursor-pointer"
              title="Fecha inicial"
            />
            <span className="text-white/20 font-bold">—</span>
            <input 
              type="date" 
              value={reportDateTo} 
              onChange={e => setReportDateTo(e.target.value)}
              className="bg-transparent text-[10px] font-black text-white uppercase focus:outline-none w-28 cursor-pointer"
              title="Fecha final"
            />
          </div>

          <button 
            onClick={generateReport} 
            disabled={generating}
            className="flex items-center gap-2.5 px-6 py-2.5 rounded-2xl bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 disabled:opacity-50 transition-all shadow-[0_8px_20px_rgba(245,158,11,0.2)] active:scale-95"
          >
            {generating ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <Printer size={16} strokeWidth={2.5} />}
            GENERAR REPORTE
          </button>
        </div>
      </div>

      <div className="shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: selectedProjectId === 'ALL' ? 'Proyectos Activos' : 'Proyecto Seleccionado', value: filteredProjects.length, currency: false, icon: <Zap size={16} />, color: 'bg-amber-500', spark: null, pulse: executingProjects.length > 0, rings: { fisico: avgFisico, financiero: avgFinanciero }, onNavigate: () => setActiveTab?.('seguimiento') },
            { label: 'Efectivo Neto', value: netCash, currency: true, icon: <DollarSign size={16} />, color: netCash >= 0 ? 'bg-emerald-500' : 'bg-rose-500', spark: sparkNet, sparkColor: netCash >= 0 ? 'varsuccess' : 'varerror', pulse: false },
            { label: selectedProjectId === 'ALL' ? 'Presp. Ejecución' : 'Presp. Proyecto', value: executingBudget, currency: true, icon: <TrendingUp size={16} />, color: 'bg-blue-500', spark: sparkInc, sparkColor: 'varaccent', pulse: false },
            { label: 'Presp. Fin/Pausa', value: finishedPausedBudget, currency: true, icon: <CheckCircle2 size={16} />, color: 'bg-slate-500', spark: null, pulse: false },
            { label: 'Alertas Stock', value: criticalStock, currency: false, icon: <ShieldCheck size={16} />, color: criticalStock > 0 ? 'bg-orange-500' : 'bg-emerald-500', spark: sparkExp, sparkColor: criticalStock > 0 ? 'varerror' : 'varsuccess', pulse: criticalStock > 0 },
          ].map((kpi, i) => (
            <KpiCard key={i} kpi={kpi} cardClass={cardClass} index={i} />
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <motion.div
        key={selectedProjectId + selectedYear}
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex flex-col lg:flex-row gap-3 lg:gap-6 flex-1 min-h-0 overflow-visible"
      >
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          {/* Row 1: Main Visual Analytics */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
             {/* Cash Flow Chart */}
              <motion.div variants={staggerItem} className="bg-white rounded-4xl p-4 sm:p-6 shadow-xl border border-slate-100 flex flex-col min-h-55 lg:min-h-[350px]">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">{selectedProjectId === 'ALL' ? 'Flujo de Caja Global' : 'Flujo del Proyecto'}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ingresos vs Egresos</p>
                  </div>
                </div>
                <div className="flex-1 w-full min-h-55">
                  <ResponsiveContainer width="100%" height="100%">
                    {settings.graphType === 'bar' ? (
                      <ComposedChart data={chartData}>
                        <defs>
                          <linearGradient id="barGradIngresos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.6} />
                          </linearGradient>
                          <linearGradient id="barGradGastos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.6} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700}} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700}} />
                        <ChartTooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip />} />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', paddingBottom: 20 }} />
                        <Bar dataKey="ingresos" name="Ingresos" fill="url(#barGradIngresos)" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="gastos" name="Egresos" fill="url(#barGradGastos)" radius={[4, 4, 0, 0]} barSize={20} />
                      </ComposedChart>
                    ) : (
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700}} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700}} />
                        <ChartTooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={3} fill="url(#gradIngresos)" />
                        <Area type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={3} fill="url(#gradGastos)" />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
             </motion.div>

             {/* Distribution & Performance */}
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Gauge Section */}
                <motion.div variants={staggerItem} className="bg-white rounded-4xl p-6 shadow-xl border border-slate-100 flex flex-col items-center justify-center">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Eficiencia de Ejecución</h3>
                   <div className="flex gap-8">
                      <GaugeChart value={avgFisico} label="Físico" color="#f59e0b" />
                      <GaugeChart value={avgFinanciero} label="Financiero" color="#3b82f6" />
                   </div>
                </motion.div>

                {/* Expenses Pie */}
                <motion.div variants={staggerItem} className="bg-white rounded-4xl p-6 shadow-xl border border-slate-100 flex flex-col min-h-40">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Gastos por Categoría</h3>
                   <div className="flex-1 flex items-center gap-4">
                      <div className="w-1/2 h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={expenseByCategory.length > 0 ? expenseByCategory : [{ name: 'Sin Datos', value: 1 }]}
                              innerRadius={35}
                              outerRadius={50}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {expenseByCategory.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                              ))}
                            </Pie>
                            <ChartTooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-1/2 space-y-1.5">
                         {expenseByCategory.slice(0, 4).map((item, i) => (
                           <div key={i} className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                 <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                 <span className="text-[9px] font-bold uppercase truncate text-slate-500">{item.name}</span>
                              </div>
                              <span className="text-[9px] font-black text-slate-900">{Math.round(item.value/totalExpenses*100)}%</span>
                           </div>
                         ))}
                      </div>
                   </div>
                </motion.div>
             </div>
          </div>

          {/* Row 2: Tables & Feed */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
             {/* Projects Table */}
             <motion.div variants={staggerItem} className="bg-white rounded-4xl p-6 shadow-xl border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Estado de Cuentas</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resumen por Proyecto</p>
                  </div>
                  {availableYears.length > 1 && (
                      <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[9px] font-black uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all cursor-pointer">
                        {availableYears.map(y => <option key={y} value={y}>{y === 'todos' ? 'TODOS LOS AÑOS' : y}</option>)}
                      </select>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4">Proyecto</th>
                        <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4 text-right">Inversión</th>
                        <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4 text-right">Aportes</th>
                        <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4 text-right">Pendiente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {tableData.slice(0, 6).map(row => (
                        <tr key={row.id} className="group hover:bg-slate-50/80 transition-all">
                          <td className="py-4 font-black text-slate-900 uppercase text-[11px] truncate max-w-37.5">{row.name}</td>
                          <td className="py-4 text-right font-mono font-bold text-slate-600 text-[11px]">{fmtQ(row.costoTotal)}</td>
                          <td className="py-4 text-right font-mono font-black text-emerald-500 text-[11px]">{fmtQ(row.aportes)}</td>
                          <td className={cn("py-4 text-right font-mono font-black text-[11px]", row.pendiente > 0 ? "text-amber-500" : "text-slate-300")}>{fmtQ(row.pendiente)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {tableData.length === 0 && (
                    <div className="py-12 flex flex-col items-center opacity-20">
                       <Building2 size={32} />
                       <p className="text-[10px] font-black uppercase mt-3 tracking-widest">Sin proyectos activos</p>
                    </div>
                  )}
                </div>
             </motion.div>

             {/* Recent Activity */}
             <motion.div variants={staggerItem} className="bg-white rounded-4xl p-6 shadow-xl border border-slate-100 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Movimientos Recientes</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Últimas 15 transacciones</p>
                  </div>
                  <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase">{filteredTransactions.length} TOTAL</span>
                </div>
                 <div className="flex-1 overflow-y-auto max-h-62.5 lg:max-h-[350px] pr-2 custom-scrollbar">
                   <div className="space-y-3">
                      {filteredTransactions.slice(0, 15).map((t, i) => (
                        <div key={t.id || i} className="group flex items-center justify-between p-4 bg-slate-50 hover:bg-white rounded-2xl border border-slate-100 hover:shadow-lg transition-all cursor-default">
                           <div className="flex items-center gap-4 min-w-0">
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", t.type === 'INGRESO' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')}>
                                 {t.type === 'INGRESO' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate">{t.description || '--'}</p>
                                 <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase">{t.category}</span>
                                    <span className="text-[9px] font-bold text-slate-300">•</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{t.date?.split('-').reverse().join('/')}</span>
                                 </div>
                              </div>
                           </div>
                           <div className="text-right ml-4">
                              <p className={cn("text-xs font-black", t.type === 'INGRESO' ? 'text-emerald-600' : 'text-rose-600')}>
                                 {t.type === 'INGRESO' ? '+' : '-'} {fmtQ(Math.abs(t.amount || 0))}
                              </p>
                               <div className="flex gap-1 mt-1 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                                 <button onClick={() => { setEditTx(t); setEditTxForm({ description: t.description || '', amount: t.amount || 0, type: t.type || 'GASTO', category: t.category || '', date: t.date || '' }); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-amber-500 transition-colors"><Pencil size={12} /></button>
                                 <button onClick={() => handleDeleteTx(t.id)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={12} /></button>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </motion.div>
          </div>
        </div>

        {/* Side Actions / Live Feed */}
        <aside className="hidden lg:flex flex-col gap-6 w-80 shrink-0 overflow-visible">
            {/* User Profile Card */}
            <motion.div variants={staggerItem} className="bg-[#0c1222] rounded-[2.5rem] p-8 text-left relative overflow-hidden border border-white/5 shadow-2xl">
               <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px]" />
               <div className="relative z-10">
                  <div className="flex items-center gap-5 mb-8">
                     <div className="relative group">
                        <Avatar src={user?.photoURL || undefined} size="xl" className="border-2 border-amber-500/30 group-hover:border-amber-500 transition-all duration-500" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-[3px] border-[#0c1222] rounded-full shadow-lg" />
                     </div>
                     <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] opacity-80">Administrador</span>
                        <h2 className="text-lg font-black text-white truncate tracking-tight">{user?.displayName}</h2>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-8">
                     <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-all">
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1.5">Aportes</p>
                        <p className="text-sm font-black text-emerald-500 truncate">{fmtQ(totalIncome)}</p>
                     </div>
                     <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-all">
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1.5">Inversión</p>
                        <p className="text-sm font-black text-rose-500 truncate">{fmtQ(totalExpenses)}</p>
                     </div>
                  </div>

                  <button
                    onClick={() => setIsAccountingModalOpen(true)}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-amber-500 text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-amber-400 transition-all shadow-[0_12px_24px_rgba(245,158,11,0.25)] active:scale-95 group"
                  >
                    <Plus size={18} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
                    REGISTRAR MOVIMIENTO
                  </button>
               </div>
            </motion.div>

            {/* Agenda Widget */}
            <motion.div variants={staggerItem} className="bg-white rounded-[2.5rem] p-8 text-left shadow-2xl border border-slate-100 flex-1 flex flex-col min-h-0">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-sm border border-amber-100">
                        <CalendarIcon size={20} strokeWidth={2.5} />
                     </div>
                     <div>
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">Agenda ERP</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Planificación</p>
                     </div>
                  </div>
                  <span className="bg-slate-50 border border-slate-100 text-slate-500 text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest">{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
               </div>
               
               <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                  {agendaEvents.filter(e => e.date === new Date().toISOString().split('T')[0]).length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-16 opacity-20 grayscale">
                        <CalendarIcon size={48} strokeWidth={1} />
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-[0.2em]">Despejado por hoy</p>
                     </div>
                  ) : (
                    agendaEvents.filter(e => e.date === new Date().toISOString().split('T')[0]).map(e => (
                      <div key={e.id} className="group relative bg-slate-50 hover:bg-amber-50/50 p-5 rounded-3xl border border-slate-100 hover:border-amber-200 transition-all cursor-default shadow-sm hover:shadow-md">
                         <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{e.time}</span>
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                         </div>
                         <p className="text-[12px] font-black text-slate-800 leading-tight uppercase tracking-tight">{e.title}</p>
                      </div>
                    ))
                  )}
               </div>

               <button 
                 onClick={() => setActiveTab?.('settings')}
                 className="mt-8 w-full py-4 rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] hover:border-amber-500/50 hover:bg-amber-50 hover:text-amber-600 transition-all duration-300"
               >
                 ABRIR CALENDARIO
               </button>
            </motion.div>

            {/* Tipologia Stats (Mini) */}
            <motion.div variants={staggerItem} className="bg-linear-to-br from-amber-400 to-orange-500 p-6 rounded-[2.5rem] text-primary shadow-xl shadow-amber-500/20 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-10 group-hover:scale-150 transition-transform duration-700" />
                <div className="relative z-10">
                   <div className="flex items-center gap-3 mb-4">
                      <Zap size={20} className="fill-current" />
                      <span className="text-[10px] font-black uppercase tracking-[0.15em]">Mix de Tipologías</span>
                   </div>
                   <div className="space-y-2.5">
                     {(() => {
                       const typeCounts: Record<string, number> = {};
                       projects.forEach(p => {
                         const t = p.typology || 'OTRO';
                         typeCounts[t] = (typeCounts[t] || 0) + 1;
                       });
                       const total = projects.length || 1;
                       return Object.entries(typeCounts)
                         .sort((a, b) => b[1] - a[1])
                         .slice(0, 4)
                         .map(([type, count]) => (
                           <div key={type} className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-black/10 rounded-full overflow-hidden">
                                 <motion.div 
                                   initial={{ width: 0 }}
                                   animate={{ width: `${Math.round(count/total*100)}%` }}
                                   className="h-full bg-white shadow-sm"
                                 />
                              </div>
                              <span className="text-[9px] font-black text-white min-w-7.5">{Math.round(count/total*100)}%</span>
                              <span className="text-[8px] font-black text-black/40 uppercase truncate max-w-20 text-right">{type}</span>
                           </div>
                         ));
                     })()}
                   </div>
                </div>
            </motion.div>
        </aside>
      </motion.div>

      {/* Edit Transaction Modal */}
      {editTx && (
        <div className='fixed inset-0 z-200 flex items-center justify-center p-4'>
          <div className='absolute inset-0 bg-neutral-900/40 backdrop-blur-sm' onClick={() => setEditTx(null)} />
          <div className='relative w-full max-w-md bg-(--color-surface-solid) rounded-2xl shadow-2xl p-6 border border-neutral-200'>
            <h3 className='text-sm font-black text-primary uppercase tracking-widest mb-5'>Editar Movimiento</h3>
            <form onSubmit={handleEditTxSave} className='space-y-4 text-left'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div><label htmlFor="edit-tx-type" className="label">Tipo</label><select id="edit-tx-type" title="Tipo de movimiento" value={editTxForm.type} onChange={e => setEditTxForm({ ...editTxForm, type: e.target.value })} className='select'><option value='INGRESO'>INGRESO</option><option value='GASTO'>GASTO</option></select></div>
                <div><label htmlFor="edit-tx-date" className="label">Fecha</label><input id="edit-tx-date" title="Fecha" type='date' value={editTxForm.date} onChange={e => setEditTxForm({ ...editTxForm, date: e.target.value })} className='input' /></div>
              </div>
              <div><label htmlFor="edit-tx-desc" className="label">Descripcion</label><input id="edit-tx-desc" title="Descripción" type='text' value={editTxForm.description} onChange={e => setEditTxForm({ ...editTxForm, description: e.target.value })} className='input' /></div>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div><label htmlFor="edit-tx-cat" className="label">Categoria</label><input id="edit-tx-cat" title="Categoría" type='text' value={editTxForm.category} onChange={e => setEditTxForm({ ...editTxForm, category: e.target.value })} className='input' /></div>
                <div><label htmlFor="edit-tx-amount" className="label">Monto (Q)</label><input id="edit-tx-amount" title="Monto" type='number' step='0.01' value={editTxForm.amount} onChange={e => setEditTxForm({ ...editTxForm, amount: parseFloat(e.target.value) || 0 })} className='input' /></div>
              </div>
              <div className='flex gap-2 pt-2'>
                <Button variant="ghost" type='button' onClick={() => setEditTx(null)} className='flex-1'>Cancelar</Button>
                <Button type='submit' className='flex-1'>Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile-only floating accounting FAB */}
      <button
        onClick={() => setIsAccountingModalOpen(true)}
        className="lg:hidden fixed right-5 bottom-24 z-50 w-14 h-14 rounded-full bg-amber-500 text-black shadow-xl flex items-center justify-center hover:bg-amber-400 active:scale-90 transition-all"
        aria-label="Registrar movimiento"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>
    </div>
  );
}


