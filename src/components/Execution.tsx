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
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight, 
  Filter,
  PieChart as PieIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { Project, WarehouseItem } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToCollection, addDocument, parseError } from '../services/firestoreService';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ExecutionModule() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [inventory, setInventory] = useState<WarehouseItem[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLog, setNewLog] = useState('');
  const [savingLog, setSavingLog] = useState(false);

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
      <div id="execution-header-stats" className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm text-left">
           <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
              <div className="p-1.5 md:p-2 bg-accent/10 text-accent rounded-lg"><ClipboardList size={16} /></div>
              <h4 className="text-[9px] md:text-xs font-black uppercase tracking-widest text-gray-500">Eficiencia</h4>
           </div>
           <h2 className="text-xl md:text-3xl font-black">{stats.performance}%</h2>
           <p className="text-[8px] md:text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tight">Tasa de Cierre</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm text-left">
           <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
              <div className="p-1.5 md:p-2 bg-secondary/10 text-secondary rounded-lg"><Package size={16} /></div>
              <h4 className="text-[9px] md:text-xs font-black uppercase tracking-widest text-gray-500">Alertas</h4>
           </div>
           <h2 className="text-xl md:text-3xl font-black">{stats.criticalStock}</h2>
           <p className="text-[8px] md:text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tight">Stock Crítico</p>
        </div>
        <div className="col-span-2 md:col-span-1 bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm text-left">
           <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
              <div className="p-1.5 md:p-2 bg-green-500/10 text-green-500 rounded-lg"><CheckCircle2 size={16} /></div>
              <h4 className="text-[9px] md:text-xs font-black uppercase tracking-widest text-gray-500">Actividad</h4>
           </div>
           <h2 className="text-xl md:text-3xl font-black">{stats.progress}%</h2>
           <p className="text-[8px] md:text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tight">Proyectos Iniciados</p>
        </div>
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
                                  <div className="h-full bg-secondary" style={{ width: project.status === 'FINALIZADO' ? '100%' : project.status === 'EJECUCION' ? '50%' : '0%' }} />
                                </div>
                               <span className="font-black text-[10px]">{project.status === 'FINALIZADO' ? '100%' : project.status === 'EJECUCION' ? '50%' : '0%'}</span>
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

      {/* Diagrama Gantt */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-black text-primary uppercase tracking-tight">Cronograma Gantt</h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Avance de proyectos en ejecucion</p>
        </div>
        {projects.filter(p => p.status === 'EJECUCION').length === 0 ? (
          <div className="py-10 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin proyectos en ejecucion</div>
        ) : (
          <div className="space-y-3 overflow-x-auto">
            {/* Cabecera de meses */}
            <div className="flex gap-2 pl-32 mb-1">
              {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map(m => (
                <div key={m} className="flex-1 text-center text-[7px] font-black text-slate-400 uppercase">{m}</div>
              ))}
            </div>
            {projects.filter(p => p.status === 'EJECUCION').map(p => {
              const start = p.startDate ? new Date(p.startDate).getMonth() : 0;
              const end = p.endDate ? new Date(p.endDate).getMonth() : start + 2;
              const duration = Math.max(1, end - start + 1);
              const progress = p.progress || 0;
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="w-28 shrink-0">
                    <p className="text-[8px] font-black text-primary uppercase truncate">{p.name}</p>
                    <p className="text-[7px] text-slate-400">{progress}%</p>
                  </div>
                  <div className="flex-1 flex gap-0.5 h-6">
                    {Array.from({length: 12}, (_, i) => {
                      const inRange = i >= start && i <= end;
                      const done = inRange && ((i - start) / duration * 100) <= progress;
                      return (
                        <div key={i} className={`flex-1 rounded-sm transition-all ${inRange ? (done ? 'bg-slate-900' : 'bg-slate-200') : 'bg-slate-50'}`} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
