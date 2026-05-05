/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  FileText, 
  TrendingUp, 
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  AlertCircle,
  Trash2,
  Download,
  LayoutGrid,
  ListFilter,
  CheckCircle2,
  Calculator,
  Settings2,
  Calendar,
  Hammer,
  Box,
  Layers
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Typology, Project, StaffMember } from '../constants';
import ProjectWizard from './ProjectWizard';
import Modal from './ui/Modal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToCollection, deleteDocument, updateDocument, parseError, generateProjectStock } from '../services/firestoreService';
import { uploadFile } from '../services/storageService';
import { usePagination } from '../hooks/usePagination';
import { useAutoPageSize } from '../hooks/useAutoPageSize';
import { toast } from 'sonner';
import { generatePDF, generateCSV, exportToExcel, generateProjectPDF, generateProjectCSV, PDF_TEMPLATES, CSV_TEMPLATES, ExportStyle } from '../lib/exportUtils';
import Pagination from './ui/Pagination';
import { Users, MapPin, CalendarDays } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-left min-w-[120px]">
      {label && <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-[10px] font-black text-white">Q{Number(entry.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export default function ProjectsModule() {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'kanban'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typologyFilter, setTypologyFilter] = useState('ALL');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [exportPdfTemplate, setExportPdfTemplate] = useState('modern');
  const [exportCsvTemplate, setExportCsvTemplate] = useState('completo');

  // Auto page size based on view mode
  const cardPageSize = useAutoPageSize(180, 300, 4);
  const tablePageSize = useAutoPageSize(44, 260, 6);
  const pageSize = viewMode === 'table' ? tablePageSize : cardPageSize;
  const [editForm, setEditForm] = useState<Partial<Project>>({});

  useEffect(() => {
    const unsub = subscribeToCollection('staff', (data) => {
      setAllStaff(data as StaffMember[]);
    });
    return () => unsub();
  }, []);

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'EJECUCION' ? p.status === 'EJECUCION' && (p.progress || 0) < 100 : p.status === statusFilter);
    const matchesTypology = typologyFilter === 'ALL' || p.typology === typologyFilter;
    return matchesSearch && matchesStatus && matchesTypology;
  });

  const { 
    currentItems: paginatedProjects, 
    currentPage, 
    totalPages, 
    nextPage, 
    prevPage, 
    goToPage,
    startIndex,
    totalItems
  } = usePagination<Project>(filteredProjects, pageSize);

  const handleSaveEdit = () => {
    if (!selectedProject || !Object.keys(editForm).length) return;
    toast('驴Guardar cambios del proyecto?', {
      description: selectedProject.name,
      action: { label: 'Guardar', onClick: async () => {
        try { await updateDocument('projects', selectedProject.id, editForm); const updated = { ...selectedProject, ...editForm }; setSelectedProject(updated); setIsEditing(false); setEditForm({}); if (editForm.status === 'EJECUCION' && selectedProject.status !== 'EJECUCION') { const created = await generateProjectStock(updated); if (created > 0) toast.info(created + ' materiales agregados al inventario'); } toast.success('Proyecto actualizado', { description: 'Cambios guardados' }); }
        catch (error) { toast.error('Error al guardar', { description: parseError(error) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleUpdateProject = async (updates: Partial<Project>) => {
    if (!selectedProject) return;
    try {
      await updateDocument('projects', selectedProject.id, updates);
      setSelectedProject(prev => prev ? { ...prev, ...updates } : null);
      toast.success("Proyecto actualizado");
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error("Error al guardar", { description: parseError(error) });
    }
  };

  const handleUpdateProgress = async (projectId: string, newProgress: number) => {
    setUpdatingProgress(true);
    try {
      await updateDocument('projects', projectId, { progress: newProgress });
      setSelectedProject(prev => prev ? { ...prev, progress: newProgress } : null);
      toast.success("Progreso actualizado", { description: `El avance es ahora del ${newProgress}%` });
    } catch (error) {
      console.error("Error updating progress:", error);
      toast.error("Error al actualizar", { description: parseError(error) });
    } finally {
      setUpdatingProgress(false);
    }
  };

  useEffect(() => {
    const unsub = subscribeToCollection('projects', (data) => {
      setProjects(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toast("驴Confirmar eliminaci贸n?", {
      description: "Esta acci贸n no se puede deshacer.",
      action: {
        label: "Eliminar",
        onClick: async () => {
          try {
            await deleteDocument('projects', id);
            toast.success("Proyecto eliminado", { description: "Se ha eliminado del portafolio" });
          } catch (error) {
            console.error(error);
            toast.error("Error al eliminar", { description: parseError(error) });
          }
        }
      },
      cancel: { label: "Cancelar", onClick: () => {} }
    });
  };

  const handleExportCSV = () => {
    if (filteredProjects.length === 0) return;

    generateCSV({
      title: 'Reporte de Proyectos',
      projectName: 'Portafolio',
      clientName: 'General',
      headers: ['ID', 'Nombre', 'Cliente', 'Estado', 'Tipologia', 'Ubicacion', 'Fecha Inicio', 'Fecha Fin', 'Presupuesto', 'Progreso'],
      rows: filteredProjects.map(p => [
        p.id.slice(-6).toUpperCase(),
        p.name,
        p.clientName,
        p.status,
        p.typology,
        p.location || 'N/A',
        p.startDate,
        p.endDate || 'N/A',
        p.budget,
        `${p.progress}%`
      ])
    });
  };



  const ProjectCard = ({ project }: { project: any; [key: string]: any }) => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => setSelectedProject(project)}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg hover:border-secondary/50 transition-all cursor-pointer group flex flex-col h-full"
    >
      <div className="p-4 space-y-3 flex-1">
        <div className="flex justify-between items-start">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-secondary group-hover:scale-105 transition-transform duration-300">
            <Building2 size={20} />
          </div>
          <div className="flex flex-col items-end">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest",
              project.status === 'EJECUCION' ? "bg-secondary text-primary" :
              project.status === 'COTIZACION' ? "bg-blue-500 text-white" :
              "bg-green-500 text-white"
            )}>
              {project.status}
            </span>
            <span className="text-[6px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">C贸d: {project.id.slice(-6).toUpperCase()}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <h3 className="text-xs font-black text-primary uppercase tracking-tight line-clamp-1 group-hover:text-secondary transition-colors italic">{project.name}</h3>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">{project.clientName}</p>
        </div>

        <div className="pt-2 space-y-1.5 border-t border-slate-50">
          <div className="flex justify-between items-end">
            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Progreso</span>
            <div className="flex items-center gap-1">
              {project.status === 'EJECUCION' && (new Date().getTime() - new Date(project.startDate).getTime()) / (new Date(project.endDate || project.startDate).getTime() - new Date(project.startDate).getTime() || 1) > 0.1 && (project.progress || 0) < 10 && (
                 <span title="Progreso atrasado respecto al tiempo transcurrido"><AlertCircle size={10} className="text-red-500 animate-pulse" /></span>
              )}
              <span className="text-[9px] font-black text-primary">{project.progress || 0}%</span>
              <div className="w-1 h-1 rounded-full bg-secondary animate-pulse" />
            </div>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full relative">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${project.progress || 0}%` }}
              className={cn(
                "h-full rounded-full transition-all duration-1000 relative z-10",
                project.status === 'EJECUCION' ? "bg-secondary" : "bg-slate-400"
              )}
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-50 flex justify-between items-center mt-auto">
        <div className="flex flex-col">
          <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Presupuesto</span>
          <span className="text-[11px] font-black text-primary italic leading-none">Q {(project.budget || 0).toLocaleString()}</span>
        </div>
        <button 
          onClick={(e) => handleDelete(e, project.id)}
          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  );

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const stats = {
    total: projects.length,
    cotizaciones: projects.filter(p => p.status === 'COTIZACION').length,
    ejecucion: projects.filter(p => p.status === 'EJECUCION').length,
  };

  if (view === 'create') {
    return (
      <div className="space-y-12 pb-20">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setView('list')}
            className="flex items-center gap-3 text-slate-400 hover:text-slate-900 transition-all text-[10px] font-black uppercase tracking-[0.2em] group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
            Listado General de Obras
          </button>
          <div className="text-right">
            <h1 className="text-xl font-black text-primary uppercase tracking-tight italic">Wizard de Configuraci贸n</h1>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Configuraci贸n t茅cnica de proyecto</p>
          </div>
        </div>
        
        <ProjectWizard onComplete={() => setView('list')} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div id="projects-dashboard" className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-primary uppercase">Proyectos</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Control de portafolio y presupuestos</p>
        </div>
          <div className="flex w-full md:w-auto gap-2">
            <button 
              onClick={handleExportCSV}
              className="flex-1 md:flex-none border border-slate-200 bg-white text-slate-600 px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download size={18} /> Exportar
            </button>
            <button 
              onClick={() => setView('create')}
              className="flex-[2] md:flex-none bg-secondary text-primary px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20"
            >
              <Plus size={18} /> Nueva Cotizaci贸n
            </button>
          </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center md:items-start">
           <div className="p-2 bg-blue-50 text-blue-600 rounded-lg mb-2"><Building2 size={16} /></div>
           <h2 className="text-xl md:text-3xl font-black">{stats.total}</h2>
           <p className="text-[8px] md:text-[10px] text-slate-400 uppercase font-bold tracking-widest">Total</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center md:items-start">
           <div className="p-2 bg-orange-50 text-orange-600 rounded-lg mb-2"><TrendingUp size={16} /></div>
           <h2 className="text-xl md:text-3xl font-black">{stats.cotizaciones}</h2>
           <p className="text-[8px] md:text-[10px] text-slate-400 uppercase font-bold tracking-widest">Cotizaciones</p>
        </div>
        <div className="hidden md:flex bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex-col items-start">
           <div className="p-2 bg-green-50 text-green-600 rounded-lg mb-2"><Clock size={16} /></div>
           <h2 className="text-3xl font-black">{stats.ejecucion}</h2>
           <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">En Ejecuci贸n</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="relative flex-1 w-full max-w-md">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             <input 
              type="text" 
              placeholder="BUSCAR PROYECTO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-[10px] font-black uppercase focus:outline-none focus:border-secondary transition-all"
             />
           </div>
           <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
             <div className="flex bg-slate-100 p-1 rounded-xl">
               <button 
                onClick={() => setViewMode('table')}
                title="Vista de Tabla"
                className={cn("p-2 rounded-lg transition-all", viewMode === 'table' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
               >
                 <ListFilter size={18} />
               </button>
               <button 
                onClick={() => setViewMode('grid')}
                title="Vista de Cuadr铆cula"
                className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
               >
                 <LayoutGrid size={18} />
               </button>
             </div>

               <button 
                onClick={() => setViewMode('kanban')}
                title="Vista Kanban"
                className={cn("p-2 rounded-lg transition-all", viewMode === 'kanban' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
               >
                 <Layers size={18} />
               </button>
             <div className="flex flex-col gap-1 min-w-[140px]">
               <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                 <Clock size={8} /> Estado
               </span>
               <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 bg-white border border-slate-200 rounded-xl px-3 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary shadow-sm cursor-pointer"
               >
                 <option value="ALL">TODOS</option>
                 <option value="COTIZACION">COTIZACI脫N</option>
                 <option value="EJECUCION">EJECUCI脫N</option>
                 <option value="FINALIZADO">FINALIZADO</option>
               </select>
             </div>

             <div className="flex flex-col gap-1 min-w-[140px]">
               <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                 <Building2 size={8} /> Tipolog铆a
               </span>
               <select 
                value={typologyFilter}
                onChange={(e) => setTypologyFilter(e.target.value)}
                className="h-10 bg-white border border-slate-200 rounded-xl px-3 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary shadow-sm cursor-pointer"
               >
                 <option value="ALL">TODAS</option>
                 {Object.values(Typology).map(t => (
                   <option key={t} value={t}>{t}</option>
                 ))}
               </select>
             </div>
           </div>
        </div>

        {viewMode === 'table' ? (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Proyecto</th>
                  <th className="hidden md:table-cell px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">#</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedProjects.map((project, i) => (
                  <motion.tr
                    key={project.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.05 }}
                    onClick={() => setSelectedProject(project)}
                    className="group hover:bg-slate-50/10 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-primary border border-slate-200 shrink-0 group-hover:bg-slate-900 group-hover:text-secondary transition-all">
                          <Building2 size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-primary uppercase tracking-tight truncate max-w-[150px] md:max-w-none group-hover:text-secondary transition-colors">{project.name}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest truncate">C贸d: {project.id.slice(-6).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-900 uppercase truncate max-w-[150px]">{project.clientName}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{project.typology}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 min-w-[80px] md:min-w-[120px]">
                        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                          <span className={cn(
                            project.status === 'EJECUCION' ? "text-secondary" :
                            project.status === 'COTIZACION' ? "text-blue-500" :
                            "text-green-500"
                          )}>{project.status}</span>
                          <span className="text-slate-400">{project.progress || 0}%</span>
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden w-full">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${project.progress || 0}%` }}
                            className={cn(
                              "h-full rounded-full",
                              project.status === 'EJECUCION' ? "bg-slate-900" : "bg-slate-400"
                            )}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => handleDelete(e, project.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 group-hover:text-secondary group-hover:bg-slate-900 transition-all">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedProjects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06, ease: 'easeOut' }}
              >
                <ProjectCard project={project} />
              </motion.div>
            ))}
        {viewMode === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
            {[
              { id: 'COTIZACION', label: 'Cotizacion', color: 'bg-slate-100 border-slate-200', dot: 'bg-slate-400' },
              { id: 'EJECUCION', label: 'Ejecucion', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
              { id: 'FINALIZADO', label: 'Finalizado', color: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
            ].map(col => (
              <div key={col.id} className={`rounded-2xl border p-4 space-y-3 ${col.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">{col.label}</span>
                  <span className="ml-auto text-[8px] font-black bg-white rounded-full px-2 py-0.5 text-slate-500">{filteredProjects.filter(p => p.status === col.id).length}</span>
                </div>
                {filteredProjects.filter(p => p.status === col.id).map((p, ki) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: ki * 0.07 }}
                    onClick={() => setSelectedProject(p)}
                    className="bg-white rounded-xl p-3 shadow-sm border border-white hover:border-secondary cursor-pointer transition-all space-y-2"
                  >
                    <p className="text-[10px] font-black text-primary uppercase leading-tight">{p.name}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{p.clientName}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black text-secondary">Q {(p.budget || 0).toLocaleString()}</span>
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-900 rounded-full" style={{ width: `${p.progress || 0}%` }} />
                      </div>
                    </div>
                  </motion.div>
                ))}
                {filteredProjects.filter(p => p.status === col.id).length === 0 && (
                  <div className="text-center py-6 text-[8px] font-black text-slate-300 uppercase tracking-widest">Sin proyectos</div>
                )}
              </div>
            ))}
          </div>
        )}
          </div>
        )}
        
        <div className="px-6 pb-4">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onNext={nextPage}
            onPrev={prevPage}
            onPage={goToPage}
            totalItems={totalItems}
            startIndex={startIndex}
            itemsPerPage={pageSize}
            compact={true}
          />
        </div>
      </div>
        
      <Modal
        isOpen={!!selectedProject}
        onClose={() => {
          setSelectedProject(null);
          setExpandedItems([]);
        }}
        title="Detalles del Proyecto"
      >
        {selectedProject && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8 text-left"
          >
            <div className="border-b border-slate-100 pb-6 space-y-3">
              {/* Fila 1: icono + t韙ulo + bot髇 editar */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-secondary shrink-0 shadow-lg shadow-slate-900/20">
                  <Building2 size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-black text-primary uppercase tracking-tight leading-none mb-1 truncate">{selectedProject.name}</h2>
                  <p className="text-[9px] font-black text-secondary tracking-[0.2em] uppercase truncate">ID: {selectedProject.id?.toUpperCase()}</p>
                </div>
                {isEditing ? (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setIsEditing(false); setEditForm({}); }} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase">Cancelar</button>
                    <button onClick={handleSaveEdit} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase">Guardar</button>
                  </div>
                ) : (
                  <button onClick={() => { setIsEditing(true); setEditForm({ name: selectedProject.name, clientName: selectedProject.clientName, status: selectedProject.status, startDate: selectedProject.startDate, endDate: selectedProject.endDate, location: selectedProject.location }); }} className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase">
                    <Settings2 size={14} /> Editar
                  </button>
                )}
              </div>
              {/* Fila 2: controles de exportaci髇 */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Plantilla PDF</span>
                  <select value={exportPdfTemplate} onChange={e => setExportPdfTemplate(e.target.value)} className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-[8px] font-black uppercase focus:outline-none focus:border-secondary cursor-pointer">
                    {PDF_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <button onClick={() => generateProjectPDF(selectedProject, exportPdfTemplate)} className="h-8 flex items-center gap-1.5 px-3 bg-secondary text-primary rounded-lg text-[8px] font-black uppercase hover:bg-secondary/90 transition-all">
                  <Download size={12} /> PDF
                </button>
                <div className="flex flex-col gap-1">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Plantilla CSV</span>
                  <select value={exportCsvTemplate} onChange={e => setExportCsvTemplate(e.target.value)} className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-[8px] font-black uppercase focus:outline-none focus:border-secondary cursor-pointer">
                    {CSV_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <button onClick={() => generateProjectCSV(selectedProject, exportCsvTemplate)} className="h-8 flex items-center gap-1.5 px-3 bg-slate-900 text-white rounded-lg text-[8px] font-black uppercase hover:bg-slate-700 transition-all">
                  <Download size={12} /> CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {isEditing && (
                <div className="col-span-2 md:col-span-4 bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                  <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Modo Edicion</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre</label><input value={editForm.name||""} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-amber-400" /></div>
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cliente</label><input value={editForm.clientName||""} onChange={e=>setEditForm(p=>({...p,clientName:e.target.value}))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-amber-400" /></div>
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Estado</label><select value={editForm.status||""} onChange={e=>setEditForm(p=>({...p,status:e.target.value as any}))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-amber-400"><option value="COTIZACION">Cotizacion</option><option value="EJECUCION">Ejecucion</option><option value="FINALIZADO">Finalizado</option></select></div>
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ubicacion</label><input value={editForm.location||""} onChange={e=>setEditForm(p=>({...p,location:e.target.value}))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-amber-400" /></div>
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha Inicio</label><input type="date" value={editForm.startDate||""} onChange={e=>setEditForm(p=>({...p,startDate:e.target.value}))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-amber-400" /></div>
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha Fin</label><input type="date" value={editForm.endDate||""} onChange={e=>setEditForm(p=>({...p,endDate:e.target.value}))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-amber-400" /></div>
                  </div>
                </div>
              )}
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                <p className="text-xs font-black text-primary uppercase">{selectedProject.clientName}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Ubicaci贸n</p>
                <input 
                  value={selectedProject.location || ''}
                  onBlur={(e) => handleUpdateProject({ location: e.target.value })}
                  onChange={(e) => setSelectedProject({ ...selectedProject, location: e.target.value })}
                  className="w-full text-xs font-black text-primary uppercase border border-slate-200 rounded-lg p-1"
                />
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Inicio</p>
                <p className="text-xs font-black text-primary uppercase flex items-center gap-1">
                  <Calendar size={10} className="text-secondary" />
                  {selectedProject.startDate || 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Adjuntos</p>
                <input 
                  type="file"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const url = await uploadFile(file, `projects/${selectedProject.id}/${file.name}`);
                        handleUpdateProject({ attachments: [...(selectedProject.attachments || []), url] });
                        toast.success("Archivo adjunto exitosamente");
                      } catch (err) {
                        toast.error("Error al subir el archivo");
                      }
                    }
                  }}
                  className="text-[8px] text-primary"
                />
                {selectedProject.attachments && selectedProject.attachments.length > 0 && <span className="text-[8px]">{selectedProject.attachments.length} adjuntos</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Settings2 size={14} className="text-secondary" /> Breakdown de Costos
                  </h4>
                  <div className="h-64 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Materiales', value: selectedProject.items.reduce((acc, item) => acc + (item.materials?.reduce((a, m) => a + (m.price * m.quantity * (item.projectQuantity || 1)), 0) || 0), 0) },
                        { name: 'Mano de Obra', value: selectedProject.items.reduce((acc, item) => acc + (item.labor?.reduce((a, l) => a + (l.price * l.quantity * (item.projectQuantity || 1)), 0) || 0), 0) }
                      ]}>
                        <XAxis dataKey="name" fontSize={10} />
                        <YAxis fontSize={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill="#F15A24">
                          <Cell fill="#F15A24" />
                          <Cell fill="#1A1A1A" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm group">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Costo Directo</p>
                      <p className="text-sm font-black text-primary uppercase group-hover:text-secondary">Q {(selectedProject.directCosts || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Indirecto ({selectedProject.indirectCosts || 0}%)</p>
                      <p className="text-sm font-black text-slate-600 uppercase">Q {((selectedProject.directCosts || 0) * (selectedProject.indirectCosts || 0) / 100).toLocaleString()}</p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Admin ({selectedProject.administrativeCosts || 0}%)</p>
                      <p className="text-sm font-black text-slate-600 uppercase">Q {((selectedProject.directCosts || 0) * (selectedProject.administrativeCosts || 0) / 100).toLocaleString()}</p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Personal ({selectedProject.personalCosts || 0}%)</p>
                      <p className="text-sm font-black text-slate-600 uppercase">Q {((selectedProject.directCosts || 0) * (selectedProject.personalCosts || 0) / 100).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Users size={14} className="text-secondary" /> Equipo Asignado
                  </h4>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    {selectedProject.teamIds && selectedProject.teamIds.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {allStaff.filter(s => selectedProject.teamIds?.includes(s.id)).map(member => (
                          <div key={member.id} className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                            <div className="w-8 h-8 rounded-lg bg-slate-900 text-secondary flex items-center justify-center font-black text-[10px]">
                              {member.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-primary uppercase truncate">{member.name}</p>
                              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{member.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-[9px] font-bold text-slate-400 uppercase italic">Sin personal asignado espec铆ficamente</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <ListFilter size={14} className="text-secondary" /> Detalles del Presupuesto (Renglones)
                  </h4>
                  <div className="space-y-3">
                    {selectedProject.items && selectedProject.items.length > 0 ? (
                      selectedProject.items.map((item) => (
                        <div key={item.id} className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                          <button 
                            onClick={() => toggleItemExpansion(item.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500 shrink-0">
                                {item.code}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black text-primary uppercase line-clamp-1">{item.description}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.projectQuantity} {item.unit}</span>
                                  <span className="text-[8px] font-black text-secondary">Q {((item.projectQuantity || 0) * (item.durationDays || 0) * 100).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                            {expandedItems.includes(item.id) ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                          </button>

                          <AnimatePresence>
                            {expandedItems.includes(item.id) && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-slate-50 bg-slate-50/50"
                              >
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-1">
                                      <Box size={12} className="text-secondary" />
                                      <span className="text-[9px] font-black uppercase tracking-widest">Materiales</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {item.materials?.map((m, idx) => {
                                        const totalQty = m.quantity * (item.projectQuantity || 1);
                                        const totalMatPrice = m.price * totalQty;
                                        return (
                                          <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                            <div className="min-w-0">
                                              <p className="text-[9px] font-black text-primary uppercase truncate">{m.name}</p>
                                              <p className="text-[7px] font-bold text-slate-400 uppercase">{totalQty.toLocaleString(undefined, {maximumFractionDigits: 2})} {m.unit} (Total)</p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-[9px] font-black text-slate-600">Q {totalMatPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                                              <p className="text-[7px] font-bold text-slate-400">Unit: Q {m.price}</p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {(!item.materials || item.materials.length === 0) && (
                                        <p className="text-[8px] font-bold text-slate-400 uppercase italic pl-2 opacity-50">S/M</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-1">
                                      <Hammer size={12} className="text-secondary" />
                                      <span className="text-[9px] font-black uppercase tracking-widest">Mano de Obra</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {item.labor?.map((l, idx) => {
                                        const totalLabQty = l.quantity * (item.projectQuantity || 1);
                                        const totalLabPrice = l.price * totalLabQty;
                                        return (
                                          <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                            <div className="min-w-0">
                                              <p className="text-[9px] font-black text-primary uppercase truncate">{l.role}</p>
                                              <p className="text-[7px] font-bold text-slate-400 uppercase">{totalLabQty.toLocaleString(undefined, {maximumFractionDigits: 2})} {l.unit} (Total)</p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-[9px] font-black text-slate-600">Q {totalLabPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                                              <p className="text-[7px] font-bold text-slate-400">Unit: Q {l.price}</p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {(!item.labor || item.labor.length === 0) && (
                                        <p className="text-[8px] font-bold text-slate-400 uppercase italic pl-2 opacity-50">S/MO</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-3xl opacity-50">
                        <p className="text-[9px] font-bold text-slate-400 uppercase italic tracking-widest uppercase">Sin renglones definidos</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                  <TrendingUp size={14} className="text-secondary" /> Estado y Avance
                </h4>
                <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-900/40">
                   <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Presupuesto Ejecutable</p>
                   <p className="text-3xl font-black text-secondary tracking-tighter mb-6 italic">Q {(selectedProject.budget || 0).toLocaleString()}</p>
                   
                   <div className="space-y-8">
                     <div>
                       <div className="flex justify-between text-[8px] font-black uppercase tracking-widest mb-2 text-slate-400">
                         <span>Avance F铆sico Actual</span>
                         <span className="text-secondary">{selectedProject.progress || 0}%</span>
                       </div>
                       <div className="h-2 bg-slate-800 rounded-full overflow-hidden w-full mb-6 relative">
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${selectedProject.progress || 0}%` }}
                           className="h-full bg-secondary rounded-full relative z-10" 
                         />
                         <div className="absolute inset-0 bg-secondary/10 animate-pulse" style={{ width: `${selectedProject.progress || 0}%` }} />
                       </div>
                       
                       <div className="space-y-3">
                         <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Ajustar Nivel de Avance</label>
                         <input 
                           type="range"
                           min="0"
                           max="100"
                           step="1"
                           value={selectedProject.progress || 0}
                           disabled={updatingProgress}
                           onChange={(e) => handleUpdateProgress(selectedProject.id, parseInt(e.target.value))}
                           className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-secondary"
                         />
                         <div className="flex justify-between text-[7px] font-bold text-slate-600 uppercase">
                           <span>Inicio</span>
                           <span>Completado</span>
                         </div>
                       </div>
                     </div>

                     <div className="pt-6 border-t border-slate-800 space-y-4">
                       <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-slate-500 uppercase">Prioridad</span>
                         <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[7px] font-black">ALTA</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-slate-500 uppercase">Tipo Cobro</span>
                         <span className="text-[9px] font-black uppercase tracking-widest">Suma Alzada</span>
                       </div>
                     </div>
                   </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setSelectedProject(null)}
              className="w-full bg-slate-100 text-primary py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all font-bold"
            >
              Cerrar Vista Detallada
            </button>
          </motion.div>
        )}
      </Modal>
    </div>
  );
}


