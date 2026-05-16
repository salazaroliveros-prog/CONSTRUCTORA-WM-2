/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3, TrendingUp, PieChart as PieChartIcon, Zap, Target,
  Download, Filter, DollarSign, Award, AlertTriangle, CheckCircle2,
  ArrowUpRight, ArrowDownRight, Calendar, Layers, Users, Package,
  Truck, ShoppingCart, Building2, AlertCircle, TrendingDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Cell, Pie, Legend, RadialBarChart, RadialBar,
  LineChart, Line, AreaChart, Area, ComposedChart
} from 'recharts';
import { motion } from 'motion/react';
import { generateProjectPDF, generateProjectCSV, PDF_TEMPLATES, CSV_TEMPLATES } from '../lib/exportUtils';
import { calculateFullProject } from '../engine/budgetEngine';
import { Project, Transaction } from '../constants';
import { trackEvent, trackExport } from '../utils/logger';
import { useCountUp } from '../hooks/useCountUp';
import { PMath, precise, fmtQ } from '../engine/precision';
import { useStore, useExistingProjectFilter } from '../store/DataStore';
import { itemsToBudgetTree } from '../utils/budgetConverter';

function AnimatedNum({ v }: { v: number }) { const n = useCountUp(v, 800); return <>{n}</>; }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--color-neutral-900)]/95 backdrop-blur-sm border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 shadow-2xl text-left min-w-[140px]">
      {label && <p className="text-[9px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest mb-2">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-[9px] font-bold text-[var(--color-neutral-300)] uppercase">{entry.name}:</span>
          <span className="text-[10px] font-black text-[var(--color-neutral-50)]">
            {typeof entry.value === 'number' && entry.name !== 'Margen'
              ? fmtQ(Number(entry.value))
              : `${entry.value}${entry.name === 'Margen' ? '%' : ''}`}
          </span>
        </div>
      ))}
    </div>
  );
}

function calcItemCost(item: any) {
  const matCost = (item.materials || []).reduce((a: number, m: any) => PMath.add(a, PMath.mul(PMath.mul(m.price, m.quantity), item.projectQuantity || 1)), 0);
  const labCost = (item.labor || []).reduce((a: number, l: any) => PMath.add(a, PMath.mul(PMath.mul(l.price, l.quantity), item.projectQuantity || 1)), 0);
  return PMath.add(matCost, labCost);
}

