/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
import { subscribeToCollection } from '../services/firestoreService';
import { useCountUp } from '../hooks/useCountUp';
import { generateProjectPDF, generateProjectCSV, PDF_TEMPLATES, CSV_TEMPLATES } from '../lib/exportUtils';
import { Project } from '../constants';

function AnimatedNum({ v }: { v: number }) { const n = useCountUp(v, 800); return <>{n}</>; }

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-left min-w-[140px]">
      {label && <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-[9px] font-bold text-slate-300 uppercase">{entry.name}:</span>
          <span className="text-[10px] font-black text-white">
            {typeof entry.value === 'number' && entry.name !== 'Margen'
              ? `Q${Number(entry.value).toLocaleString('es-GT')}`
              : `${entry.value}${entry.name === 'Margen' ? '%' : ''}`}
          </span>
        </div>
      ))}
    </div>
  );
}

function calcItemCost(item: any) {
  const matCost = (item.materials || []).reduce((a: number, m: any) => a + (m.price * m.quantity * (item.projectQuantity || 1)), 0);
  const labCost = (item.labor || []).reduce((a: number, l: any) => a + (l.price * l.quantity * (item.projectQuantity || 1)), 0);
  return matCost + labCost;
}

export default function AnalyticsModule() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [exportTemplate, setExportTemplate] = useState<string>('modern');
  const [exportCsvTemplate, setExportCsvTemplate] = useState<string>('completo');
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'ranking' | 'connectivity'>('overview');

  useEffect(() => {
    const u1 = subscribeToCollection('projects', (data) => { setProjects(data as Project[]); setLoading(false); });
    const u2 = subscribeToCollection('transactions', (data) => setTransactions(data));
    const u3 = subscribeToCollection('staff', (data) => setStaff(data));
    const u4 = subscribeToCollection('suppliers', (data) => setSuppliers(data));
    const u5 = subscribeToCollection('inventory', (data) => setInventory(data));
    const u6 = subscribeToCollection('purchaseOrders', (data) => setPurchaseOrders(data));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, []);

  // Filtered data based on selected project
  const displayProjects = selectedProjectId === 'ALL'
    ? projects
    : projects.filter(p => p.id === selectedProjectId);

  const selectedProject = selectedProjectId !== 'ALL'
    ? projects.find(p => p.id === selectedProjectId) || null
    : null;

  const stats = {
    cotizados: displayProjects.filter(p => p.status === 'COTIZACION'),
    ejecucion: displayProjects.filter(p => p.status === 'EJECUCION'),
    finalizados: displayProjects.filter(p => p.status === 'FINALIZADO'),
  };

  const rentabilidadData = displayProjects
    .filter(p => p.budget > 0)
    .map(p => {
      const costoReal = (p.directCosts || 0) * (1 + ((p.indirectCosts || 0) + (p.administrativeCosts || 0) + (p.personalCosts || 0)) / 100);
      const utilidad = (p.budget || 0) - costoReal;
      return {
        name: (p.name || "").substring(0, 14),
        Presupuesto: Math.round(p.budget || 0),
        Costo: Math.round(costoReal),
        Utilidad: Math.round(utilidad),
        Margen: p.budget > 0 ? Math.round((utilidad / p.budget) * 100) : 0,
      };
    }).slice(0, 8);

  const pieData = [
    { name: 'Cotizado', value: stats.cotizados.length, color: '#94a3b8' },
    { name: 'Ejecución', value: stats.ejecucion.length, color: '#F15A24' },
    { name: 'Finalizado', value: stats.finalizados.length, color: '#1A1A1A' },
  ];

  // Per-project breakdown charts (only when a project is selected)
  const itemsBreakdown = selectedProject
    ? (selectedProject.items || []).map(item => ({
        name: (item.description || '').substring(0, 16),
        Materiales: Math.round((item.materials || []).reduce((a: number, m: any) => a + m.price * m.quantity * (item.projectQuantity || 1), 0)),
        ManoObra: Math.round((item.labor || []).reduce((a: number, l: any) => a + l.price * l.quantity * (item.projectQuantity || 1), 0)),
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
      const key = t.date.substring(0, 7);
      if (!months[key]) return;
      if (t.type === 'INGRESO') months[key].Ingresos += Number(t.amount || 0);
      else months[key].Gastos += Number(t.amount || 0);
    });
    return Object.values(months).map(m => ({ ...m, Neto: m.Ingresos - m.Gastos }));
  }, [transactions]);

  // ── Ranking de proyectos por margen ────────────────────────────────────────
  const projectRanking = useMemo(() =>
    displayProjects
      .filter(p => p.budget > 0)
      .map(p => {
        const costoReal = (p.directCosts || 0) * (1 + ((p.indirectCosts || 0) + (p.administrativeCosts || 0) + (p.personalCosts || 0)) / 100);
        const utilidad = (p.budget || 0) - costoReal;
        const margen = p.budget > 0 ? (utilidad / p.budget) * 100 : 0;
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
      map[t].budget += p.budget || 0;
    });
    const COLORS = ['#F15A24','#1A1A1A','#0071BC','#10b981','#a78bfa'];
    return Object.entries(map).map(([name, v], i) => ({ name, ...v, color: COLORS[i % COLORS.length] }));
  }, [displayProjects]);

  // ── KPIs financieros y operativos mejorados ────────────────────────────────────────────────────────
  const totalIngresos = transactions.filter(t => t.type === 'INGRESO').reduce((a, t) => a + Number(t.amount || 0), 0);
  const totalGastos = transactions.filter(t => t.type === 'GASTO').reduce((a, t) => a + Number(t.amount || 0), 0);
  const netoCaja = totalIngresos - totalGastos;
  const totalPresupuesto = displayProjects.reduce((a, p) => a + (p.budget || 0), 0);
  
  // Nuevas métricas cruzadas
  const activeStaff = staff.filter(s => s.status === 'ACTIVO');
  const totalSalaries = activeStaff.reduce((a, s) => a + Number(s.salary || 0), 0);
  const criticalInventory = inventory.filter(i => (i.stock || 0) <= (i.minStock || 0));
  const pendingOrders = purchaseOrders.filter(po => po.status === 'PENDIENTE');
  const totalPendingValue = pendingOrders.reduce((a, po) => a + Number(po.total || 0), 0);
  
  // Eficiencia de personal por proyecto
  const staffEfficiency = displayProjects.map(p => {
    const projectStaff = activeStaff.filter(s => s.projectIds?.includes(p.id));
    const staffCost = projectStaff.reduce((a, s) => a + Number(s.salary || 0), 0);
    const efficiency = p.budget > 0 && staffCost > 0 ? (p.progress || 0) / (staffCost / 1000) : 0;
    return { ...p, staffCount: projectStaff.length, staffCost, efficiency };
  }).filter(p => p.staffCount > 0);
  
  // Análisis de proveedores
  const supplierAnalysis = suppliers.map(s => {
    const supplierOrders = purchaseOrders.filter(po => po.supplierId === s.id);
    const totalSpent = supplierOrders.reduce((a, po) => a + Number(po.total || 0), 0);
    const avgOrderValue = supplierOrders.length > 0 ? totalSpent / supplierOrders.length : 0;
    const pendingCount = supplierOrders.filter(po => po.status === 'PENDIENTE').length;
    return { ...s, totalSpent, avgOrderValue, orderCount: supplierOrders.length, pendingCount };
  }).sort((a, b) => b.totalSpent - a.totalSpent);
  
  // Análisis de inventario por proyecto
  const inventoryByProject = displayProjects.map(p => {
    const projectInventory = inventory.filter(i => i.projectId === p.id);
    const totalBudgetedValue = projectInventory.reduce((a, i) => a + (i.budgetedQty || 0) * (i.budgetedCost || 0), 0);
    const totalCurrentValue = projectInventory.reduce((a, i) => a + (i.stock || 0) * (i.budgetedCost || 0), 0);
    const criticalItems = projectInventory.filter(i => (i.stock || 0) <= (i.minStock || 0));
    const completeness = totalBudgetedValue > 0 ? (totalCurrentValue / totalBudgetedValue) * 100 : 0;
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-primary uppercase">Analíticas</h2>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Análisis de portafolio y rendimiento</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-end">
          {/* Tabs - Agregando nueva pestaña de conectividad */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {([['overview','Resumen'],['trends','Tendencias'],['ranking','Ranking'],['connectivity','Conectividad']] as const).map(([tab, label]) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                {label}
              </button>
            ))}
          </div>
          {/* Project filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Filter size={8} /> Proyecto</span>
            <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)} title="Filtrar por proyecto"
              className="h-10 bg-white border border-slate-200 rounded-xl px-3 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary shadow-sm cursor-pointer min-w-[160px]">
              <option value="ALL">TODOS LOS PROYECTOS</option>
              {projects.map(p => <option key={p.id} value={p.id}>{(p.name || '').substring(0, 30).toUpperCase()}</option>)}
            </select>
          </div>
          {selectedProject && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Plantilla PDF</span>
                <select value={exportTemplate} onChange={e => setExportTemplate(e.target.value)} title="Plantilla PDF"
                  className="h-10 bg-white border border-slate-200 rounded-xl px-3 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary shadow-sm cursor-pointer min-w-[140px]">
                  {PDF_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <button type="button" onClick={handleExportPDF}
                className="h-10 bg-secondary text-primary px-4 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-secondary/90 transition-all shadow-sm">
                <Download size={14} /> PDF
              </button>
              <div className="flex flex-col gap-1">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Plantilla CSV</span>
                <select value={exportCsvTemplate} onChange={e => setExportCsvTemplate(e.target.value)} title="Plantilla CSV"
                  className="h-10 bg-white border border-slate-200 rounded-xl px-3 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary shadow-sm cursor-pointer min-w-[140px]">
                  {CSV_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <button type="button" onClick={handleExportCSV}
                className="h-10 bg-slate-900 text-white px-4 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-all shadow-sm">
                <Download size={14} /> CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Financial KPI Strip - Mejorado con métricas cruzadas */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Presupuesto Total', value: `Q ${totalPresupuesto.toLocaleString('es-GT')}`, icon: <Layers size={14}/>, color: 'text-purple-600', bg: 'bg-purple-50', trend: null },
          { label: 'Personal Activo', value: `${activeStaff.length}`, icon: <Users size={14}/>, color: 'text-blue-600', bg: 'bg-blue-50', trend: null, sub: `Q ${Math.round(totalSalaries/1000)}k salarios` },
          { label: 'Stock Crítico', value: `${criticalInventory.length}`, icon: <Package size={14}/>, color: criticalInventory.length > 0 ? 'text-red-600' : 'text-green-600', bg: criticalInventory.length > 0 ? 'bg-red-50' : 'bg-green-50', trend: criticalInventory.length > 0 ? 'down' : 'up', sub: `de ${inventory.length} items` },
          { label: 'OC Pendientes', value: `${pendingOrders.length}`, icon: <ShoppingCart size={14}/>, color: pendingOrders.length > 0 ? 'text-amber-600' : 'text-green-600', bg: pendingOrders.length > 0 ? 'bg-amber-50' : 'bg-green-50', trend: null, sub: `Q ${Math.round(totalPendingValue/1000)}k` },
          { label: 'Ingresos Reales', value: `Q ${Math.round(totalIngresos/1000)}k`, icon: <ArrowUpRight size={14}/>, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'up' },
          { label: 'Neto en Caja', value: `Q ${Math.round(netoCaja/1000)}k`, icon: <DollarSign size={14}/>, color: netoCaja >= 0 ? 'text-emerald-600' : 'text-red-600', bg: netoCaja >= 0 ? 'bg-emerald-50' : 'bg-red-50', trend: netoCaja >= 0 ? 'up' : 'down' },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-white rounded-xl border border-slate-100 p-3 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg shrink-0 ${kpi.bg} ${kpi.color}`}>{kpi.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest truncate">{kpi.label}</p>
                <p className="text-sm font-black text-primary truncate">{kpi.value}</p>
              </div>
            </div>
            {kpi.sub && (
              <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest truncate">{kpi.sub}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Tab: OVERVIEW (contenido original) */}
      {activeTab === 'overview' && (<>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 text-left">
        {[
          { label: 'Proyectos', value: displayProjects.length, label2: 'Total Registrados', icon: <BarChart3 className="text-primary w-5 h-5" /> },
          { label: 'Cotizado', value: stats.cotizados.length, label2: 'En espera', icon: <Zap className="text-secondary w-5 h-5" /> },
          { label: 'Ejecución', value: stats.ejecucion.length, label2: 'Activos', icon: <TrendingUp className="text-blue-500 w-5 h-5" /> },
          { label: 'Finalizado', value: stats.finalizados.length, label2: 'Completados', icon: <Target className="text-green-500 w-5 h-5" /> },
        ].map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i}
            className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{stat.label}</span>
              {stat.icon}
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-primary"><AnimatedNum v={stat.value} /></h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label2}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Budget total */}
      <div className="bg-slate-900 rounded-2xl p-4 md:p-6 text-white text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            {selectedProject ? `Presupuesto: ${selectedProject.name}` : 'Presupuesto Total Portafolio'}
          </p>
          <span className="text-2xl md:text-3xl font-black text-white">
            Q. {displayProjects.reduce((a, p) => a + (p.budget || 0), 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
          </span>
        </div>
        {selectedProject && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            {[
              { label: 'Costo Directo', val: selectedProject.directCosts || 0 },
              { label: `Indirecto ${selectedProject.indirectCosts || 0}%`, val: (selectedProject.directCosts || 0) * (selectedProject.indirectCosts || 0) / 100 },
              { label: `Admin ${selectedProject.administrativeCosts || 0}%`, val: (selectedProject.directCosts || 0) * (selectedProject.administrativeCosts || 0) / 100 },
              { label: `Personal ${selectedProject.personalCosts || 0}%`, val: (selectedProject.directCosts || 0) * (selectedProject.personalCosts || 0) / 100 },
            ].map((c, i) => (
              <div key={i} className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{c.label}</p>
                <p className="text-[11px] font-black text-white mt-1">Q {c.val.toLocaleString('es-GT', { minimumFractionDigits: 0 })}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pie chart */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm text-left">
          <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-6">
            {selectedProject ? 'Estado del Proyecto' : 'Composición de Portafolio'}
          </h4>
          <div className="chart-h-lg w-full relative">
            <ResponsiveContainer width="100%" height="100%" minHeight={180}>
              <PieChart>
                <Pie
                  data={pieData.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
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
              <span className="text-3xl font-black text-primary leading-none">{displayProjects.length}</span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Proyectos</span>
            </div>
          </div>
        </div>

        {/* Radial / System health */}
        <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white text-left">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Estado del Sistema</h4>
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
                  { name: 'Carga', value: Math.min(Math.round((displayProjects.length / 20) * 100), 100), fill: '#60a5fa' },
                  { name: 'Cierre', value: Math.min(Math.round((stats.finalizados.length / (displayProjects.length || 1)) * 100), 100), fill: '#34d399' },
                  { name: 'Activos', value: Math.min(Math.round((stats.ejecucion.length / (displayProjects.length || 1)) * 100), 100), fill: '#f59e0b' },
                ]}
                startAngle={180} endAngle={0}
              >
                <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Tooltip content={<CustomTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              { label: 'Carga', val: displayProjects.length, max: 20, color: 'bg-blue-400' },
              { label: 'Cierre', val: stats.finalizados.length, max: displayProjects.length || 1, color: 'bg-emerald-400' },
              { label: 'Activos', val: stats.ejecucion.length, max: displayProjects.length || 1, color: 'bg-amber-400' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${item.color}`} />
                <p className="text-[8px] font-black text-slate-400 uppercase">{item.label}</p>
                <p className="text-[10px] font-black text-white">{item.val}/{item.max}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rentabilidad chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-black text-primary uppercase tracking-tight">Rentabilidad por Proyecto</h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Presupuesto vs Costo Real vs Utilidad (Q)</p>
        </div>
        {rentabilidadData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin proyectos con presupuesto</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minHeight={180}>
              <BarChart data={rentabilidadData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} />
                <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={v => `Q${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase" }} />
                <Bar dataKey="Presupuesto" fill="#a78bfa" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="Costo" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="Utilidad" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {rentabilidadData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {rentabilidadData.map((p, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-3">
                <p className="text-[8px] font-black text-slate-400 uppercase truncate">{p.name}</p>
                <p className={`text-sm font-black ${p.Margen >= 0 ? "text-emerald-600" : "text-red-500"}`}>{p.Margen}%</p>
                <p className="text-[8px] text-slate-400">Margen</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-project items breakdown (only when a project is selected) */}
      {selectedProject && itemsBreakdown.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-black text-primary uppercase tracking-tight">Desglose por Renglón</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Materiales vs Mano de Obra por renglón (Q)</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={itemsBreakdown} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" fontSize={8} axisLine={false} tickLine={false} angle={-30} textAnchor="end" />
                <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={v => `Q${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase" }} />
                <Bar dataKey="Materiales" fill="#F15A24" radius={[4, 4, 0, 0]} barSize={14} />
                <Bar dataKey="ManoObra" fill="#1A1A1A" radius={[4, 4, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Summary table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[9px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-2 pr-4 font-black text-slate-400 uppercase tracking-widest">Renglón</th>
                  <th className="py-2 pr-4 font-black text-slate-400 uppercase tracking-widest text-right">Materiales</th>
                  <th className="py-2 pr-4 font-black text-slate-400 uppercase tracking-widest text-right">Mano Obra</th>
                  <th className="py-2 font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {itemsBreakdown.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 pr-4 font-bold text-primary uppercase">{row.name}</td>
                    <td className="py-2 pr-4 font-black text-slate-600 text-right">Q {row.Materiales.toLocaleString('es-GT')}</td>
                    <td className="py-2 pr-4 font-black text-slate-600 text-right">Q {row.ManoObra.toLocaleString('es-GT')}</td>
                    <td className="py-2 font-black text-secondary text-right">Q {row.Total.toLocaleString('es-GT')}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-black">
                  <td className="py-2 pr-4 text-primary uppercase">TOTAL</td>
                  <td className="py-2 pr-4 text-right text-primary">Q {itemsBreakdown.reduce((a, r) => a + r.Materiales, 0).toLocaleString('es-GT')}</td>
                  <td className="py-2 pr-4 text-right text-primary">Q {itemsBreakdown.reduce((a, r) => a + r.ManoObra, 0).toLocaleString('es-GT')}</td>
                  <td className="py-2 text-right text-secondary">Q {itemsBreakdown.reduce((a, r) => a + r.Total, 0).toLocaleString('es-GT')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>)}

      {/* ── TAB: TENDENCIAS ─────────────────────────────────────────────────── */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Área de ingresos vs gastos por mes */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-primary uppercase tracking-tight">Flujo de Caja Mensual</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ingresos vs Gastos — últimos 6 meses</p>
              </div>
              <Calendar size={18} className="text-slate-300" />
            </div>
            {monthlyTrends.every(m => m.Ingresos === 0 && m.Gastos === 0) ? (
              <div className="h-48 flex items-center justify-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin transacciones registradas</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrends} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F15A24" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#F15A24" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mes" fontSize={9} axisLine={false} tickLine={false} />
                    <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={v => `Q${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }} />
                    <Area type="monotone" dataKey="Ingresos" stroke="#10b981" strokeWidth={2} fill="url(#gradIngresos)" dot={{ r: 4, fill: '#10b981' }} />
                    <Area type="monotone" dataKey="Gastos" stroke="#F15A24" strokeWidth={2} fill="url(#gradGastos)" dot={{ r: 4, fill: '#F15A24' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Neto mensual en barras */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-black text-primary uppercase tracking-tight">Neto Mensual</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Resultado neto por mes (Ingresos − Gastos)</p>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrends} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="mes" fontSize={9} axisLine={false} tickLine={false} />
                  <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={v => `Q${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Neto" radius={[4, 4, 0, 0]} barSize={28}
                    fill="#10b981"
                    label={false}>
                    {monthlyTrends.map((entry, index) => (
                      <Cell key={index} fill={entry.Neto >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribución por tipología */}
          {typologyData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-black text-primary uppercase tracking-tight mb-4">Proyectos por Tipología</h3>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typologyData} cx="50%" cy="50%" outerRadius={80} dataKey="count" paddingAngle={4}>
                        {typologyData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-black text-primary uppercase tracking-tight mb-4">Presupuesto por Tipología</h3>
                <div className="space-y-3">
                  {typologyData.map((t, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-black text-primary uppercase">{t.name}</span>
                        <span className="text-[9px] font-black text-slate-500">Q {t.budget.toLocaleString('es-GT')}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${totalPresupuesto > 0 ? (t.budget / totalPresupuesto) * 100 : 0}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                      </div>
                      <p className="text-[7px] font-bold text-slate-400 mt-0.5">{t.count} proyecto{t.count !== 1 ? 's' : ''} · {totalPresupuesto > 0 ? ((t.budget / totalPresupuesto) * 100).toFixed(1) : 0}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tabla resumen mensual */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-x-auto">
            <h3 className="text-sm font-black text-primary uppercase tracking-tight mb-4">Resumen Mensual</h3>
            <table className="w-full text-left text-[9px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-2 pr-4 font-black text-slate-400 uppercase tracking-widest">Mes</th>
                  <th className="py-2 pr-4 font-black text-slate-400 uppercase tracking-widest text-right">Ingresos</th>
                  <th className="py-2 pr-4 font-black text-slate-400 uppercase tracking-widest text-right">Gastos</th>
                  <th className="py-2 font-black text-slate-400 uppercase tracking-widest text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {monthlyTrends.map((m, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 pr-4 font-black text-primary uppercase">{m.mes}</td>
                    <td className="py-2 pr-4 font-black text-emerald-600 text-right">Q {m.Ingresos.toLocaleString('es-GT')}</td>
                    <td className="py-2 pr-4 font-black text-red-500 text-right">Q {m.Gastos.toLocaleString('es-GT')}</td>
                    <td className={`py-2 font-black text-right ${m.Neto >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>Q {m.Neto.toLocaleString('es-GT')}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-black border-t border-slate-200">
                  <td className="py-2 pr-4 text-primary uppercase">TOTAL</td>
                  <td className="py-2 pr-4 text-right text-emerald-600">Q {monthlyTrends.reduce((a,m)=>a+m.Ingresos,0).toLocaleString('es-GT')}</td>
                  <td className="py-2 pr-4 text-right text-red-500">Q {monthlyTrends.reduce((a,m)=>a+m.Gastos,0).toLocaleString('es-GT')}</td>
                  <td className={`py-2 text-right ${netoCaja>=0?'text-emerald-600':'text-red-500'}`}>Q {netoCaja.toLocaleString('es-GT')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: RANKING ────────────────────────────────────────────────────── */}
      {activeTab === 'ranking' && (
        <div className="space-y-6">
          {/* Gráfico de barras ranking */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-black text-primary uppercase tracking-tight">Ranking de Rentabilidad</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Proyectos ordenados por margen de utilidad</p>
            </div>
            {projectRanking.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin proyectos con presupuesto</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectRanking.slice(0,8).map(p=>({ name:(p.name||'').substring(0,12), Margen: Math.round(p.margen) }))}
                    layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis type="number" fontSize={9} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                    <YAxis type="category" dataKey="name" fontSize={8} axisLine={false} tickLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Margen" radius={[0, 4, 4, 0]} barSize={18}>
                      {projectRanking.slice(0,8).map((p, i) => (
                        <Cell key={i} fill={p.margen >= 20 ? '#10b981' : p.margen >= 0 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Tabla ranking completa */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-x-auto">
            <h3 className="text-sm font-black text-primary uppercase tracking-tight mb-4">Tabla de Rentabilidad Completa</h3>
            {projectRanking.length === 0 ? (
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest text-center py-8">Sin datos</p>
            ) : (
              <table className="w-full text-left text-[9px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-2 pr-2 font-black text-slate-400 uppercase tracking-widest">#</th>
                    <th className="py-2 pr-4 font-black text-slate-400 uppercase tracking-widest">Proyecto</th>
                    <th className="py-2 pr-4 font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">Estado</th>
                    <th className="py-2 pr-4 font-black text-slate-400 uppercase tracking-widest text-right">Presupuesto</th>
                    <th className="py-2 pr-4 font-black text-slate-400 uppercase tracking-widest text-right hidden md:table-cell">Costo Real</th>
                    <th className="py-2 pr-4 font-black text-slate-400 uppercase tracking-widest text-right">Utilidad</th>
                    <th className="py-2 font-black text-slate-400 uppercase tracking-widest text-right">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRanking.map((p, i) => (
                    <motion.tr key={p.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 pr-2">
                        {i === 0 && <span className="text-amber-500 font-black">🥇</span>}
                        {i === 1 && <span className="text-slate-400 font-black">🥈</span>}
                        {i === 2 && <span className="text-amber-700 font-black">🥉</span>}
                        {i > 2 && <span className="font-black text-slate-400">{i+1}</span>}
                      </td>
                      <td className="py-2 pr-4 font-black text-primary uppercase max-w-[140px] truncate">{p.name}</td>
                      <td className="py-2 pr-4 hidden sm:table-cell">
                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                          p.status==='EJECUCION'?'bg-orange-100 text-orange-700':
                          p.status==='FINALIZADO'?'bg-emerald-100 text-emerald-700':
                          'bg-slate-100 text-slate-600'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-black text-slate-600 text-right">Q {(p.budget||0).toLocaleString('es-GT')}</td>
                      <td className="py-2 pr-4 font-black text-slate-600 text-right hidden md:table-cell">Q {Math.round(p.costoReal).toLocaleString('es-GT')}</td>
                      <td className={`py-2 pr-4 font-black text-right ${p.utilidad>=0?'text-emerald-600':'text-red-500'}`}>
                        Q {Math.round(p.utilidad).toLocaleString('es-GT')}
                      </td>
                      <td className="py-2 text-right">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          p.margen>=20?'bg-emerald-100 text-emerald-700':
                          p.margen>=0?'bg-amber-100 text-amber-700':
                          'bg-red-100 text-red-600'}`}>
                          {Math.round(p.margen)}%
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={3} className="py-2 pr-4 font-black text-slate-400 uppercase text-[8px] tracking-widest">TOTALES ({projectRanking.length} proyectos)</td>
                    <td className="py-2 pr-4 font-black text-primary text-right">Q {projectRanking.reduce((a,p)=>a+(p.budget||0),0).toLocaleString('es-GT')}</td>
                    <td className="py-2 pr-4 font-black text-primary text-right hidden md:table-cell">Q {Math.round(projectRanking.reduce((a,p)=>a+p.costoReal,0)).toLocaleString('es-GT')}</td>
                    <td className={`py-2 pr-4 font-black text-right ${projectRanking.reduce((a,p)=>a+p.utilidad,0)>=0?'text-emerald-600':'text-red-500'}`}>
                      Q {Math.round(projectRanking.reduce((a,p)=>a+p.utilidad,0)).toLocaleString('es-GT')}
                    </td>
                    <td className="py-2 font-black text-right text-secondary">
                      {projectRanking.length > 0 ? Math.round(projectRanking.reduce((a,p)=>a+p.margen,0)/projectRanking.length) : 0}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Alertas de proyectos en riesgo */}
          {projectRanking.filter(p => p.margen < 0).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-red-500" />
                <h3 className="text-[10px] font-black text-red-700 uppercase tracking-widest">Proyectos en Riesgo Financiero</h3>
              </div>
              <div className="space-y-2">
                {projectRanking.filter(p => p.margen < 0).map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-red-100">
                    <span className="text-[9px] font-black text-primary uppercase">{p.name}</span>
                    <span className="text-[9px] font-black text-red-600">Margen: {Math.round(p.margen)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top performers */}
          {projectRanking.filter(p => p.margen >= 20).length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Award size={16} className="text-emerald-600" />
                <h3 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Proyectos de Alto Rendimiento (≥20% margen)</h3>
              </div>
              <div className="space-y-2">
                {projectRanking.filter(p => p.margen >= 20).map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-emerald-100">
                    <span className="text-[9px] font-black text-primary uppercase">{p.name}</span>
                    <span className="text-[9px] font-black text-emerald-600">Margen: {Math.round(p.margen)}% · Q {Math.round(p.utilidad).toLocaleString('es-GT')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
