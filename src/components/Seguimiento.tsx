/**
 * Módulo de Seguimiento — Avance Físico y Financiero
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToCollection } from '../services/firestoreService';
import {
  RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, LineChart, Line
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Building2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
function fmtQ(n: number) { return 'Q ' + n.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function pct(n: number) { return Math.min(100, Math.max(0, Math.round(n))); }

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

function RingChart({ value, color, label, size = 80 }: { value: number; color: string; label: string; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const trackColor = document.documentElement.classList.contains('dark') ? '#334155' : '#e2e8f0';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={6} />
          <motion.circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-black text-slate-700">{value}%</span>
        </div>
      </div>
      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">{label}</span>
    </div>
  );
}

export default function Seguimiento() {
  const [projects, setProjects] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('ALL');

  useEffect(() => {
    const u1 = subscribeToCollection('projects', setProjects);
    const u2 = subscribeToCollection('transactions', setTransactions);
    return () => { u1(); u2(); };
  }, []);

  const active = projects.filter(p => p.status === 'EJECUCION');
  const selected = selectedId === 'ALL' ? null : active.find(p => p.id === selectedId);

  // Aggregate data
  const projectsData = active.map(p => {
    const totalCost = (p.items || []).reduce((s: number, it: any) => {
      const mat = (it.materials || []).reduce((a: number, m: any) => a + (m.unitCost || 0) * (m.quantity || 0) * (it.projectQuantity || 1), 0);
      const lab = (it.labor || []).reduce((a: number, l: any) => a + (l.unitCost || 0) * (l.quantity || 0) * (it.projectQuantity || 1), 0);
      return s + mat + lab;
    }, 0);
    const budget = p.budget || 1;
    const financiero = pct((totalCost / budget) * 100);
    const fisico = pct(p.progress || 0);
    const txIncome = transactions.filter(t => t.projectId === p.id && t.type === 'INGRESO').reduce((a: number, t: any) => a + (t.amount || 0), 0);
    const txExpense = transactions.filter(t => t.projectId === p.id && t.type === 'GASTO').reduce((a: number, t: any) => a + (t.amount || 0), 0);
    return { ...p, totalCost, financiero, fisico, txIncome, txExpense };
  });

  const displayProjects = selected ? projectsData.filter(p => p.id === selectedId) : projectsData;

  // Comparison bar chart data
  const barData = displayProjects.map(p => ({
    name: p.name?.slice(0, 14) || 'Proyecto',
    'Avance Físico': p.fisico,
    'Avance Financiero': p.financiero,
  }));

  // Deviation analysis
  const desvData = displayProjects.map(p => ({
    name: p.name?.slice(0, 14) || 'Proyecto',
    desviacion: p.fisico - p.financiero,
    fill: p.fisico >= p.financiero ? '#10b981' : '#ef4444',
  }));

  // Budget vs cost area
  const areaData = displayProjects.map(p => ({
    name: p.name?.slice(0, 14) || 'Proyecto',
    Presupuesto: p.budget || 0,
    'Costo Real': p.totalCost || 0,
    Ingresos: p.txIncome || 0,
    Egresos: p.txExpense || 0,
  }));

  // Pie: status distribution
  const statusMap: Record<string, number> = {};
  projects.forEach(p => { statusMap[p.status] = (statusMap[p.status] || 0) + 1; });
  const pieData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

  const avgFisico = displayProjects.length ? Math.round(displayProjects.reduce((a, p) => a + p.fisico, 0) / displayProjects.length) : 0;
  const avgFinanciero = displayProjects.length ? Math.round(displayProjects.reduce((a, p) => a + p.financiero, 0) / displayProjects.length) : 0;
  const totalBudget = displayProjects.reduce((a, p) => a + (p.budget || 0), 0);
  const totalCostAll = displayProjects.reduce((a, p) => a + (p.totalCost || 0), 0);

  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Módulo de Análisis</p>
          <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">Seguimiento de Avance</h1>
        </div>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="w-full md:w-64 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase focus:outline-none focus:border-amber-400 shadow-sm"
        >
          <option value="ALL">TODOS LOS PROYECTOS EN EJECUCIÓN</option>
          {active.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Avance Físico Prom.', value: `${avgFisico}%`, color: '#f59e0b', icon: <TrendingUp size={14} /> },
          { label: 'Avance Financiero Prom.', value: `${avgFinanciero}%`, color: '#3b82f6', icon: <TrendingDown size={14} /> },
          { label: 'Presupuesto Total', value: fmtQ(totalBudget), color: '#10b981', icon: <CheckCircle2 size={14} /> },
          { label: 'Costo Acumulado', value: fmtQ(totalCostAll), color: totalCostAll > totalBudget ? '#ef4444' : '#10b981', icon: <AlertTriangle size={14} /> },
        ].map((k, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg text-white" style={{ background: k.color }}>{k.icon}</div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{k.label}</p>
            </div>
            <p className="text-sm font-black text-slate-900">{k.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 flex-1">

        {/* Ring charts per project */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Avance por Proyecto</p>
          <div className="space-y-4 overflow-auto max-h-64">
            {displayProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 opacity-40">
                <Building2 size={24} className="text-slate-300 mb-2" />
                <p className="text-[8px] font-black uppercase tracking-widest">Sin proyectos en ejecución</p>
              </div>
            ) : displayProjects.map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                <RingChart value={p.fisico} color="#f59e0b" label="Físico" size={64} />
                <RingChart value={p.financiero} color="#3b82f6" label="Financiero" size={64} />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-slate-700 uppercase truncate">{p.name}</p>
                  <p className="text-[8px] text-slate-400 font-bold">{p.clientName || 'S/N'}</p>
                  <div className={cn("mt-1 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full inline-block",
                    p.fisico >= p.financiero ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                  )}>
                    {p.fisico >= p.financiero ? '▲ En control' : '▼ Desfase'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison bar chart */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Comparativa Físico vs Financiero</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 8 }} domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 8, fontWeight: 700 }} />
              <Bar dataKey="Avance Físico" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Avance Financiero" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Deviation chart */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Desviación (Físico − Financiero)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={desvData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 8 }} unit="%" />
              <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
              <Bar dataKey="desviacion" radius={[4, 4, 0, 0]}>
                {desvData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Budget vs Cost area */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm md:col-span-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Presupuesto vs Costo Real (Q)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={areaData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `Q${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => fmtQ(v)} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 8, fontWeight: 700 }} />
              <Bar dataKey="Presupuesto" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Costo Real" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Ingresos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Egresos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status pie */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Distribución por Estado</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                label={({ name, value }) => `${name}: ${value}`} labelLine={false}
              >
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}