export default function AnalyticsModule() {
  const store = useStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [exportTemplate, setExportTemplate] = useState<string>('modern');
  const [exportCsvTemplate, setExportCsvTemplate] = useState<string>('completo');
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'ranking' | 'connectivity'>('overview');

  const loading = store.projects.isLoading || store.transactions.isLoading || store.staff.isLoading || store.suppliers.isLoading || store.inventory.isLoading || store.purchaseOrders.isLoading;

  // DataStore data
  const projects = store.projects.items;
  const transactions = store.transactions.items;
  const staff = store.staff.items;
  const suppliers = store.suppliers.items;
  const inventory = store.inventory.items;
  const purchaseOrders = store.purchaseOrders.items;

  // Filtered data based on selected project
  const displayProjects = selectedProjectId === 'ALL'
    ? projects
    : projects.filter(p => p.id === selectedProjectId);

  const selectedProject = selectedProjectId !== 'ALL'
    ? projects.find(p => p.id === selectedProjectId) || null
    : null;

  // Anti-orphan filter using DataStore helper
  const validInventoryItems = useExistingProjectFilter(inventory, 'projectId' as any);
  const activeProjectIds = useMemo(() => new Set(store.projects.items.filter(p => p.status === 'EJECUCION').map(p => p.id)), [store.projects.items]);
  const existingProjectIds = useMemo(() => new Set(projects.filter(p => p.id).map(p => p.id)), [projects]);

  const stats = {
    cotizados: displayProjects.filter(p => p.status === 'COTIZACION'),
    ejecucion: displayProjects.filter(p => p.status === 'EJECUCION'),
    finalizados: displayProjects.filter(p => p.status === 'FINALIZADO'),
  };

const rentabilidadData = displayProjects
      .filter(p => p.budget > 0 && (p.items || []).length > 0)
      .map(p => {
        const totals = calculateFullProject(itemsToBudgetTree(p.items || []), {
          indirectCosts: p.indirectCosts,
          adminCosts: p.administrativeCosts,
          personalCosts: p.personalCosts,
        });
        const costoReal = totals.totalBudget;
        const utilidad = PMath.sub(p.budget || 0, costoReal);
        return {
          name: (p.name || "").substring(0, 14),
          Presupuesto: Math.round(p.budget || 0),
          Costo: Math.round(costoReal),
          Utilidad: Math.round(utilidad),
          Margen: p.budget > 0 ? Math.round(PMath.div(PMath.mul(utilidad, 100), p.budget)) : 0,
        };
      }).slice(0, 8);

  const pieData = [
    { name: 'Cotizado', value: stats.cotizados.length, color: 'var(--color-neutral-400)' },
    { name: 'Ejecución', value: stats.ejecucion.length, color: 'var(--color-secondary)' },
    { name: 'Finalizado', value: stats.finalizados.length, color: 'var(--color-neutral-900)' },
  ];

// Per-project breakdown charts (only when a project is selected)
   const itemsBreakdown = selectedProject
     ? (selectedProject.items || []).map(item => ({
         name: (item.description || '').substring(0, 16),
         Materiales: Math.round((item.materials || []).reduce((a: number, m: any) => PMath.add(a, PMath.mul(PMath.mul(m.price, m.quantity), item.projectQuantity || 1)), 0)),
         ManoObra: Math.round((item.labor || []).reduce((a: number, l: any) => PMath.add(a, PMath.mul(PMath.mul(l.price, l.quantity), item.projectQuantity || 1)), 0)),
         Total: Math.round(calcItemCost(item)),
       }))
     : [];

  const handleExportPDF = () => {
    if (!selectedProject) return;
    generateProjectPDF(selectedProject, exportTemplate as any);
  };

  const handleExportCSV = () => {
    if (!selectedProject) return;
    generateProjectCSV(selectedProject, exportCsvTemplate as any);
  };

// ── Tendencias mensuales (últimos 6 meses) ──────────────────────────────────
   const monthlyTrends = useMemo(() => {
     const months: Record<string, { mes: string; Ingresos: number; Gastos: number; Neto: number }> = {};
     const now = new Date();
     for (let i = 5; i >= 0; i--) {
       const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
       const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
       const label = d.toLocaleDateString('es-GT', { month: 'short', year: '2-digit' }).toUpperCase();
       months[key] = { mes: label, Ingresos: 0, Gastos: 0, Neto: 0 };
     }
     transactions.forEach(t => {
       if (!t.date) return;
       if (t.projectId && !existingProjectIds.has(t.projectId)) return;
       const key = t.date.substring(0, 7);
       if (!months[key]) return;
       const amount = Number(t.amount || 0);
       if (t.type === 'INGRESO') months[key].Ingresos = PMath.add(months[key].Ingresos, amount);
       else if (t.type === 'GASTO') months[key].Gastos = PMath.add(months[key].Gastos, amount);
     });
     return Object.values(months).map(m => ({ ...m, Neto: PMath.sub(m.Ingresos, m.Gastos) }));
   }, [transactions]);

// ── Ranking de proyectos por margen ────────────────────────────────────────
    const projectRanking = useMemo(() =>
      displayProjects
        .filter(p => p.budget > 0 && (p.items || []).length > 0)
        .map(p => {
          const totals = calculateFullProject(itemsToBudgetTree(p.items || []), {
            indirectCosts: p.indirectCosts,
            adminCosts: p.administrativeCosts,
            personalCosts: p.personalCosts,
          });
          const costoReal = totals.totalBudget;
          const utilidad = PMath.sub(p.budget || 0, costoReal);
          const margen = p.budget > 0 ? PMath.div(PMath.mul(utilidad, 100), p.budget) : 0;
          return { ...p, costoReal, utilidad, margen };
        })
        .sort((a, b) => b.margen - a.margen),
      [displayProjects]
    );

// ── Distribución por tipología ──────────────────────────────────────────────
   const typologyData = useMemo(() => {
     const map: Record<string, { count: number; budget: number }> = {};
     displayProjects.forEach(p => {
       const t = p.typology || 'OTRO';
       if (!map[t]) map[t] = { count: 0, budget: 0 };
       map[t].count++;
       map[t].budget = PMath.add(map[t].budget, p.budget || 0);
     });
      const COLORS = ['var(--color-secondary)','var(--color-neutral-900)','var(--color-info)','var(--color-success)','var(--color-secondary-dark)'];
      return Object.entries(map).map(([name, v], i) => ({ name, ...v, color: COLORS[i % COLORS.length] }));
   }, [displayProjects]);

// ── KPIs financieros y operativos mejorados ────────────────────────────────────────────────────────
   // Sanity: sin proyectos activos no debe haber datos financieros fantasma
   const hasProjects = projects.length > 0;
   const totalIngresos = hasProjects
     ? PMath.sum(transactions.filter(t => t.type === 'INGRESO' && existingProjectIds.has(t.projectId)).map(t => Number(t.amount || 0)))
     : 0;
   const totalGastos = hasProjects
     ? PMath.sum(transactions.filter(t => t.type === 'GASTO' && existingProjectIds.has(t.projectId)).map(t => Number(t.amount || 0)))
     : 0;
   const netoCaja = PMath.sub(totalIngresos, totalGastos);
   const totalPresupuesto = PMath.sum(displayProjects.map(p => p.budget || 0));

   // Nuevas métricas cruzadas
   const activeStaff = staff.filter(s => s.status === 'Activo');
   const totalSalaries = PMath.sum(activeStaff.map(s => Number(s.salary || 0)));
   const criticalInventory = hasProjects
     ? inventory.filter(i => (i.stock || 0) <= (i.minStock || 0) && existingProjectIds.has(i.projectId))
     : [];
   const pendingOrders = hasProjects
     ? purchaseOrders.filter(po => po.status === 'PENDIENTE' && existingProjectIds.has(po.projectId))
     : [];
   const totalPendingValue = PMath.sum(pendingOrders.map(po => Number(po.total || 0)));

   // Eficiencia de personal por proyecto
   const staffEfficiency = displayProjects.map(p => {
     const projectStaff = activeStaff.filter(s => s.projectIds?.includes(p.id));
     const staffCost = PMath.sum(projectStaff.map(s => Number(s.salary || 0)));
     const efficiency = p.budget > 0 && staffCost > 0 ? PMath.div(p.progress || 0, PMath.div(staffCost, 1000)) : 0;
     return { ...p, staffCount: projectStaff.length, staffCost, efficiency };
   }).filter(p => p.staffCount > 0);

   // Análisis de proveedores
   const supplierAnalysis = hasProjects
     ? suppliers.map(s => {
         const supplierOrders = purchaseOrders.filter(po => po.supplierId === s.id && existingProjectIds.has(po.projectId));
         const totalSpent = PMath.sum(supplierOrders.map(po => Number(po.total || 0)));
         const avgOrderValue = supplierOrders.length > 0 ? PMath.div(totalSpent, supplierOrders.length) : 0;
         const pendingCount = supplierOrders.filter(po => po.status === 'PENDIENTE').length;
         return { ...s, totalSpent, avgOrderValue, orderCount: supplierOrders.length, pendingCount };
       }).sort((a, b) => b.totalSpent - a.totalSpent)
     : [];

   // Análisis de inventario por proyecto
   const inventoryByProject = displayProjects.map(p => {
     const projectInventory = inventory.filter(i => i.projectId === p.id);
     const totalBudgetedValue = PMath.sum(projectInventory.map(i => PMath.mul(i.budgetedQty || 0, i.budgetedCost || 0)));
     const totalCurrentValue = PMath.sum(projectInventory.map(i => PMath.mul(i.stock || 0, i.budgetedCost || 0)));
     const criticalItems = projectInventory.filter(i => (i.stock || 0) <= (i.minStock || 0));
     const completeness = totalBudgetedValue > 0 ? PMath.div(PMath.mul(totalCurrentValue, 100), totalBudgetedValue) : 0;
     return { ...p, inventoryItems: projectInventory.length, totalBudgetedValue, totalCurrentValue, criticalItems: criticalItems.length, completeness };
   }).filter(p => p.inventoryItems > 0);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3 p-3 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] scroll-mb-[calc(4rem+env(safe-area-inset-bottom,0px))] overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div className="text-left">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-primary  uppercase">Analíticas</h2>
          <p className="text-[10px] md:text-xs font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Análisis de portafolio y rendimiento</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-end overflow-x-auto">
          {/* Tabs - Agregando nueva pestaña de conectividad */}
           <div className="flex bg-[var(--color-neutral-100)] p-1 rounded-xl gap-1 overflow-x-auto">
             {([['overview','Resumen'],['trends','Tendencias'],['ranking','Ranking'],['connectivity','Conectividad']] as const).map(([tab, label]) => (
               <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                 className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-[var(--color-surface-solid)] text-[var(--color-neutral-900)] shadow-sm' : 'text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)]'}`}>
                {label}
              </button>
            ))}
          </div>
          {/* Project filter */}
          <div className="flex flex-col gap-1">
             <span className="text-[7px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest flex items-center gap-1"><Filter size={8} /> Proyecto</span>
             <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} title="Filtrar por proyecto"
               className="select">
               <option value="ALL">TODOS LOS PROYECTOS</option>
              {projects.map(p => <option key={p.id} value={p.id}>{(p.name || '').substring(0, 30).toUpperCase()}</option>)}
            </select>
          </div>
          {selectedProject && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-[7px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Plantilla PDF</span>
                 <select value={exportTemplate} onChange={e => setExportTemplate(e.target.value)} title="Plantilla PDF"
                  className="select">
                    {PDF_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
               </div>
               <button type="button" onClick={handleExportPDF}
                 className="h-10 bg-[var(--color-secondary)] text-[var(--color-primary)] px-4 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[var(--color-secondary)]/90 transition-all shadow-sm">
                 <Download size={14} /> PDF
               </button>
               <div className="flex flex-col gap-1">
                 <span className="text-[7px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Plantilla CSV</span>
                  <select value={exportCsvTemplate} onChange={e => setExportCsvTemplate(e.target.value)} title="Plantilla CSV"
                    className="select">
                   {CSV_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                 </select>
              </div>
              <button type="button" onClick={handleExportCSV}
                 className="h-10 bg-[var(--color-neutral-900)] text-[var(--color-neutral-50)] px-4 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[var(--color-neutral-700)] transition-all shadow-sm">
                <Download size={14} /> CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Financial KPI Strip - Mejorado con métricas cruzadas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
           { label: 'Presupuesto Total', value: fmtQ(totalPresupuesto), icon: <Layers size={14}/>, color: 'text-[var(--color-secondary-dark)]', bg: 'bg-[color-mix(in_srgb,var(--color-secondary)_10%,transparent)]', trend: null },
           { label: 'Personal Activo', value: `${activeStaff.length}`, icon: <Users size={14}/>, color: 'text-[var(--color-info)]', bg: 'bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)]', trend: null, sub: `Q ${Math.round(totalSalaries/1000)}k salarios` },
           { label: 'Stock Crítico', value: `${criticalInventory.length}`, icon: <Package size={14}/>, color: criticalInventory.length > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]', bg: criticalInventory.length > 0 ? 'bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)]' : 'bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)]', trend: criticalInventory.length > 0 ? 'down' : 'up', sub: `de ${validInventoryItems.length} items` },
           { label: 'OC Pendientes', value: `${pendingOrders.length}`, icon: <ShoppingCart size={14}/>, color: pendingOrders.length > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]', bg: pendingOrders.length > 0 ? 'bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]' : 'bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)]', trend: null, sub: `Q ${Math.round(totalPendingValue/1000)}k` },
           { label: 'Ingresos Reales', value: `Q ${Math.round(totalIngresos/1000)}k`, icon: <ArrowUpRight size={14}/>, color: 'text-[var(--color-success)]', bg: 'bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)]', trend: 'up' },
           { label: 'Neto en Caja', value: `Q ${Math.round(netoCaja/1000)}k`, icon: <DollarSign size={14}/>, color: netoCaja >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]', bg: netoCaja >= 0 ? 'bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)]' : 'bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)]', trend: netoCaja >= 0 ? 'up' : 'down' },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-[var(--color-surface-solid)] rounded-xl border border-[var(--color-neutral-100)] p-3 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg shrink-0 ${kpi.bg} ${kpi.color}`}>{kpi.icon}</div>
              <div className="min-w-0 flex-1">
                 <p className="text-[7px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest truncate">{kpi.label}</p>
                <p className="text-sm font-black text-primary truncate">{kpi.value}</p>
              </div>
            </div>
            {kpi.sub && (
               <p className="text-[7px] sm:text-[6px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest truncate">{kpi.sub}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Tab: OVERVIEW (contenido original) */}
      {activeTab === 'overview' && (<>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-left">
        {[
          { label: 'Proyectos', value: displayProjects.length, label2: 'Total Registrados', icon: <BarChart3 className="text-primary w-5 h-5" /> },
          { label: 'Cotizado', value: stats.cotizados.length, label2: 'En espera', icon: <Zap className="text-secondary w-5 h-5" /> },
          { label: 'Ejecución', value: stats.ejecucion.length, label2: 'Activos', icon: <TrendingUp className="text-[var(--color-info)] w-5 h-5" /> },
          { label: 'Finalizado', value: stats.finalizados.length, label2: 'Completados', icon: <Target className="text-[var(--color-success)] w-5 h-5" /> },
        ].map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i}
             className="bg-[var(--color-surface-solid)] p-3 rounded-2xl border border-[var(--color-neutral-200)] shadow-sm relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
               <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-neutral-400)]">{stat.label}</span>
              {stat.icon}
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-primary"><AnimatedNum v={stat.value} /></h3>
               <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">{stat.label2}</p>
            </div>
          </motion.div>
        ))}
      </div>

