/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart as PieChartIcon, 
  ArrowUpRight, 
  ArrowDownRight, 
  Zap,
  Target,
  LineChart as LineChartIcon,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  PieChart,
  Cell,
  Pie,
  Legend
} from 'recharts';
import { motion } from 'motion/react';
import { subscribeToCollection } from '../services/firestoreService';

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export default function AnalyticsModule() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToCollection('projects', (data) => {
      setProjects(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const stats = {
    cotizados: projects.filter(p => p.status === 'COTIZACION'),
    ejecucion: projects.filter(p => p.status === 'EJECUCION'),
    finalizados: projects.filter(p => p.status === 'FINALIZADO'),
  };

  const rentabilidadData = projects
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-primary uppercase">Analytics</h2>
          <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Análisis de portafolio y rendimiento</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <button className="flex-1 md:flex-none bg-white border border-slate-200 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
             <Download size={14} /> Reporte
           </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 text-left">
         {[
           { label: 'Proyectos', value: projects.length, label2: 'Total Registrados', icon: <BarChart3 className="text-primary w-5 h-5" /> },
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
               <h3 className="text-2xl font-black text-primary">{stat.value}</h3>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{stat.label2}</p>
             </div>
           </motion.div>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm text-left">
           <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-6">Composición de Portafolio</h4>
           <div className="h-[300px] w-full relative">
              <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                <PieChart>
                  <Pie
                    data={pieData}
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
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: '900' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8 text-center">
                 <span className="text-3xl font-black text-primary leading-none">{projects.length}</span>
                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Proyectos</span>
              </div>
           </div>
        </div>

        <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white text-left">
           <div className="flex justify-between items-start mb-8">
              <div>
                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Estado del Sistema</h4>
                 <p className="text-xl font-black uppercase tracking-tight text-secondary">Salud Operativa</p>
              </div>
              <BarChart3 size={24} className="text-secondary" />
           </div>
           
           <div className="space-y-6">
              {[
                { label: 'Carga de Proyectos', val: projects.length, max: 20, color: 'bg-blue-400' },
                { label: 'Eficiencia de Cierre', val: stats.finalizados.length, max: projects.length || 1, color: 'bg-green-400' },
              ].map((item, i) => (
                <div key={i}>
                   <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                      <span>{item.label}</span>
                      <span className="text-slate-400">{item.val} / {item.max}</span>
                   </div>
                   <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full transition-all duration-1000", item.color)} 
                        style={{ width: `${Math.min((item.val / item.max) * 100, 100)}%` }} 
                      />
                   </div>
                </div>
              ))}
           </div>

           <div className="mt-12 p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Diferencial Proyectado</p>
              <div className="flex items-end gap-2">
                 <span className="text-3xl font-black text-white">Q 0.00</span>
                 <span className="text-[10px] font-black text-green-400 mb-1">+0.0%</span>
              </div>
           </div>
        </div>

      {/* Grafica de Rentabilidad */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-black text-primary uppercase tracking-tight">Rentabilidad por Proyecto</h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Presupuesto vs Costo Real vs Utilidad</p>
        </div>
        {rentabilidadData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin proyectos con presupuesto</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minHeight={180}>
              <BarChart data={rentabilidadData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} />
                <YAxis fontSize={9} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", fontSize: 10 }} formatter={(v: any, n: string) => [`Q ${Number(v).toLocaleString()}`, n]} />
                <Legend wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase" }} />
                <Bar dataKey="Presupuesto" fill="#94a3b8" radius={[4,4,0,0]} barSize={16} />
                <Bar dataKey="Costo" fill="#f59e0b" radius={[4,4,0,0]} barSize={16} />
                <Bar dataKey="Utilidad" fill="#10b981" radius={[4,4,0,0]} barSize={16} />
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
      </div>
    </div>
  );
}
