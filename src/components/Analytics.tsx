/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart as PieChartIcon, 
  Zap,
  Target,
  Download,
  Filter
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart,
  Cell,
  Pie,
  Legend,
  RadialBarChart,
  RadialBar
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
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [exportTemplate, setExportTemplate] = useState<string>('modern');
  const [exportCsvTemplate, setExportCsvTemplate] = useState<string>('completo');

  useEffect(() => {
    const unsub = subscribeToCollection('projects', (data) => {
      setProjects(data as Project[]);
      setLoading(false);
    });
    return () => unsub();
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-primary uppercase">Analíticas</h2>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Análisis de portafolio y rendimiento</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-end">
          {/* Project filter */}
          <div className="flex flex-col gap-1">
            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Filter size={8} /> Proyecto</span>
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="h-10 bg-white border border-slate-200 rounded-xl px-3 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary shadow-sm cursor-pointer min-w-[160px]"
            >
              <option value="ALL">TODOS LOS PROYECTOS</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{(p.name || '').substring(0, 30).toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* PDF template selector + export */}
          {selectedProject && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Plantilla PDF</span>
                <select
                  value={exportTemplate}
                  onChange={e => setExportTemplate(e.target.value)}
                  className="h-10 bg-white border border-slate-200 rounded-xl px-3 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary shadow-sm cursor-pointer min-w-[140px]"
                >
                  {PDF_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleExportPDF}
                className="h-10 bg-secondary text-primary px-4 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-secondary/90 transition-all shadow-sm"
              >
                <Download size={14} /> PDF
              </button>

              <div className="flex flex-col gap-1">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Plantilla CSV</span>
                <select
                  value={exportCsvTemplate}
                  onChange={e => setExportCsvTemplate(e.target.value)}
                  className="h-10 bg-white border border-slate-200 rounded-xl px-3 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary shadow-sm cursor-pointer min-w-[140px]"
                >
                  {CSV_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleExportCSV}
                className="h-10 bg-slate-900 text-white px-4 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-700 transition-all shadow-sm"
              >
                <Download size={14} /> CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
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
    </div>
  );
}