{/* Budget total */}
       <div className="bg-[var(--color-neutral-900)] rounded-2xl p-3 text-[var(--color-neutral-50)] text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
         <div>
            <p className="text-[10px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest mb-1">
             {selectedProject ? `Presupuesto: ${selectedProject.name}` : 'Presupuesto Total Portafolio'}
           </p>
            <span className="text-2xl md:text-3xl font-black text-[var(--color-neutral-50)]">
             Q. {fmtQ(PMath.sum(displayProjects.map(p => p.budget || 0)))}
           </span>
         </div>
         {selectedProject && (
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
             {[
               { label: 'Costo Directo', val: selectedProject.directCosts || 0 },
               { label: `Indirecto ${selectedProject.indirectCosts || 0}%`, val: PMath.div(PMath.mul(selectedProject.directCosts || 0, selectedProject.indirectCosts || 0), 100) },
               { label: `Admin ${selectedProject.administrativeCosts || 0}%`, val: PMath.div(PMath.mul(selectedProject.directCosts || 0, selectedProject.administrativeCosts || 0), 100) },
               { label: `Personal ${selectedProject.personalCosts || 0}%`, val: PMath.div(PMath.mul(selectedProject.directCosts || 0, selectedProject.personalCosts || 0), 100) },
             ].map((c, i) => (
                <div key={i} className="bg-[var(--color-neutral-800)]/60 rounded-xl p-3">
                  <p className="text-[7px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest">{c.label}</p>
                  <p className="text-[11px] font-black text-[var(--color-neutral-50)] mt-1">Q {fmtQ(c.val)}</p>
               </div>
             ))}
           </div>
         )}
       </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Pie chart */}
        <div className="bg-[var(--color-surface-solid)] p-3 rounded-3xl border border-[var(--color-neutral-200)] shadow-sm text-left">
          <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-2">
            {selectedProject ? 'Estado del Proyecto' : 'Composición de Portafolio'}
          </h4>
          <div className="chart-h-md w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8 text-center">
              <span className="text-3xl font-black text-primary  leading-none">{displayProjects.length}</span>
              <span className="text-[8px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Proyectos</span>
            </div>
          </div>
        </div>

        {/* Radial / System health */}
        <div className="bg-[var(--color-neutral-900)] rounded-3xl p-3 text-[var(--color-neutral-50)] text-left">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h4 className="text-[11px] font-black text-[var(--color-neutral-400)] uppercase tracking-[0.2em] mb-1">Estado del Sistema</h4>
              <p className="text-xl font-black uppercase tracking-tight text-secondary">Salud Operativa</p>
            </div>
            <BarChart3 size={24} className="text-secondary" />
          </div>
          <div className="chart-h-sm">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius="30%" outerRadius="90%"
