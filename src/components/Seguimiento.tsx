/**
 * Módulo de Seguimiento — Avance Físico y Financiero
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';
import { fmtQ, precise, PMath } from '../engine/precision';
import { useStore } from '../store/DataStore';
import { trackEvent } from '../utils/logger';
import {
  RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, LineChart, Line, ComposedChart
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Building2, FileDown, Calendar } from 'lucide-react';
import { generateProgressReport } from '../lib/reportEngine';
import { Button } from './ui/button';

function pct(n: number) { return Math.min(100, Math.max(0, Math.round(n))); }

const COLORS = ['var(--color-warning)', 'var(--color-info)', 'var(--color-success)', 'var(--color-error)', '#8b5cf6', '#06b6d4'];

function RingChart({ value, color, label, size = 80 }: { value: number; color: string; label: string; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value, 100);
  const dash = (pct / 100) * circ;
  const trackColor = 'var(--color-neutral-200)';
  const isOver = value > 100;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[var(--ring-size)] h-[var(--ring-size)]" style={{ '--ring-size': `${size}px` } as React.CSSProperties}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={6} />
          <motion.circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={isOver ? '#ef4444' : color} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-black text-slate-700 ">{value}%</span>
        </div>
      </div>
      <span className="text-[9px] sm:text-[8px] font-black text-slate-400  uppercase tracking-widest text-center">{label}</span>
    </div>
  );
}

export default function Seguimiento() {
   const store = useStore();
   const [selectedId, setSelectedId] = useState<string>('ALL');

   // DataStore data
   const projects = store.projects.items;
   const allTransactions = store.transactions.items;
   const inventory = store.inventory.items;
   const loading = store.projects.isLoading || store.transactions.isLoading || store.inventory.isLoading;

   const active = projects.filter(p => p.status === 'EJECUCION');
   const selected = selectedId === 'ALL' ? null : active.find(p => p.id === selectedId);

   // Aggregate data
   const projectsData = active.map(p => {
     // Use real transaction expenses for financiero, fallback to budget items cost
     const txExpense = PMath.sum(allTransactions.filter(t => t.projectId === p.id && t.type === 'GASTO').map(t => t.amount || 0));
     const txIncome  = PMath.sum(allTransactions.filter(t => t.projectId === p.id && t.type === 'INGRESO').map(t => t.amount || 0));
     const totalCost  = txExpense;
     const budget     = p.budget || 1;
     const financieroRaw = PMath.div(PMath.mul(totalCost, 100), budget);
     const financiero = Math.round(financieroRaw);
     const fisico = pct(p.progress || 0);
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
   const areaData = displayProjects.map(p => {
     const indirectRate = PMath.div(PMath.add(PMath.add(p.indirectCosts || 0, p.administrativeCosts || 0), p.personalCosts || 0), 100);
     const totalCostWithIndirect = PMath.mul(p.totalCost || 0, PMath.add(1, indirectRate));
     return {
       name: p.name?.slice(0, 14) || 'Proyecto',
       Presupuesto: p.budget || 0,
       'Costo Directo': p.totalCost || 0,
       'Costo Total': Math.round(totalCostWithIndirect),
       Ingresos: p.txIncome || 0,
       Egresos: p.txExpense || 0,
     };
   });

   // Pie: status distribution
   const statusMap: Record<string, number> = {};
   projects.forEach(p => { statusMap[p.status] = (statusMap[p.status] || 0) + 1; });
   const pieData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

   const avgFisico = displayProjects.length ? Math.round(PMath.div(PMath.sum(displayProjects.map(p => p.fisico)), displayProjects.length)) : 0;
   const avgFinanciero = displayProjects.length ? Math.round(PMath.div(PMath.sum(displayProjects.map(p => p.financiero)), displayProjects.length)) : 0;
   const totalBudget = PMath.sum(displayProjects.map(p => p.budget || 0));
   const totalCostAll = PMath.sum(displayProjects.map(p => p.totalCost || 0));

   // Materials: budgeted vs used per project
   const materialData = (() => {
     const projectsToShow = selectedId === 'ALL' ? projects.filter(p => p.status === 'EJECUCION') : projects.filter(p => p.id === selectedId);
     return projectsToShow.map(p => {
       const projItems = inventory.filter((i: any) => i.projectId === p.id && i.budgetedQty != null);
       const budgeted = PMath.sum(projItems.map((i: any) => PMath.mul(i.budgetedQty || 0, i.budgetedCost || 0)));
       const used = PMath.sum(projItems.map((i: any) => PMath.mul(i.usedQty || 0, i.budgetedCost || 0)));
       const received = PMath.sum(projItems.map((i: any) => PMath.mul(i.stock || 0, i.budgetedCost || 0)));
       return { name: p.name?.slice(0, 14) || 'Proyecto', Presupuestado: budgeted, Ejecutado: used, 'En Bodega': received };
     }).filter(d => d.Presupuestado > 0 || d.Ejecutado > 0);
   })();

  return (
    <div className="flex flex-col h-full p-3 gap-3 overflow-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0px))] scroll-mb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl p-3 shadow-lg">
        <div>
          <p className="text-[9px] font-black text-slate-400  uppercase tracking-[0.2em]">Módulo de Análisis</p>
          <h1 className="text-sm font-black text-slate-900  uppercase tracking-tight">Seguimiento de Avance</h1>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            title="Filtrar por proyecto"
            className="select"
          >
            <option value="ALL">TODOS LOS PROYECTOS EN EJECUCION</option>
            {active.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
{selected && (
              <Button
                onClick={() => generateProgressReport(selected, undefined, allTransactions)}
                variant="default"
                size="sm"
              >
               <FileDown size={14} />
               <span className="hidden sm:inline">Informe PDF</span>
             </Button>
            )}
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Avance Físico Prom.', value: `${avgFisico}%`, color: '#f59e0b', icon: <TrendingUp size={14} /> },
          { label: 'Avance Financiero Prom.', value: `${avgFinanciero}%`, color: '#3b82f6', icon: <TrendingDown size={14} /> },
          { label: 'Presupuesto Total', value: fmtQ(totalBudget), color: '#10b981', icon: <CheckCircle2 size={14} /> },
          { label: 'Costo Acumulado', value: fmtQ(totalCostAll), color: totalCostAll > totalBudget ? '#ef4444' : '#10b981', icon: <AlertTriangle size={14} /> },
        ].map((k, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl p-3 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg text-white bg-[var(--k-bg)]" style={{ '--k-bg': k.color } as React.CSSProperties}>{k.icon}</div>
              <p className="text-[9px] sm:text-[8px] font-black text-slate-400  uppercase tracking-widest">{k.label}</p>
            </div>
            <p className="text-sm font-black text-slate-900 ">{k.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 flex-1 grid-rows-[minmax(auto,1fr)]">

        {/* Ring charts per project */}
        <div className="bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl p-3 shadow-lg">
          <p className="text-[9px] font-black text-slate-400  uppercase tracking-widest mb-2">Avance por Proyecto</p>

          {displayProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 opacity-40">
              <Building2 size={24} className="text-slate-300 mb-2" />
              <p className="text-[8px] font-black uppercase tracking-widest">Sin proyectos en ejecución</p>
            </div>

          ) : selected ? (
            /* Single project: two big rings centered */
            <div className="flex flex-col items-center gap-4">
              <p className="text-[10px] font-black text-slate-700  uppercase truncate text-center">{selected.name}</p>
              <div className="flex justify-center gap-8">
                <RingChart value={displayProjects[0]?.fisico ?? 0} color="#f59e0b" label="Físico" size={100} />
                <RingChart value={displayProjects[0]?.financiero ?? 0} color="#06b6d4" label="Financiero" size={100} />
              </div>
              <div className="w-full grid grid-cols-2 gap-2 mt-2">
                <div className="bg-[var(--color-warning-bg)] rounded-xl p-2 text-center">
                  <p className="text-[7px] font-black text-[var(--color-warning)] uppercase tracking-widest">Presupuesto</p>
                   <p className="text-[11px] font-black text-slate-800 ">{fmtQ(displayProjects[0]?.budget || 0)}</p>
                </div>
                <div className="bg-[var(--color-info-bg)] rounded-xl p-2 text-center">
                  <p className="text-[7px] font-black text-[var(--color-info)] uppercase tracking-widest">Ejecutado</p>
                   <p className="text-[11px] font-black text-slate-800 ">{fmtQ(displayProjects[0]?.totalCost || 0)}</p>
                </div>
              </div>
              <div className={cn("text-[8px] font-black uppercase px-2 py-1 rounded-full",
                (displayProjects[0]?.fisico ?? 0) >= (displayProjects[0]?.financiero ?? 0)
                  ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" : "bg-red-50 text-[var(--color-error)]"
              )}>
                {(displayProjects[0]?.fisico ?? 0) >= (displayProjects[0]?.financiero ?? 0) ? '▲ En control' : '▼ Desfase financiero'}
              </div>

              {/* Pendiente de aportar */}
              <div className="w-full mt-3 bg-white/50 backdrop-blur-sm rounded-xl p-3">
                <div className="w-full text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2">Resumen Financiero</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Presupuesto</p>
                    <p className="text-[10px] font-black text-slate-800">{fmtQ(displayProjects[0]?.budget || 0)}</p>
                  </div>
                  <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Aportado</p>
                    <p className="text-[10px] font-black text-[var(--color-success)]">{fmtQ(displayProjects[0]?.txIncome || 0)}</p>
                  </div>
                  <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Ejecutado</p>
                    <p className="text-[10px] font-black text-[var(--color-info)]">{fmtQ(displayProjects[0]?.totalCost || 0)}</p>
                  </div>
                  <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 text-center">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Pendiente de Aportar</p>
                    <p className={cn("text-[10px] font-black",
                      ((displayProjects[0]?.budget || 0) - (displayProjects[0]?.txIncome || 0)) > 0
                        ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"
                    )}>
                      {fmtQ(Math.max(0, (displayProjects[0]?.budget || 0) - (displayProjects[0]?.txIncome || 0)))}
                    </p>
                  </div>
                </div>
              </div>
            </div>

          ) : (
            /* All projects: list with small rings */
            <div className="space-y-3 overflow-auto max-h-64">
              {displayProjects.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(p.id)}>
                  <RingChart value={p.fisico} color="#f59e0b" label="Fís." size={56} />
                  <RingChart value={p.financiero} color="#3b82f6" label="Fin." size={56} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-slate-700  uppercase truncate">{p.name}</p>
                    <p className="text-[8px] text-slate-400 font-bold">{p.clientName || 'S/N'}</p>
                    <div className={cn("mt-1 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full inline-block",
                      p.fisico >= p.financiero ? "bg-[var(--color-success-bg)] text-[var(--color-success)]" : "bg-red-50 text-[var(--color-error)]"
                    )}>
                      {p.fisico >= p.financiero ? '▲ En control' : '▼ Desfase'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comparison bar chart */}
        <div className="bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl p-3 shadow-lg">
          <p className="text-[9px] font-black text-slate-400  uppercase tracking-widest mb-2">Comparativa Físico vs Financiero</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
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
        <div className="bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl p-3 shadow-lg">
          <p className="text-[9px] font-black text-slate-400  uppercase tracking-widest mb-2">Desviación (Físico − Financiero)</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={desvData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
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
        <div className="bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl p-3 shadow-lg md:col-span-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Presupuesto vs Costos (Q)</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={areaData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
              <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `Q ${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => fmtQ(v as number)} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 8, fontWeight: 700 }} />
              <Bar dataKey="Presupuesto" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Costo Directo" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Costo Total" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Ingresos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Egresos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status pie */}
        <div className="bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl p-3 shadow-lg">
          <p className="text-[9px] font-black text-slate-400  uppercase tracking-widest mb-2">Distribución por Estado</p>
          <ResponsiveContainer width="100%" height={150}>
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

        {/* Materials: Budgeted vs Executed vs In Stock */}
        <div className="bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl p-3 shadow-lg md:col-span-2 xl:col-span-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[9px] font-black text-slate-400  uppercase tracking-widest">Materiales: Presupuestado vs Ejecutado</p>
              <p className="text-[8px] text-slate-300 mt-0.5">Costo de materiales presupuestados, consumidos y en bodega por proyecto</p>
            </div>
          </div>
          {materialData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 opacity-40">
              <TrendingUp size={24} className="text-slate-300 mb-2" />
              <p className="text-[9px] font-black text-slate-400  uppercase">Genera stock desde presupuesto en el módulo de Bodega</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150} minHeight={120}>
                <BarChart data={materialData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `Q${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => `Q. ${fmtQ(v as number)}`} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 8, fontWeight: 700 }} />
                  <Bar dataKey="Presupuestado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Ejecutado" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="En Bodega" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Detalle por renglón */}
              {selected && (() => {
                const itemMap = new Map<string, { itemName: string; materials: { name: string; budgeted: number; stock: number; used: number; unit: string }[] }>();
                const projItems = inventory.filter((i: any) => i.projectId === selected.id && i.budgetedQty != null && i.itemId);
                for (const inv of projItems) {
                  const key = inv.itemId || 'sin-renglon';
                  if (!itemMap.has(key)) itemMap.set(key, { itemName: inv.itemName || 'Sin nombre', materials: [] });
                  itemMap.get(key)!.materials.push({
                    name: inv.name,
                    budgeted: inv.budgetedQty || 0,
                    stock: inv.stock || 0,
                    used: inv.usedQty || 0,
                    unit: inv.unit || 'U',
                  });
                }
                if (itemMap.size === 0) return null;
                return (
                  <div className="mt-4">
                    <p className="text-[8px] font-black text-slate-400  uppercase tracking-widest mb-2">Detalle por Renglón</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {Array.from(itemMap.entries()).map(([itemId, itemData]) => (
                        <details key={itemId} className="bg-white/40 backdrop-blur-sm border border-white/30 rounded-xl overflow-hidden">
                          <summary className="px-3 py-2 text-[9px] font-black text-slate-700 cursor-pointer hover:bg-white/30 transition-all uppercase tracking-wider">
                            {itemData.itemName}
                          </summary>
                          <div className="px-3 pb-2 pt-1 space-y-1">
                            {itemData.materials.map((m, i) => {
                              const pct = m.budgeted > 0 ? Math.round((m.used / m.budgeted) * 100) : 0;
                              return (
                                <div key={i} className="grid grid-cols-5 gap-2 text-[8px] bg-white/60 backdrop-blur-sm rounded-lg px-2 py-1.5">
                                  <span className="font-bold text-slate-700 truncate col-span-2">{m.name}</span>
                                  <span className="text-slate-500 text-center">P: {m.budgeted} {m.unit}</span>
                                  <span className="text-[var(--color-info)] text-center">B: {m.stock}</span>
                                  <span className={cn("text-center font-bold", pct >= 100 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]')}>
                                    U: {m.used} ({pct}%)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Detalle Financiero por Renglón */}
        {selected && (() => {
          const flatLines: { id: string; code: string; description: string; budgeted: number }[] = [];
          const flatten = (lines: any[]) => {
            for (const l of lines || []) {
              if (l.code && l.description) {
                flatLines.push({ id: l.id || l.code, code: l.code, description: l.description, budgeted: l.totalLine ?? l.materialTotal ?? 0 });
              }
              if (l.children) flatten(l.children);
            }
          };
          flatten(selected.budgetTree || selected.items || []);
          if (flatLines.length === 0) return null;

          const txByLine = new Map<string, { income: number; expense: number }>();
          for (const tx of allTransactions) {
            if (tx.projectId !== selected.id || !tx.budgetLineId) continue;
            const entry = txByLine.get(tx.budgetLineId) || { income: 0, expense: 0 };
            if (tx.type === 'INGRESO') entry.income += tx.amount || 0;
            else entry.expense += tx.amount || 0;
            txByLine.set(tx.budgetLineId, entry);
          }

          return (
            <div className="bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl p-4 shadow-lg md:col-span-2 xl:col-span-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalle Financiero por Renglón</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left font-black text-slate-400 uppercase tracking-widest pb-2 pr-3">Código</th>
                      <th className="text-left font-black text-slate-400 uppercase tracking-widest pb-2 pr-3">Renglón</th>
                      <th className="text-right font-black text-slate-400 uppercase tracking-widest pb-2 pr-3">Presupuestado</th>
                      <th className="text-right font-black text-slate-400 uppercase tracking-widest pb-2 pr-3">Ingresos</th>
                      <th className="text-right font-black text-slate-400 uppercase tracking-widest pb-2 pr-3">Egresos</th>
                      <th className="text-right font-black text-slate-400 uppercase tracking-widest pb-2">Desviación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatLines.map(line => {
                      const actual = txByLine.get(line.id) || { income: 0, expense: 0 };
                      const deviation = line.budgeted > 0 ? ((actual.expense - line.budgeted) / line.budgeted) * 100 : 0;
                      return (
                        <tr key={line.id} className="border-b border-white/10 hover:bg-white/30">
                          <td className="py-2 pr-3 font-bold text-slate-500">{line.code}</td>
                          <td className="py-2 pr-3 text-slate-700 max-w-[200px] truncate">{line.description}</td>
                          <td className="py-2 pr-3 text-right font-black text-slate-800">{fmtQ(line.budgeted)}</td>
                          <td className="py-2 pr-3 text-right font-bold text-emerald-600">{actual.income > 0 ? fmtQ(actual.income) : '—'}</td>
                          <td className="py-2 pr-3 text-right font-bold text-red-500">{actual.expense > 0 ? fmtQ(actual.expense) : '—'}</td>
                          <td className={cn("py-2 text-right font-black",
                            Math.abs(deviation) < 10 ? 'text-emerald-500' :
                            deviation > 0 ? 'text-red-500' : 'text-amber-500'
                          )}>
                            {actual.expense > 0 || actual.income > 0 ? `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {flatLines.every(l => !txByLine.get(l.id)) && (
                <p className="text-[9px] text-slate-400 text-center py-4">
                  Vincula transacciones a renglones del presupuesto desde el panel de control para ver análisis por línea.
                </p>
              )}
            </div>
          );
        })()}

        {/* Gantt Chart - Project Timeline */}
        <div className="bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl p-4 shadow-lg md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-400  uppercase tracking-widest">Cronograma de Proyecto (Gantt)</p>
            <Calendar size={16} className="text-slate-400" />
          </div>

          <div className="space-y-3">
            {selected ? (
              <p className="text-[9px] text-slate-400 text-center py-6">Vista Gantt disponible desde el módulo Gantt</p>
            ) : (
              <p className="text-[9px] text-slate-400 text-center py-6">Selecciona un proyecto para ver su cronograma</p>
            )}
          </div>
        </div>

        {/* Critical Path Analysis */}
        <div className="bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-400  uppercase tracking-widest">Análisis de Ruta Crítica</p>
            <AlertTriangle size={16} className="text-[var(--color-accent)]" />
          </div>

          <div className="space-y-3">
            {selected ? (
              <p className="text-[9px] text-slate-400 text-center py-6">Vista de ruta crítica disponible desde el módulo Gantt</p>
            ) : (
              <p className="text-[9px] text-slate-400 text-center py-6">Selecciona un proyecto para ver su ruta crítica</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}



