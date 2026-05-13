/**
 * Módulo de Seguimiento — Avance Físico y Financiero
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';
import { fmtQ } from '../utils/format';
import { subscribeToCollection } from '../services/firestoreService';
import { Transaction } from '../constants';
import { trackEvent } from '../utils/logger';
import {
  RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, LineChart, Line, ComposedChart
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Building2, FileDown, Calendar } from 'lucide-react';
import { generateProgressReport } from '../lib/reports';

function pct(n: number) { return Math.min(100, Math.max(0, Math.round(n))); }

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

function RingChart({ value, color, label, size = 80 }: { value: number; color: string; label: string; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value, 100);
  const dash = (pct / 100) * circ;
  const trackColor = '#e2e8f0';
  const isOver = value > 100;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
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
  const [projects, setProjects] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('ALL');

  useEffect(() => {
    const u1 = subscribeToCollection('projects', setProjects);
    const u2 = subscribeToCollection('transactions', setTransactions);
    const u3 = subscribeToCollection('inventory', setInventory);
    return () => { u1(); u2(); u3(); };
  }, []);

  const active = projects.filter(p => p.status === 'EJECUCION');
  const selected = selectedId === 'ALL' ? null : active.find(p => p.id === selectedId);

  // Aggregate data
  const projectsData = active.map(p => {
    // Use real transaction expenses for financiero, fallback to budget items cost
    const txExpense = transactions.filter(t => t.projectId === p.id && t.type === 'GASTO').reduce((a: number, t: any) => a + (t.amount || 0), 0);
    const txIncome  = transactions.filter(t => t.projectId === p.id && t.type === 'INGRESO').reduce((a: number, t: any) => a + (t.amount || 0), 0);
    const totalCost  = txExpense;
    const budget     = p.budget || 1;
    const financieroRaw = (totalCost / budget) * 100;
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
    const indirectRate = ((p.indirectCosts || 15) + (p.administrativeCosts || 5) + (p.personalCosts || 10)) / 100;
    const totalCostWithIndirect = (p.totalCost || 0) * (1 + indirectRate);
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

  const avgFisico = displayProjects.length ? Math.round(displayProjects.reduce((a, p) => a + p.fisico, 0) / displayProjects.length) : 0;
  const avgFinanciero = displayProjects.length ? Math.round(displayProjects.reduce((a, p) => a + p.financiero, 0) / displayProjects.length) : 0;
  const totalBudget = displayProjects.reduce((a, p) => a + (p.budget || 0), 0);
  const totalCostAll = displayProjects.reduce((a, p) => a + (p.totalCost || 0), 0);

  // Materials: budgeted vs used per project
  const materialData = (() => {
    const projectsToShow = selectedId === 'ALL' ? projects.filter(p => p.status === 'EJECUCION') : projects.filter(p => p.id === selectedId);
    return projectsToShow.map(p => {
      const projItems = inventory.filter((i: any) => i.projectId === p.id && i.budgetedQty != null);
      const budgeted = projItems.reduce((a: number, i: any) => a + ((i.budgetedQty || 0) * (i.budgetedCost || 0)), 0);
      const used = projItems.reduce((a: number, i: any) => a + ((i.usedQty || 0) * (i.budgetedCost || 0)), 0);
      const received = projItems.reduce((a: number, i: any) => a + ((i.stock || 0) * (i.budgetedCost || 0)), 0);
      return { name: p.name?.slice(0, 14) || 'Proyecto', Presupuestado: budgeted, Ejecutado: used, 'En Bodega': received };
    }).filter(d => d.Presupuestado > 0 || d.Ejecutado > 0);
  })();

  return (
    <div className="flex flex-col h-full p-3 gap-3 overflow-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0px))] scroll-mb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
        <div>
          <p className="text-[9px] font-black text-slate-400  uppercase tracking-[0.2em]">Módulo de Análisis</p>
          <h1 className="text-sm font-black text-slate-900  uppercase tracking-tight">Seguimiento de Avance</h1>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="flex-1 md:w-56 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase focus:outline-none focus:border-amber-400 shadow-sm"
          >
            <option value="ALL">TODOS LOS PROYECTOS EN EJECUCION</option>
            {active.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
{selected && (
             <button
               onClick={() => generateProgressReport(selected, transactions)}
               className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
             >
               <FileDown size={14} className="text-secondary" />
               <span className="hidden sm:inline">Informe PDF</span>
             </button>
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
            className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg text-white" style={{ background: k.color }}>{k.icon}</div>
              <p className="text-[9px] sm:text-[8px] font-black text-slate-400  uppercase tracking-widest">{k.label}</p>
            </div>
            <p className="text-sm font-black text-slate-900 ">{k.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 flex-1" style={{ gridAutoRows: 'minmax(auto, 1fr)' }}>

        {/* Ring charts per project */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
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
                <div className="bg-amber-50 rounded-xl p-2 text-center">
                  <p className="text-[7px] font-black text-amber-600 uppercase tracking-widest">Presupuesto</p>
                  <p className="text-[11px] font-black text-slate-800 ">{fmtQ(displayProjects[0]?.budget || 0)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-2 text-center">
                  <p className="text-[7px] font-black text-blue-600 uppercase tracking-widest">Ejecutado</p>
                  <p className="text-[11px] font-black text-slate-800 ">{fmtQ(displayProjects[0]?.totalCost || 0)}</p>
                </div>
              </div>
              <div className={cn("text-[8px] font-black uppercase px-2 py-1 rounded-full",
                (displayProjects[0]?.fisico ?? 0) >= (displayProjects[0]?.financiero ?? 0)
                  ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
              )}>
                {(displayProjects[0]?.fisico ?? 0) >= (displayProjects[0]?.financiero ?? 0) ? '▲ En control' : '▼ Desfase financiero'}
              </div>
            </div>

          ) : (
            /* All projects: list with small rings */
            <div className="space-y-3 overflow-auto max-h-64">
              {displayProjects.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(p.id)}>
                  <RingChart value={p.fisico} color="#f59e0b" label="Fís." size={56} />
                  <RingChart value={p.financiero} color="#3b82f6" label="Fin." size={56} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-slate-700  uppercase truncate">{p.name}</p>
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
          )}
        </div>

        {/* Comparison bar chart */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
          <p className="text-[9px] font-black text-slate-400  uppercase tracking-widest mb-2">Comparativa Físico vs Financiero</p>
          <ResponsiveContainer width="100%" height={150}>
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
        <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
          <p className="text-[9px] font-black text-slate-400  uppercase tracking-widest mb-2">Desviación (Físico − Financiero)</p>
          <ResponsiveContainer width="100%" height={150}>
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
        <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm md:col-span-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Presupuesto vs Costos (Q)</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={areaData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 8 }} tickFormatter={v => `Q${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => fmtQ(v)} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
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
        <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
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
        <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm md:col-span-2 xl:col-span-3">
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
                  <Tooltip formatter={(v: any) => fmtQ(v)} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
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
                        <details key={itemId} className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                          <summary className="px-3 py-2 text-[9px] font-black text-slate-700 cursor-pointer hover:bg-slate-100 transition-all uppercase tracking-wider">
                            {itemData.itemName}
                          </summary>
                          <div className="px-3 pb-2 pt-1 space-y-1">
                            {itemData.materials.map((m, i) => {
                              const pct = m.budgeted > 0 ? Math.round((m.used / m.budgeted) * 100) : 0;
                              return (
                                <div key={i} className="grid grid-cols-5 gap-2 text-[8px] bg-white rounded-lg px-2 py-1.5">
                                  <span className="font-bold text-slate-700 truncate col-span-2">{m.name}</span>
                                  <span className="text-slate-500 text-center">P: {m.budgeted} {m.unit}</span>
                                  <span className="text-blue-600 text-center">B: {m.stock}</span>
                                  <span className={cn("text-center font-bold", pct >= 100 ? 'text-emerald-600' : 'text-amber-600')}>
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

        {/* Gantt Chart - Project Timeline */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-400  uppercase tracking-widest">Cronograma de Proyecto (Gantt)</p>
            <Calendar size={16} className="text-slate-400" />
          </div>

          <div className="space-y-3">
            {/* Project phases with progress bars */}
            {[
              { phase: 'Cimentación', start: '2024-01-01', end: '2024-01-15', progress: 100, color: '#ef4444' },
              { phase: 'Estructura', start: '2024-01-16', end: '2024-02-28', progress: 85, color: '#f59e0b' },
              { phase: 'Techos', start: '2024-03-01', end: '2024-03-10', progress: 60, color: '#3b82f6' },
              { phase: 'Instalaciones', start: '2024-03-11', end: '2024-04-15', progress: 30, color: '#10b981' },
              { phase: 'Acabados', start: '2024-04-16', end: '2024-05-30', progress: 10, color: '#8b5cf6' }
            ].map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-[8px] font-bold">
                  <span className="text-slate-700 ">{item.phase}</span>
                  <span className="text-slate-500">{item.progress}%</span>
                </div>
                <div className="relative h-3 bg-slate-100  rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${item.progress}%`,
                      backgroundColor: item.color,
                      boxShadow: `0 0 8px ${item.color}30`
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[8px] sm:text-[7px] font-black text-white drop-shadow-sm">
                    {item.start.split('-')[1]}/{item.start.split('-')[2]} - {item.end.split('-')[1]}/{item.end.split('-')[2]}
                  </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Timeline markers */}
            <div className="flex justify-between mt-4 pt-2 border-t border-slate-200">
              <span className="text-[7px] font-bold text-slate-400">Ene</span>
              <span className="text-[7px] font-bold text-slate-400">Feb</span>
              <span className="text-[7px] font-bold text-slate-400">Mar</span>
              <span className="text-[7px] font-bold text-slate-400">Abr</span>
              <span className="text-[7px] font-bold text-slate-400">May</span>
            </div>
          </div>
        </div>

        {/* Critical Path Analysis */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-400  uppercase tracking-widest">Análisis de Ruta Crítica</p>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>

          <div className="space-y-3">
            {[
              { task: 'Cimentación', duration: 15, status: 'completed', critical: false },
              { task: 'Columnas', duration: 20, status: 'in-progress', critical: true },
              { task: 'Vigas', duration: 12, status: 'pending', critical: true },
              { task: 'Losas', duration: 18, status: 'pending', critical: false },
              { task: 'Acabados', duration: 25, status: 'planned', critical: false }
            ].map((task, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 ">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    task.status === 'completed' ? 'bg-green-500' :
                    task.status === 'in-progress' ? 'bg-blue-500' :
                    task.status === 'pending' ? 'bg-amber-500' : 'bg-slate-400'
                  )} />
                  <span className="text-[8px] font-bold text-slate-700 ">{task.task}</span>
                  {task.critical && <span className="text-[6px] font-black text-red-500 uppercase">Crítico</span>}
                </div>
                <span className="text-[7px] font-bold text-slate-500">{task.duration} días</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