data={[
                    { name: 'Carga', value: precise(PMath.div(PMath.mul(displayProjects.length, 100), 20), 0), fill: 'var(--color-info)' },
                    { name: 'Cierre', value: precise(PMath.div(PMath.mul(stats.finalizados.length, 100), displayProjects.length || 1), 0), fill: 'var(--color-success)' },
                    { name: 'Activos', value: precise(PMath.div(PMath.mul(stats.ejecucion.length, 100), displayProjects.length || 1), 0), fill: 'var(--color-secondary)' },
                  ]}
                startAngle={180} endAngle={0}
              >
                <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Tooltip content={<CustomTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {[
              { label: 'Carga', val: displayProjects.length, max: 20, color: 'bg-blue-400' },
              { label: 'Cierre', val: stats.finalizados.length, max: displayProjects.length || 1, color: 'bg-emerald-400' },
              { label: 'Activos', val: stats.ejecucion.length, max: displayProjects.length || 1, color: 'bg-[var(--color-accent)]' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${item.color}`} />
                <p className="text-[8px] font-black text-[var(--color-neutral-400)] uppercase">{item.label}</p>
                <p className="text-[10px] font-black text-[var(--color-neutral-50)]">{item.val}/{item.max}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rentabilidad chart */}
      <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm">
        <div className="mb-2">
          <h3 className="text-sm font-black text-primary  uppercase tracking-tight">Rentabilidad por Proyecto</h3>
          <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Presupuesto vs Costo Real vs Utilidad (Q)</p>
        </div>
        {rentabilidadData.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-[9px] font-black text-[var(--color-neutral-300)] uppercase tracking-widest">Sin proyectos con presupuesto</div>
        ) : (
          <div className="chart-h-md">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rentabilidadData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-200)" />
                <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} />
                <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={v => `Q ${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase" }} />
                 <Bar dataKey="Presupuesto" fill="var(--color-secondary-dark)" radius={[4, 4, 0, 0]} barSize={16} />
                 <Bar dataKey="Costo" fill="var(--color-warning)" radius={[4, 4, 0, 0]} barSize={16} />
                 <Bar dataKey="Utilidad" fill="var(--color-success)" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {rentabilidadData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            {rentabilidadData.map((p, i) => (
               <div key={i} className="bg-[var(--color-neutral-50)] rounded-xl p-3">
                 <p className="text-[8px] font-black text-[var(--color-neutral-400)] uppercase truncate">{p.name}</p>
                 <p className={`text-sm font-black ${p.Margen >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}>{p.Margen}%</p>
                 <p className="text-[8px] text-[var(--color-neutral-400)]">Margen</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-project items breakdown (only when a project is selected) */}
      {selectedProject && itemsBreakdown.length > 0 && (
        <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm">
          <div className="mb-2">
            <h3 className="text-sm font-black text-primary  uppercase tracking-tight">Desglose por Renglón</h3>
            <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Materiales vs Mano de Obra por renglón (Q)</p>
          </div>
          <div className="chart-h-md">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={itemsBreakdown} margin={{ top: 5, right: 10, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-200)" />
                <XAxis dataKey="name" fontSize={8} axisLine={false} tickLine={false} angle={-25} textAnchor="end" />
                <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={v => `Q ${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase" }} />
                 <Bar dataKey="Materiales" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} barSize={14} />
                 <Bar dataKey="ManoObra" fill="var(--color-neutral-900)" radius={[4, 4, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Summary table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[9px]">
              <thead>
                 <tr className="border-b border-[var(--color-neutral-100)]">
                   <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Renglón</th>
                   <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">Materiales</th>
                   <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">Mano Obra</th>
                   <th className="py-2 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {itemsBreakdown.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-[var(--color-neutral-50)]">
                    <td className="py-2 pr-4 font-bold text-primary uppercase">{row.name}</td>
                      <td className="py-2 pr-4 font-bold text-[var(--color-neutral-600)] text-right">{fmtQ(row.Materiales)}</td>
                      <td className="py-2 pr-4 font-black text-[var(--color-neutral-600)] text-right">{fmtQ(row.ManoObra)}</td>
                     <td className="py-2 font-black text-secondary text-right">{fmtQ(row.Total)}</td>
                  </tr>
                ))}
 <tr className="bg-[var(--color-neutral-50)] font-black">
                    <td className="py-2 pr-4 text-[var(--color-primary)] uppercase">TOTAL</td>
                    <td className="py-2 pr-4 text-right text-[var(--color-primary)]">Q {fmtQ(PMath.sum(itemsBreakdown.map(r => r.Materiales)))}</td>
                    <td className="py-2 pr-4 text-right text-[var(--color-primary)]">Q {fmtQ(PMath.sum(itemsBreakdown.map(r => r.ManoObra)))}</td>
                    <td className="py-2 text-right text-[var(--color-secondary)]">Q {fmtQ(PMath.sum(itemsBreakdown.map(r => r.Total)))}</td>
                  </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>)}

      {/* ── TAB: TENDENCIAS ─────────────────────────────────────────────────── */}
      {activeTab === 'trends' && (
        <div className="flex flex-col gap-3">
          {/* Área de ingresos vs gastos por mes */}
          <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-primary  uppercase tracking-tight">Flujo de Caja Mensual</h3>
                <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Ingresos vs Gastos — últimos 6 meses</p>
              </div>
              <Calendar size={18} className="text-[var(--color-neutral-300)]" />
            </div>
            {monthlyTrends.every(m => m.Ingresos === 0 && m.Gastos === 0) ? (
              <div className="h-36 flex items-center justify-center text-[9px] font-black text-[var(--color-neutral-300)] uppercase tracking-widest">Sin transacciones registradas</div>
            ) : (
              <div className="chart-h-md">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrends} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-200)" />
                    <XAxis dataKey="mes" fontSize={9} axisLine={false} tickLine={false} />
                    <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={v => `Q ${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }} />
                     <Area type="monotone" dataKey="Ingresos" stroke="var(--color-success)" strokeWidth={2} fill="url(#gradIngresos)" dot={{ r: 4, fill: 'var(--color-success)' }} />
                     <Area type="monotone" dataKey="Gastos" stroke="var(--color-secondary)" strokeWidth={2} fill="url(#gradGastos)" dot={{ r: 4, fill: 'var(--color-secondary)' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Neto mensual en barras */}
          <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm">
            <div className="mb-2">
              <h3 className="text-sm font-black text-primary  uppercase tracking-tight">Neto Mensual</h3>
              <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Resultado neto por mes (Ingresos − Gastos)</p>
            </div>
            <div className="chart-h-sm">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-200)" />
                  <XAxis dataKey="mes" fontSize={9} axisLine={false} tickLine={false} />
                  <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={v => `Q ${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                   <Bar dataKey="Neto" radius={[4, 4, 0, 0]} barSize={28}
                     fill="var(--color-success)"
                     label={false}>
                     {monthlyTrends.map((entry, index) => (
                       <Cell key={index} fill={entry.Neto > 0 ? 'var(--color-success)' : entry.Neto < 0 ? 'var(--color-error)' : 'var(--color-neutral-400)'} />
                     ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribución por tipología */}
          {typologyData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm">
                <h3 className="text-sm font-black text-primary  uppercase tracking-tight mb-2">Proyectos por Tipología</h3>
          <div className="chart-h-md">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typologyData} cx="50%" cy="50%" outerRadius={70} dataKey="count" paddingAngle={4}>
                        {typologyData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm">
                <h3 className="text-sm font-black text-primary  uppercase tracking-tight mb-2">Presupuesto por Tipología</h3>
                <div className="space-y-2">
                  {typologyData.map((t, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-black text-primary uppercase">{t.name}</span>
                          <span className="text-[9px] font-black text-[var(--color-neutral-500)]">{fmtQ(t.budget)}</span>
                      </div>
                      <div className="h-2 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${totalPresupuesto > 0 ? (t.budget / totalPresupuesto) * 100 : 0}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                      </div>
                      <p className="text-[7px] font-bold text-[var(--color-neutral-400)] mt-0.5">{t.count} proyecto{t.count !== 1 ? 's' : ''} · {totalPresupuesto > 0 ? ((t.budget / totalPresupuesto) * 100).toFixed(1) : 0}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tabla resumen mensual */}
          <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm overflow-x-auto">
            <h3 className="text-sm font-black text-primary  uppercase tracking-tight mb-2">Resumen Mensual</h3>
            <table className="w-full text-left text-[9px]">
              <thead>
                 <tr className="border-b border-[var(--color-neutral-100)]">
                   <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Mes</th>
                   <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">Ingresos</th>
                   <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">Gastos</th>
                   <th className="py-2 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {monthlyTrends.map((m, i) => (
                     <tr key={i} className="border-b border-[var(--color-neutral-50)] hover:bg-[var(--color-neutral-50)]">
                       <td className="py-2 pr-4 font-black text-[var(--color-primary)] uppercase">{m.mes}</td>
                        <td className="py-2 pr-4 font-black text-[var(--color-success)] text-right">{fmtQ(m.Ingresos)}</td>
                        <td className="py-2 pr-4 font-black text-[var(--color-error)] text-right">{fmtQ(m.Gastos)}</td>
                        <td className={`py-2 font-black text-right ${m.Neto >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>{fmtQ(m.Neto)}</td>
                  </tr>
                ))}
 <tr className="bg-[var(--color-neutral-50)] font-black border-t border-[var(--color-neutral-200)]">
                    <td className="py-2 pr-4 text-[var(--color-primary)] uppercase">TOTAL</td>
                    <td className="py-2 pr-4 text-right text-[var(--color-success)]">Q {fmtQ(PMath.sum(monthlyTrends.map(m => m.Ingresos)))}</td>
                    <td className="py-2 pr-4 text-right text-[var(--color-error)]">Q {fmtQ(PMath.sum(monthlyTrends.map(m => m.Gastos)))}</td>
                    <td className={`py-2 text-right ${netoCaja >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>Q {fmtQ(netoCaja)}</td>
                  </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: RANKING ────────────────────────────────────────────────────── */}
      {activeTab === 'ranking' && (
        <div className="flex flex-col gap-3">
          {/* Gráfico de barras ranking */}
          <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm">
            <div className="mb-2">
              <h3 className="text-sm font-black text-primary  uppercase tracking-tight">Ranking de Rentabilidad</h3>
              <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Proyectos ordenados por margen de utilidad</p>
            </div>
            {projectRanking.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-[9px] font-black text-[var(--color-neutral-300)] uppercase tracking-widest">Sin proyectos con presupuesto</div>
            ) : (
              <div className="chart-h-md">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectRanking.slice(0,8).map(p=>({ name:(p.name||'').substring(0,12), Margen: Math.round(p.margen) }))}
                    layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-neutral-200)" />
                    <XAxis type="number" fontSize={9} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                    <YAxis type="category" dataKey="name" fontSize={8} axisLine={false} tickLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                     <Bar dataKey="Margen" radius={[0, 4, 4, 0]} barSize={18}>
                       {projectRanking.slice(0,8).map((p, i) => (
                         <Cell key={i} fill={p.margen >= 20 ? 'var(--color-success)' : p.margen >= 0 ? 'var(--color-warning)' : 'var(--color-error)'} />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Tabla ranking completa */}
          <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm overflow-x-auto">
            <h3 className="text-sm font-black text-primary  uppercase tracking-tight mb-2">Tabla de Rentabilidad Completa</h3>
            {projectRanking.length === 0 ? (
               <p className="text-[9px] font-black text-[var(--color-neutral-300)] uppercase tracking-widest text-center py-8">Sin datos</p>
            ) : (
              <table className="w-full text-left text-[9px]">
                <thead>
                 <tr className="border-b border-[var(--color-neutral-100)]">
                   <th className="py-2 pr-2 font-black text-[var(--color-neutral-400)] uppercase tracking-widest">#</th>
                   <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Proyecto</th>
                   <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest hidden sm:table-cell">Estado</th>
                   <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">Presupuesto</th>
                   <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right hidden md:table-cell">Costo Real</th>
                   <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">Utilidad</th>
                   <th className="py-2 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRanking.map((p, i) => (
                    <motion.tr key={p.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                       className="border-b border-[var(--color-neutral-50)] hover:bg-[var(--color-neutral-50)]">
                      <td className="py-2 pr-2">
                         {i === 0 && <span className="text-[var(--color-warning)] font-black">🥇</span>}
                         {i === 1 && <span className="text-[var(--color-neutral-400)] font-black">🥈</span>}
                         {i === 2 && <span className="text-[var(--color-warning)] font-black">🥉</span>}
                         {i > 2 && <span className="font-black text-[var(--color-neutral-400)]">{i+1}</span>}
                      </td>
                       <td className="py-2 pr-4 font-black text-[var(--color-primary)] uppercase max-w-[140px] truncate">{p.name}</td>
                       <td className="py-2 pr-4 hidden sm:table-cell">
                         <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                           p.status==='EJECUCION'?'bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]':
                           p.status==='FINALIZADO'?'bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]':
                           'bg-[var(--color-neutral-100)] text-[var(--color-neutral-600)]'}`}>
                          {p.status}
                        </span>
                      </td>
                        <td className="py-2 pr-4 font-black text-[var(--color-neutral-600)] text-right">{fmtQ(p.budget||0)}</td>
                        <td className="py-2 pr-4 font-black text-[var(--color-neutral-600)] text-right hidden md:table-cell">{fmtQ(p.costoReal)}</td>
                        <td className={`py-2 pr-4 font-black text-right ${p.utilidad>=0?'text-[var(--color-success)]':'text-[var(--color-error)]'}`}>
                         {fmtQ(p.utilidad)}
                       </td>
                      <td className="py-2 text-right">
                         <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                           p.margen>=20?'bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]':
                           p.margen>=0?'bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]':
                           'bg-[color-mix(in_srgb,var(--color-error)_15%,transparent)] text-[var(--color-error)]'}`}>
                          {Math.round(p.margen)}%
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
 <tfoot className="bg-[var(--color-neutral-50)] border-t border-[var(--color-neutral-200)]">
                     <tr>
                       <td colSpan={3} className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase text-[8px] tracking-widest">TOTALES ({projectRanking.length} proyectos)</td>
                       <td className="py-2 pr-4 font-black text-[var(--color-primary)] text-right">Q {fmtQ(PMath.sum(projectRanking.map(p => p.budget || 0)))}</td>
                       <td className="py-2 pr-4 font-black text-[var(--color-primary)] text-right hidden md:table-cell">Q {fmtQ(PMath.sum(projectRanking.map(p => p.costoReal)))}</td>
                       <td className={`py-2 pr-4 font-black text-right ${PMath.sum(projectRanking.map(p => p.utilidad)) >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                         Q {fmtQ(PMath.sum(projectRanking.map(p => p.utilidad)))}
                       </td>
                       <td className="py-2 font-black text-right text-[var(--color-secondary)]">
                        {projectRanking.length > 0 ? `${precise(PMath.div(PMath.sum(projectRanking.map(p => p.margen)), projectRanking.length))}%` : 0}%
                      </td>
                    </tr>
                  </tfoot>
              </table>
            )}
          </div>

          {/* Alertas de proyectos en riesgo */}
          {projectRanking.filter(p => p.margen < 0).length > 0 && (
             <div className="bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-error)_20%,transparent)] rounded-2xl p-3">
               <div className="flex items-center gap-2 mb-2">
                 <AlertTriangle size={16} className="text-[var(--color-error)]" />
                 <h3 className="text-[10px] font-black text-[var(--color-error)] uppercase tracking-widest">Proyectos en Riesgo Financiero</h3>
               </div>
               <div className="space-y-2">
                 {projectRanking.filter(p => p.margen < 0).map(p => (
                   <div key={p.id} className="flex items-center justify-between bg-[var(--color-surface-solid)] rounded-lg p-2.5 border border-[color-mix(in_srgb,var(--color-error)_15%,transparent)]">
                     <span className="text-[9px] font-black text-[var(--color-primary)] uppercase">{p.name}</span>
                     <span className="text-[9px] font-black text-[var(--color-error)]">Margen: {Math.round(p.margen)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top performers */}
          {projectRanking.filter(p => p.margen >= 20).length > 0 && (
             <div className="bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-success)_20%,transparent)] rounded-2xl p-3">
               <div className="flex items-center gap-2 mb-2">
                 <Award size={16} className="text-[var(--color-success)]" />
                 <h3 className="text-[10px] font-black text-[var(--color-success)] uppercase tracking-widest">Proyectos de Alto Rendimiento (≥20% margen)</h3>
               </div>
               <div className="space-y-2">
                 {projectRanking.filter(p => p.margen >= 20).map(p => (
                   <div key={p.id} className="flex items-center justify-between bg-[var(--color-surface-solid)] rounded-lg p-2.5 border border-[color-mix(in_srgb,var(--color-success)_15%,transparent)]">
                     <span className="text-[9px] font-black text-[var(--color-primary)] uppercase">{p.name}</span>
                     <span className="text-[9px] font-black text-[var(--color-success)]">Margen: {Math.round(p.margen)}% · Q {Math.round(p.utilidad).toLocaleString('es-GT')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CONECTIVIDAD ──────────────────────────────────────────────── */}
      {activeTab === 'connectivity' && (
        <div className="flex flex-col gap-3">
          {/* Alertas inteligentes del sistema */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Alertas críticas */}
            <div className="bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-error)_20%,transparent)] rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-[var(--color-error)]" />
                <h3 className="text-[10px] font-black text-[var(--color-error)] uppercase tracking-widest">Alertas Críticas</h3>
              </div>
              <div className="space-y-2">
                {criticalInventory.length > 0 && (
                  <div className="bg-[var(--color-surface-solid)] rounded-lg p-2 border border-[var(--color-red-border)]">
                    <p className="text-[8px] font-black text-[var(--color-error)] uppercase">{criticalInventory.length} Materiales Críticos</p>
                    <p className="text-[7px] text-[var(--color-error)]">Stock bajo mínimo requerido</p>
                  </div>
                )}
                {pendingOrders.length > 5 && (
                  <div className="bg-[var(--color-surface-solid)] rounded-lg p-2 border border-[var(--color-red-border)]">
                    <p className="text-[8px] font-black text-[var(--color-error)] uppercase">{pendingOrders.length} OC Pendientes</p>
                    <p className="text-[7px] text-[var(--color-error)]">Órdenes sin recibir</p>
                  </div>
                )}
                {staffEfficiency.filter(s => s.efficiency < 1).length > 0 && (
                  <div className="bg-[var(--color-surface-solid)] rounded-lg p-2 border border-[var(--color-red-border)]">
                    <p className="text-[8px] font-black text-[var(--color-error)] uppercase">Baja Eficiencia Personal</p>
                    <p className="text-[7px] text-[var(--color-error)]">{staffEfficiency.filter(s => s.efficiency < 1).length} proyectos afectados</p>
                  </div>
                )}
                {(criticalInventory.length === 0 && pendingOrders.length <= 5 && staffEfficiency.filter(s => s.efficiency < 1).length === 0) && (
                  <div className="bg-[var(--color-surface-solid)] rounded-lg p-2 border border-[var(--color-green-border)]">
                    <p className="text-[8px] font-black text-[var(--color-success)] uppercase">✓ Sistema Saludable</p>
                    <p className="text-[7px] text-[var(--color-success)]">Sin alertas críticas</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recomendaciones */}
            <div className="bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-info)_20%,transparent)] rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={16} className="text-[var(--color-info)]" />
                <h3 className="text-[10px] font-black text-[var(--color-info)] uppercase tracking-widest">Recomendaciones</h3>
              </div>
              <div className="space-y-2">
                {supplierAnalysis.slice(0, 1).map(s => s.pendingCount > 0 && (
                  <div key={s.id} className="bg-[var(--color-surface-solid)] rounded-lg p-2 border border-[var(--color-blue-border)]">
                    <p className="text-[8px] font-black text-[var(--color-info)] uppercase">Seguimiento a {s.name}</p>
                    <p className="text-[7px] text-[var(--color-info)]">{s.pendingCount} órdenes pendientes</p>
                  </div>
                ))}
                {inventoryByProject.filter(p => p.completeness < 50).length > 0 && (
                  <div className="bg-[var(--color-surface-solid)] rounded-lg p-2 border border-[var(--color-blue-border)]">
                    <p className="text-[8px] font-black text-[var(--color-info)] uppercase">Generar Stock Faltante</p>
                    <p className="text-[7px] text-[var(--color-info)]">{inventoryByProject.filter(p => p.completeness < 50).length} proyectos incompletos</p>
                  </div>
                )}
                {staffEfficiency.filter(s => s.efficiency > 3).length > 0 && (
                  <div className="bg-[var(--color-surface-solid)] rounded-lg p-2 border border-[var(--color-blue-border)]">
                    <p className="text-[8px] font-black text-[var(--color-info)] uppercase">Reconocer Alto Rendimiento</p>
                    <p className="text-[7px] text-[var(--color-info)]">{staffEfficiency.filter(s => s.efficiency > 3).length} equipos destacados</p>
                  </div>
                )}
              </div>
            </div>

            {/* Métricas de conectividad */}
            <div className="bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-success)_20%,transparent)] rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={16} className="text-[var(--color-success)]" />
                <h3 className="text-[10px] font-black text-[var(--color-success)] uppercase tracking-widest">Estado General</h3>
              </div>
              <div className="space-y-2">
                <div className="bg-[var(--color-surface-solid)] rounded-lg p-2 border border-[var(--color-green-border)]">
                  <p className="text-[8px] font-black text-[var(--color-success)] uppercase">Proyectos Activos</p>
                  <p className="text-[7px] text-[var(--color-success)]">{stats.ejecucion.length} en ejecución</p>
                </div>
                <div className="bg-[var(--color-surface-solid)] rounded-lg p-2 border border-[var(--color-green-border)]">
                  <p className="text-[8px] font-black text-[var(--color-success)] uppercase">Personal Asignado</p>
                  <p className="text-[7px] text-[var(--color-success)]">{activeStaff.filter(s => s.projectIds?.length > 0).length} de {activeStaff.length} activos</p>
                </div>
                <div className="bg-[var(--color-surface-solid)] rounded-lg p-2 border border-[var(--color-green-border)]">
                  <p className="text-[8px] font-black text-[var(--color-success)] uppercase">Proveedores Activos</p>
                  <p className="text-[7px] text-[var(--color-success)]">{supplierAnalysis.filter(s => s.orderCount > 0).length} con órdenes</p>
                </div>
              </div>
            </div>
          </div>

          {/* Análisis de eficiencia de personal por proyecto */}
          <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm">
            <div className="mb-2">
              <h3 className="text-sm font-black text-primary  uppercase tracking-tight">Eficiencia Personal por Proyecto</h3>
              <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Progreso vs Costo de Personal (Progreso% / Costo Salarial en miles)</p>
            </div>
            {staffEfficiency.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin personal asignado a proyectos</div>
            ) : (
              <div className="chart-h-md">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={staffEfficiency.slice(0, 8).map(p => ({
                    name: (p.name || '').substring(0, 12),
                    Personal: p.staffCount,
                    Progreso: p.progress || 0,
                    Eficiencia: Math.round(p.efficiency * 10) / 10,
                    CostoSalarial: Math.round(p.staffCost / 1000)
                  }))} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-200)" />
                    <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} />
                    <YAxis fontSize={9} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase" }} />
                    <Bar dataKey="Personal" fill="var(--color-info)" radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar dataKey="Progreso" fill="var(--color-success)" radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar dataKey="Eficiencia" fill="var(--color-secondary)" radius={[4, 4, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Análisis de proveedores y órdenes de compra */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm">
              <div className="mb-2">
                <h3 className="text-sm font-black text-primary  uppercase tracking-tight">Top Proveedores</h3>
                <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Por volumen de compras</p>
              </div>
              <div className="space-y-2">
                {supplierAnalysis.slice(0, 5).map((supplier, i) => (
                  <div key={supplier.id} className="flex items-center justify-between bg-[var(--color-neutral-50)] rounded-xl p-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-neutral-900)] text-secondary flex items-center justify-center font-black text-[10px]">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-primary uppercase truncate">{supplier.name}</p>
                        <p className="text-[7px] font-bold text-[var(--color-neutral-400)] uppercase">{supplier.orderCount} órdenes</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-[var(--color-neutral-600)]">Q {Math.round(supplier.totalSpent/1000)}k</p>
                      {supplier.pendingCount > 0 && (
                        <p className="text-[7px] font-bold text-[var(--color-warning)] uppercase">{supplier.pendingCount} pendientes</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-6 shadow-sm">
              <div className="mb-2">
                <h3 className="text-sm font-black text-primary  uppercase tracking-tight">Completitud de Inventario</h3>
                <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Stock actual vs presupuestado por proyecto</p>
              </div>
              <div className="space-y-2">
                {inventoryByProject.slice(0, 5).map((project, i) => (
                  <div key={project.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-primary uppercase truncate max-w-[60%]">{project.name}</span>
                      <span className={`text-[9px] font-black ${
                        project.completeness >= 80 ? 'text-[var(--color-success)]' :
                        project.completeness >= 50 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]'
                      }`}>{Math.round(project.completeness)}%</span>
                    </div>
                    <div className="h-2 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${project.completeness}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className={`h-full rounded-full ${
                          project.completeness >= 80 ? 'bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)]' :
                          project.completeness >= 50 ? 'bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]' : 'bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)]'
                        }`}
                      />
                    </div>
                    <div className="flex justify-between text-[7px] font-bold text-[var(--color-neutral-400)]">
                      <span>{project.inventoryItems} items</span>
                      {project.criticalItems > 0 && (
                        <span className="text-[var(--color-error)]">{project.criticalItems} críticos</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Matriz de conectividad entre módulos */}
          <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm">
            <div className="mb-2">
              <h3 className="text-sm font-black text-primary uppercase tracking-tight">Matriz de Conectividad</h3>
              <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Relaciones entre módulos del sistema</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  title: 'Staff ↔ Projects',
                  value: `${activeStaff.filter(s => s.projectIds?.length > 0).length}/${activeStaff.length}`,
                  desc: 'Personal asignado',
                  color: 'bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] border-[color-mix(in_srgb,var(--color-info)_20%,transparent)] text-[var(--color-info)]',
                  icon: <Users size={14} />
                },
                {
                  title: 'Suppliers ↔ Inventory',
                  value: `${supplierAnalysis.filter(s => s.orderCount > 0).length}/${suppliers.length}`,
                  desc: 'Proveedores activos',
                  color: 'bg-[color-mix(in_srgb,var(--color-secondary)_10%,transparent)] border-[color-mix(in_srgb,var(--color-secondary)_20%,transparent)] text-[var(--color-secondary-dark)]',
                  icon: <Truck size={14} />
                },
                {
                  title: 'Inventory ↔ Projects',
                  value: `${inventoryByProject.length}/${displayProjects.length}`,
                  desc: 'Proyectos con inventario',
                  color: 'bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] border-[color-mix(in_srgb,var(--color-success)_20%,transparent)] text-[var(--color-success)]',
                  icon: <Package size={14} />
                },
                {
                  title: 'Analytics ↔ All',
                  value: (() => {
                    const connected = displayProjects.length > 0 ? 1 : 0;
                    const allData = [
                      transactions.some(t => !t.projectId || existingProjectIds.has(t.projectId)) ? 1 : 0,
                      validInventoryItems.length > 0 ? 1 : 0,
                      purchaseOrders.some(po => !po.projectId || existingProjectIds.has(po.projectId)) ? 1 : 0,
                    ].filter(Boolean).length;
                    const total = 3;
                    return `${Math.round(((connected + allData) / (1 + total)) * 100)}%`;
                  })(),
                  desc: 'Módulos con datos vinculados',
                  color: 'bg-secondary/10 border-secondary/20 text-secondary',
                  icon: <BarChart3 size={14} />
                }
              ].map((connection, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={`border rounded-xl p-3 ${connection.color}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {connection.icon}
                    <span className="text-[8px] font-black uppercase tracking-widest">{connection.title}</span>
                  </div>
                  <p className="text-xl font-black">{connection.value}</p>
                  <p className="text-[7px] font-bold uppercase tracking-widest mt-1">{connection.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Tabla resumen de conectividad */}
          <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-200)] rounded-2xl p-3 shadow-sm overflow-x-auto">
            <h3 className="text-sm font-black text-primary uppercase tracking-tight mb-2">Resumen de Conectividad del Sistema</h3>
            <table className="w-full text-left text-[9px]">
              <thead>
                <tr className="border-b border-[var(--color-neutral-100)]">
                  <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Módulo</th>
                  <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">Total Items</th>
                  <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">Conectados</th>
                  <th className="py-2 pr-4 font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">% Conectividad</th>
                  <th className="py-2 font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Estado</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    module: 'Personal',
                    total: activeStaff.length,
                    connected: activeStaff.filter(s => s.projectIds?.length > 0).length,
                    icon: <Users size={12} className="text-[var(--color-info)]" />
                  },
                  {
                    module: 'Proyectos',
                    total: displayProjects.length,
                    connected: displayProjects.filter(p => activeStaff.some(s => s.projectIds?.includes(p.id))).length,
                    icon: <Building2 size={12} className="text-secondary" />
                  },
                  {
                    module: 'Proveedores',
                    total: suppliers.length,
                    connected: supplierAnalysis.filter(s => s.orderCount > 0).length,
                    icon: <Truck size={12} className="text-[var(--color-secondary-dark)]" />
                  },
                  {
                    module: 'Inventario',
                    total: validInventoryItems.length,
                    connected: validInventoryItems.filter(i => i.projectId && existingProjectIds.has(i.projectId)).length,
                    icon: <Package size={12} className="text-[var(--color-success)]" />
                  }
                ].map((row, i) => {
                  const percentage = row.total > 0 ? precise((row.connected / row.total) * 100, 0) : 0;
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-[var(--color-neutral-50)]">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          {row.icon}
                          <span className="font-black text-primary uppercase">{row.module}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 font-black text-[var(--color-neutral-600)] text-right">{row.total}</td>
                      <td className="py-2 pr-4 font-black text-[var(--color-neutral-600)] text-right">{row.connected}</td>
                      <td className="py-2 pr-4 font-black text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black ${
                          percentage >= 80 ? 'bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[var(--color-success)]' :
                          percentage >= 50 ? 'bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]' :
                          'bg-[color-mix(in_srgb,var(--color-error)_15%,transparent)] text-[var(--color-error)]'
                        }`}>{percentage}%</span>
                      </td>
                      <td className="py-2">
                        <span className={`text-[8px] font-black uppercase ${
                          percentage >= 80 ? 'text-[var(--color-success)]' :
                          percentage >= 50 ? 'text-[var(--color-warning)]' :
                          'text-[var(--color-error)]'
                        }`}>
                          {percentage >= 80 ? '✓ Óptimo' : percentage >= 50 ? '⚠ Mejorable' : '✗ Crítico'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


