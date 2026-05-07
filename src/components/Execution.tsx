/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  ComposedChart,
  Line,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  ClipboardList, 
  Package, 
  CheckCircle2,
  TrendingUp,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Save
} from 'lucide-react';
import { motion } from 'motion/react';
import { Project, WarehouseItem } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToCollection, addDocument, updateDocument, parseError } from '../services/firestoreService';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ExecutionModule({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [inventory, setInventory] = useState<WarehouseItem[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLog, setNewLog] = useState('');
  const [savingLog, setSavingLog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [itemProgress, setItemProgress] = useState<Record<string, number>>({});
  const [savingProgress, setSavingProgress] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubProjects = subscribeToCollection('projects', (data) => setProjects(data));
    const unsubInventory = subscribeToCollection('inventory', (data) => {
      setInventory(data);
    });
    const unsubLogs = subscribeToCollection('logs', (data) => {
      setLogs(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    });
    return () => {
      unsubProjects();
      unsubInventory();
      unsubLogs();
    };
  }, []);

  // Proyecto seleccionado para avance por renglón
  const execProjects = projects.filter(p => p.status === 'EJECUCION');
  const activeProject = execProjects.find(p => p.id === selectedProjectId) ?? execProjects[0] ?? null;

  // Cargar avances guardados en ganttConfig cuando cambia el proyecto
  useEffect(() => {
    if (!activeProject) return;
    setItemProgress(activeProject.ganttConfig?.progress ?? {});
  }, [activeProject?.id]);

  // Agrupar items por categoría
  const itemsByCategory = (() => {
    const map = new Map<string, any[]>();
    (activeProject?.items ?? []).filter((i: any) => i.selected).forEach((item: any) => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    });
    return map;
  })();

  const toggleCat = (cat: string) =>
    setCollapsedCats(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });

  const handleSaveProgress = async () => {
    if (!activeProject) return;
    setSavingProgress(true);
    try {
      // Calcular avance global ponderado por duración
      const items = (activeProject.items ?? []).filter((i: any) => i.selected);
      const totalDays = items.reduce((s: number, i: any) => s + Math.max(1, (i.projectQuantity || 1) * (i.durationDays || 1)), 0);
      const done = items.reduce((s: number, i: any) => {
        const dur = Math.max(1, (i.projectQuantity || 1) * (i.durationDays || 1));
        return s + (itemProgress[i.id] ?? 0) * dur;
      }, 0);
      const globalProgress = Math.round(done / (totalDays || 1));

      await updateDocument('projects', activeProject.id, {
        progress: globalProgress,
        ganttConfig: { ...(activeProject.ganttConfig ?? {}), progress: itemProgress }
      });
      toast.success(`Avance guardado — ${globalProgress}% global`);
    } catch {
      toast.error('Error al guardar avance');
    } finally {
      setSavingProgress(false);
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLog.trim()) return;
    setSavingLog(true);
    try {
      await addDocument('logs', {
        msg: newLog,
        createdAt: new Date().toISOString(),
        type: 'CUSTOM' // this passes the data
      });
      setNewLog('');
      toast.success("Bitácora actualizada");
    } catch (error) {
      console.error(error);
      toast.error("Error al registrar avance", { description: parseError(error) });
    } finally {
      setSavingLog(false);
    }
  };

  const { 
    currentItems: paginatedProjects, 
    currentPage, 
    totalPages, 
    nextPage, 
    prevPage, 
    goToPage,
    startIndex,
    totalItems: totalProjectsCount
  } = usePagination<Project>(projects, 10);

  const stats = {
    performance: projects.length > 0 ? (projects.filter(p => p.status === 'FINALIZADO').length / projects.length * 100).toFixed(0) : "0",
    criticalStock: inventory.filter(item => (item.stock || 0) <= (item.minStock || 0)).length,
    progress: projects.length > 0 ? (projects.filter(p => p.status === 'EJECUCION' || p.status === 'FINALIZADO').length / projects.length * 100).toFixed(0) : "0",
    totalBudget: projects.filter(p => p.status === 'EJECUCION').reduce((a, p) => a + (p.budget || 0), 0),
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div id="execution-control" className="space-y-8 pb-10">
      <div id="execution-header-stats" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Eficiencia', value: `${stats.performance}%`, sub: 'Tasa de Cierre', icon: <ClipboardList size={18} />, color: 'bg-blue-500', pulse: false },
          { label: 'Stock Crítico', value: stats.criticalStock, sub: 'Alertas Activas', icon: <Package size={18} />, color: stats.criticalStock > 0 ? 'bg-red-500' : 'bg-emerald-500', pulse: stats.criticalStock > 0 },
          { label: 'Actividad', value: `${stats.progress}%`, sub: 'Proyectos Iniciados', icon: <CheckCircle2 size={18} />, color: 'bg-green-500', pulse: false },
          { label: 'Presupuesto Activo', value: `Q. ${stats.totalBudget.toLocaleString('es-GT', { minimumFractionDigits: 0 })}`, sub: 'En Ejecución', icon: <TrendingUp size={18} />, color: 'bg-secondary', pulse: false },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left relative overflow-hidden group hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <motion.div
                animate={kpi.pulse ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className={`p-2 rounded-xl text-white shadow-lg ${kpi.color}`}
              >
                {kpi.icon}
              </motion.div>
              <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">{kpi.label}</h4>
            </div>
            <p className="text-xl font-black text-primary">{kpi.value}</p>
            <p className="text-[8px] text-slate-400 mt-0.5 uppercase font-bold tracking-tight">{kpi.sub}</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-20 transition-opacity" />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
           <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg text-left uppercase tracking-tight">Estado del Portafolio</h3>
              <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                 <div className="w-2 h-2 rounded-full bg-secondary" /> En Ejecución
              </div>
           </div>
           <div className="overflow-x-auto no-scrollbar flex-1">
              <table className="w-full text-sm text-left">
                 <thead>
                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100">
                       <th className="pb-4 px-4">Proyecto</th>
                       <th className="pb-4 px-4">Estado</th>
                       <th className="pb-4 px-4 text-right">Progreso</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {paginatedProjects.map((project) => (
                      <tr key={project.id}>
                         <td className="py-4 px-4 font-bold uppercase text-[11px] truncate max-w-[150px]">{project.name}</td>
                         <td className="py-4 px-4">
                            <span className={cn(
                               "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                               project.status === 'EJECUCION' ? "bg-secondary text-primary border-secondary" :
                               project.status === 'COTIZACION' ? "bg-blue-50 text-blue-600 border-blue-100" :
                               "bg-green-50 text-green-600 border-green-100"
                            )}>
                               {project.status}
                            </span>
                         </td>
                         <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                               <div className="w-16 md:w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${project.progress || 0}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className="h-full bg-secondary rounded-full"
                                  />
                                </div>
                               <span className="font-black text-[10px]">{project.progress || 0}%</span>
                            </div>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
              {projects.length === 0 && (
                <div className="p-20 text-center opacity-20">
                   <ClipboardList size={48} className="mx-auto mb-4" />
                   <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sin Proyectos Activos</p>
                </div>
              )}
              
              <div className="mt-4">
                 <Pagination 
                   currentPage={currentPage}
                   totalPages={totalPages}
                   onNext={nextPage}
                   onPrev={prevPage}
                   onPage={goToPage}
                   totalItems={totalProjectsCount}
                   startIndex={startIndex}
                   itemsPerPage={10}
                   compact={true}
                 />
              </div>
           </div>
        </div>

         <div className="lg:col-span-4 flex flex-col gap-6">
           <div className="bg-slate-900 rounded-2xl p-6 text-white text-left shadow-xl shadow-slate-900/10">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6 text-secondary flex justify-between items-center">
                Bitácora de Obra
                <span className="text-slate-500 font-bold tracking-normal uppercase">{logs.length} entradas</span>
              </h4>
              
              <form onSubmit={handleAddLog} className="mb-8 relative group">
                <input 
                  type="text" 
                  placeholder="REGISTRAR AVANCE..."
                  value={newLog}
                  onChange={(e) => setNewLog(e.target.value)}
                  className="w-full bg-slate-800 border-none rounded-xl pl-4 pr-12 py-3 text-[10px] font-black placeholder:text-slate-600 focus:ring-1 focus:ring-secondary transition-all uppercase"
                />
                <button 
                  type="submit"
                  disabled={savingLog || !newLog.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-secondary text-primary rounded-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
                >
                  <Plus size={14} />
                </button>
              </form>

              <div className="space-y-6 max-h-[300px] overflow-y-auto no-scrollbar pr-2">
                 {logs.map((log, i) => (
                   <div key={log.id} className="flex gap-4 group">
                      <div className="text-[8px] font-black text-slate-500 mt-1 shrink-0 uppercase">
                        {new Date(log.createdAt).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit' })}
                      </div>
                      <div className="text-[10px] font-bold text-slate-300 leading-tight uppercase group-hover:text-white transition-colors">
                        {log.msg}
                      </div>
                   </div>
                 ))}
                 {logs.length === 0 && (
                   <div className="py-10 text-center opacity-30">
                      <p className="text-[9px] font-black uppercase tracking-widest">Sin Entradas Recientes</p>
                   </div>
                 )}
              </div>
           </div>

           <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <h3 className="font-black text-lg mb-6 text-left">Control de Inventario Crítico</h3>
              <div className="overflow-x-auto no-scrollbar">
                 <table className="w-full text-sm text-left">
                    <thead>
                       <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100">
                          <th className="pb-4 px-4">Material</th>
                          <th className="pb-4 px-4 text-right">Estado</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {inventory.filter(item => (item.stock || 0) <= (item.minStock || 0)).map((item) => (
                         <tr key={item.id}>
                            <td className="py-4 px-4 text-left">
                               <p className="font-bold uppercase text-[11px] truncate max-w-[100px]">{item.name}</p>
                               <p className="text-[9px] font-black text-slate-400">{item.stock} {item.unit}</p>
                            </td>
                            <td className="py-4 px-4 text-right">
                               <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-[8px] font-black uppercase tracking-widest border border-red-200">
                                  Alerta
                               </span>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
                 {inventory.filter(item => (item.stock || 0) <= (item.minStock || 0)).length === 0 && (
                   <div className="py-10 text-center opacity-20">
                      <CheckCircle2 size={32} className="mx-auto mb-2" />
                      <p className="text-[8px] font-black uppercase tracking-widest text-center">Sin Alertas</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>

      {/* ── Avance por Renglón ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-black text-primary uppercase tracking-tight">Avance Físico por Renglón</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ingresa el % completado por cada actividad</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={activeProject?.id ?? ''}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase focus:outline-none focus:border-blue-500"
            >
              {execProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              onClick={handleSaveProgress}
              disabled={savingProgress || !activeProject}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-40"
            >
              <Save size={13} />
              {savingProgress ? 'Guardando…' : 'Guardar'}
            </button>
            {setActiveTab && (
              <button
                onClick={() => setActiveTab('gantt')}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-700 active:scale-95 transition-all"
              >
                <BarChart2 size={13} />
                Ver Gantt
              </button>
            )}
          </div>
        </div>

        {!activeProject ? (
          <div className="py-10 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">
            Sin proyectos en ejecución
          </div>
        ) : itemsByCategory.size === 0 ? (
          <div className="py-10 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">
            Este proyecto no tiene renglones de presupuesto asignados
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from(itemsByCategory.entries()).map(([cat, items]) => {
              const collapsed = collapsedCats.has(cat);
              const catAvg = Math.round(items.reduce((s, i) => s + (itemProgress[i.id] ?? 0), 0) / items.length);
              return (
                <div key={cat}>
                  <button
                    onClick={() => toggleCat(cat)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-left hover:bg-slate-100 transition-colors"
                  >
                    {collapsed ? <ChevronRight size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 flex-1">{cat}</span>
                    <span className="text-[8px] font-bold text-slate-400">{items.length} renglones</span>
                    <span className={cn('text-[9px] font-black ml-2', catAvg >= 100 ? 'text-green-600' : catAvg > 0 ? 'text-blue-600' : 'text-slate-400')}>
                      {catAvg}%
                    </span>
                  </button>

                  {!collapsed && (
                    <div className="mt-1 space-y-1 pl-2">
                      {items.map((item: any) => {
                        const val = itemProgress[item.id] ?? 0;
                        return (
                          <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 group">
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-bold text-slate-700 uppercase truncate">{item.description}</p>
                              <p className="text-[7px] font-bold text-slate-400 uppercase">{item.projectQuantity} {item.unit}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 w-48">
                              <input
                                type="range" min={0} max={100} value={val}
                                onChange={e => setItemProgress(prev => ({ ...prev, [item.id]: parseInt(e.target.value) }))}
                                className="flex-1 h-1.5 accent-blue-500 cursor-pointer"
                              />
                              <span className={cn(
                                'text-[9px] font-black w-8 text-right',
                                val >= 100 ? 'text-green-600' : val > 0 ? 'text-blue-600' : 'text-slate-400'
                              )}>
                                {val}%
                              </span>
                            </div>
                            {val >= 100 && <CheckCircle2 size={13} className="text-green-500 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
