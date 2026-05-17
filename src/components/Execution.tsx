import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardList, Package, CheckCircle2, TrendingUp, BarChart2,
  ChevronDown, ChevronRight, Save, Plus, Trash2, Filter,
  AlertTriangle, FileDown, Clock, User, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, WarehouseItem } from '../constants';
import { cn } from '../utils/cn';
import { fmtQ, precise } from '../engine/precision';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { addDocument, updateDocument, deleteDocument, parseError } from '../services/firestoreService';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import { sanitizeString, sanitizeEmail } from '../utils/sanitize';
import { trackCRUD, trackEvent, trackExport } from '../utils/logger';
import { useStore } from '../store/DataStore';
import { PMath } from '../engine/precision';

const LOG_TYPES = [
  { id: 'AVANCE',    label: 'Avance Físico',   color: 'bg-[color-mix(in_srgb,var(--color-info)_15%,transparent)] text-(--color-info) border-[color-mix(in_srgb,var(--color-info)_20%,transparent)]' },
  { id: 'PROBLEMA',  label: 'Problema',         color: 'bg-[color-mix(in_srgb,var(--color-error)_15%,transparent)] text-(--color-error) border-[color-mix(in_srgb,var(--color-error)_20%,transparent)]' },
  { id: 'MATERIAL',  label: 'Material',         color: 'bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-(--color-warning) border-[color-mix(in_srgb,var(--color-warning)_20%,transparent)]' },
  { id: 'CLIMA',     label: 'Clima',            color: 'bg-[color-mix(in_srgb,var(--color-info)_15%,transparent)] text-(--color-info) border-[color-mix(in_srgb,var(--color-info)_20%,transparent)]' },
  { id: 'SEGURIDAD', label: 'Seguridad',        color: 'bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-(--color-warning) border-[color-mix(in_srgb,var(--color-warning)_20%,transparent)]' },
  { id: 'VISITA',    label: 'Visita/Inspección',color: 'bg-[color-mix(in_srgb,var(--color-secondary)_15%,transparent)] text-(--color-secondary-dark) border-[color-mix(in_srgb,var(--color-secondary)_20%,transparent)]' },
  { id: 'CUSTOM',    label: 'General',          color: 'bg-(--color-neutral-100) text-(--color-neutral-600) border-(--color-neutral-200)' },
];

function logTypeStyle(type: string) {
  return LOG_TYPES.find(t => t.id === type)?.color ?? 'bg-(--color-neutral-100) text-(--color-neutral-600) border-(--color-neutral-200)';
}
function logTypeLabel(type: string) {
  return LOG_TYPES.find(t => t.id === type)?.label ?? type;
}

// Exportar bitácora a CSV
function exportLogsCSV(logs: any[], projectName: string) {
  const headers = ['Fecha', 'Tipo', 'Proyecto', 'Renglón', 'Mensaje', 'Autor'];
  const rows = logs.map(l => [
    new Date(l.createdAt).toLocaleString('es-GT'),
    logTypeLabel(l.type || 'CUSTOM'),
    l.projectName || '',
    l.itemName || '',
    `"${(l.msg || '').replace(/"/g, '""')}"`,
    l.author || ''
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Bitacora_${projectName.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

interface ExecutionProps {
  setActiveTab?: (tab: string) => void;
}

export default function ExecutionModule({ setActiveTab }: ExecutionProps) {
   const { user } = useAuth();
   const store = useStore();

   // Bitácora form
   const [logMsg, setLogMsg]         = useState('');
   const [logType, setLogType]       = useState('AVANCE');
   const [logProjectId, setLogProjectId] = useState('');
   const [logItemId, setLogItemId]   = useState('');
   const [savingLog, setSavingLog]   = useState(false);

   // Filtros bitácora
   const [filterProject, setFilterProject] = useState('ALL');
   const [filterType, setFilterType]       = useState('ALL');
   const [searchLog, setSearchLog]         = useState('');

   // Avance por renglón
   const [selectedProjectId, setSelectedProjectId] = useState('');
   const [itemProgress, setItemProgress]   = useState<Record<string, number>>({});
   const [savingProgress, setSavingProgress] = useState(false);
   const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

   // DataStore data
   const projects = store.projects.items;
   const inventory = store.inventory.items;
   const logs = store.logs.items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
   const loading = store.projects.isLoading || store.inventory.isLoading || store.logs.isLoading;

   const execProjects = projects.filter(p => p.status === 'EJECUCION');
   const activeProject = execProjects.find(p => p.id === selectedProjectId) ?? execProjects[0] ?? null;

  useEffect(() => {
    if (!activeProject) return;
    setItemProgress(activeProject.ganttConfig?.progress ?? {});
  }, [activeProject?.id]);

  // Items del proyecto activo agrupados por categoría
  const itemsByCategory = useMemo(() => {
    const map = new Map<string, any[]>();
    (activeProject?.items ?? []).filter((i: any) => i.selected).forEach((item: any) => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    });
    return map;
  }, [activeProject]);

  const allItems = useMemo(() =>
    (activeProject?.items ?? []).filter((i: any) => i.selected),
    [activeProject]
  );

  const toggleCat = (cat: string) =>
    setCollapsedCats(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });

// Guardar avance por renglón
   const handleSaveProgress = async () => {
     if (!activeProject) return;
     setSavingProgress(true);
     try {
       const items = allItems;
       const totalDays = PMath.sum(items.map((i: any) => Math.max(1, (i.projectQuantity || 1) * (i.durationDays || 1))));
       const done = PMath.sum(items.map((i: any) => {
         const dur = Math.max(1, (i.projectQuantity || 1) * (i.durationDays || 1));
         return PMath.mul(itemProgress[i.id] || 0, dur);
       }));
       const globalProgress = Math.round(PMath.div(done, totalDays || 1));
       await updateDocument('projects', activeProject.id, {
         progress: globalProgress,
         ganttConfig: { ...(activeProject.ganttConfig ?? {}), progress: itemProgress }
       });
       toast.success(`Avance guardado — ${globalProgress}% global`);
     } catch { toast.error('Error al guardar avance'); }
     finally { setSavingProgress(false); }
   };

  // Agregar entrada de bitácora con contexto completo
const handleAddLog = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!logMsg.trim()) return;
     setSavingLog(true);
     const proj = projects.find(p => p.id === logProjectId);
     const item = allItems.find((i: any) => i.id === logItemId);
     try {
       await addDocument('logs', {
         msg: sanitizeString(logMsg),
         type: logType,
         projectId:   logProjectId || null,
         projectName: sanitizeString(proj?.name) || null,
         itemId:      logItemId || null,
         itemName:    sanitizeString(item?.description) || null,
         author:      user?.displayName || user?.email || 'Sistema',
         createdAt:   new Date().toISOString(),
       });
       setLogMsg('');
       toast.success('Entrada registrada en bitácora');
       trackCRUD('create', 'log');
     } catch (err) {
       toast.error('Error al registrar', { description: parseError(err) });
     } finally { setSavingLog(false); }
   };

  // Eliminar entrada de bitácora
  const handleDeleteLog = (id: string) => {
    toast('¿Eliminar esta entrada?', {
      action: { label: 'Eliminar', onClick: async () => {
        try { await deleteDocument('logs', id); toast.success('Entrada eliminada'); }
        catch (err) { toast.error('Error', { description: parseError(err) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  // Filtrar bitácora
  const filteredLogs = useMemo(() =>
    logs.filter(l =>
      (filterProject === 'ALL' || l.projectId === filterProject) &&
      (filterType === 'ALL' || l.type === filterType) &&
      (!searchLog || l.msg?.toLowerCase().includes(searchLog.toLowerCase()) ||
        l.projectName?.toLowerCase().includes(searchLog.toLowerCase()) ||
        l.author?.toLowerCase().includes(searchLog.toLowerCase()))
    ), [logs, filterProject, filterType, searchLog]);

  // Estadísticas por tipo
  const logStats = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(l => { map[l.type || 'CUSTOM'] = (map[l.type || 'CUSTOM'] || 0) + 1; });
    return map;
  }, [logs]);

// KPIs
   const stats = useMemo(() => ({
     performance:  projects.length > 0 ? Math.round(PMath.div(PMath.mul(projects.filter(p => p.status === 'FINALIZADO').length, 100), projects.length)) : 0,
     criticalStock: inventory.filter(i => (i.stock || 0) <= (i.minStock || 0)).length,
     totalBudget:  PMath.sum(execProjects.map(p => p.budget || 0)),
     delayed:      execProjects.filter(p => {
       if (!p.startDate || !p.endDate) return false;
       const total   = new Date(p.endDate).getTime() - new Date(p.startDate).getTime();
       const elapsed = Date.now() - new Date(p.startDate).getTime();
       return (p.progress || 0) < Math.min(100, PMath.div(PMath.mul(elapsed, 100), total)) - 10;
     }).length,
   }), [projects, inventory, execProjects]);

  const { currentItems: paginatedProjects, currentPage, totalPages, nextPage, prevPage, goToPage, startIndex, totalItems } =
    usePagination<Project>(projects, 8);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
    </div>
  );


  return (
    <div className="space-y-6 overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0))] scroll-mb-[calc(4rem+env(safe-area-inset-bottom,0))]">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Eficiencia Cierre', value: `${stats.performance}%`, icon: <ClipboardList size={16} />, color: 'bg-(--color-info)', pulse: false },
          { label: 'Stock Crítico',     value: stats.criticalStock,      icon: <Package size={16} />,      color: stats.criticalStock > 0 ? 'bg-(--color-error)' : 'bg-(--color-success)', pulse: stats.criticalStock > 0 },
          { label: 'Presupuesto Activo',value: fmtQ(stats.totalBudget),  icon: <TrendingUp size={16} />,   color: 'bg-(--color-accent)', pulse: false },
          { label: 'Con Retraso',       value: stats.delayed,            icon: <AlertTriangle size={16} />,color: stats.delayed > 0 ? 'bg-(--color-error)' : 'bg-(--color-success)', pulse: stats.delayed > 0 },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="bg-(--color-surface-solid) p-4 rounded-2xl border border-(--color-neutral-100) shadow-sm">
            <div className="flex items-center gap-2 mb-2">
               <div className={`p-2 rounded-xl text-(--color-neutral-50) ${kpi.color}`}>{kpi.icon}</div>
               <span className="text-[8px] font-black text-(--color-neutral-400) uppercase tracking-widest">{kpi.label}</span>
            </div>
            <p className="text-xl font-black text-primary">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Portafolio + Bitácora ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Tabla portafolio con indicador de desviación */}
         <div className="lg:col-span-7 bg-(--color-surface-solid) rounded-2xl border border-(--color-neutral-100) shadow-sm overflow-hidden flex flex-col">
           <div className="px-5 py-4 border-b border-(--color-neutral-100) flex items-center justify-between">
             <h3 className="font-black text-sm uppercase tracking-tight">Estado del Portafolio</h3>
             <span className="text-[8px] font-bold text-(--color-neutral-400) uppercase">{projects.length} proyectos</span>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[8px] font-black text-(--color-neutral-400) uppercase tracking-widest border-b border-(--color-neutral-100)">
                  <th className="px-4 py-3">Proyecto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Avance / Desviación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--color-neutral-50)">
                {paginatedProjects.map(p => {
                  // Calcular desviación: tiempo transcurrido vs avance físico
                  let deviation = 0;
                  if (p.startDate && p.endDate && p.status === 'EJECUCION') {
                    const total   = new Date(p.endDate).getTime() - new Date(p.startDate).getTime();
                    const elapsed = Date.now() - new Date(p.startDate).getTime();
                    const expected = Math.min(100, (elapsed / total) * 100);
                    deviation = (p.progress || 0) - expected;
                  }
                  return (
                    <tr key={p.id} className="hover:bg-(--color-neutral-50)/50 transition-colors">
                      <td className="px-4 py-3">
                             <p className="text-[10px] font-black text-primary uppercase truncate max-w-30 sm:max-w-[140px]">{p.name}</p>
                         <p className="text-[7px] font-bold text-(--color-neutral-400) uppercase">{p.clientName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-[7px] font-black uppercase border',
                          p.status === 'EJECUCION' ? 'bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] text-(--color-warning) border-[color-mix(in_srgb,var(--color-warning)_20%,transparent)]' :
                          p.status === 'FINALIZADO' ? 'bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-(--color-success) border-[color-mix(in_srgb,var(--color-success)_20%,transparent)]' :
                          'bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] text-(--color-info) border-[color-mix(in_srgb,var(--color-info)_20%,transparent)]'
                        )}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 bg-(--color-neutral-100) rounded-full overflow-hidden">
                              <div className="h-full bg-(--color-neutral-900) rounded-full progress-fill-dynamic" style={{ '--pw': `${p.progress || 0}%` } as React.CSSProperties} />
                           </div>
                           <span className="text-[9px] font-black text-(--color-neutral-700) w-8">{p.progress || 0}%</span>
                          {p.status === 'EJECUCION' && (
                             <span className={cn('text-[7px] font-black px-1.5 py-0.5 rounded',
                               deviation >= 0 ? 'bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-(--color-success)' : 'bg-[color-mix(in_srgb,var(--color-error)_15%,transparent)] text-(--color-error)'
                             )}>
                              {deviation >= 0 ? '+' : ''}{Math.round(deviation)}%
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-(--color-neutral-100)">
            <Pagination currentPage={currentPage} totalPages={totalPages} onNext={nextPage} onPrev={prevPage}
              onPage={goToPage} totalItems={totalItems} startIndex={startIndex} itemsPerPage={8} compact />
          </div>
        </div>

        {/* Bitácora */}
        <div className="lg:col-span-5 bg-(--color-neutral-900) rounded-2xl text-(--color-neutral-50) flex flex-col overflow-hidden">
           <div className="px-5 py-4 border-b border-(--color-neutral-800) flex items-center justify-between">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-(--color-secondary)">Bitácora de Obra</h3>
             <div className="flex items-center gap-2">
               <span className="text-[7px] text-(--color-neutral-500) font-bold">{filteredLogs.length} entradas</span>
              <button type="button" onClick={() => {
                 exportLogsCSV(filteredLogs, filterProject !== 'ALL' ? (projects.find(p => p.id === filterProject)?.name ?? 'General') : 'General');
                 trackExport('csv', 'bitacora');
               }}
                 className="p-1.5 hover:bg-(--color-neutral-800) rounded-lg text-(--color-neutral-400) hover:text-(--color-secondary) transition-colors" title="Exportar CSV">
                <FileDown size={13} />
              </button>
            </div>
          </div>

          {/* Formulario nueva entrada */}
          <form onSubmit={handleAddLog} className="p-4 border-b border-(--color-neutral-800) space-y-2">
             <div className="grid grid-cols-2 gap-2">
                <select title="Filtrar tipo de evento" value={logType} onChange={e => setLogType(e.target.value)}
                  className="bg-(--color-neutral-800) border-none rounded-lg px-2 py-1.5 text-[8px] font-black uppercase text-(--color-neutral-300) focus:outline-none focus:ring-1 focus:ring-(--color-secondary)">
                {LOG_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
               <select title="Filtrar proyecto" value={logProjectId} onChange={e => { setLogProjectId(e.target.value); setLogItemId(''); }}
                  className="bg-(--color-neutral-800) border-none rounded-lg px-2 py-1.5 text-[8px] font-black uppercase text-(--color-neutral-300) focus:outline-none focus:ring-1 focus:ring-(--color-secondary)">
                 <option value="">— Proyecto —</option>
                {execProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {logProjectId && (
               <select title="Seleccionar renglón" value={logItemId} onChange={e => setLogItemId(e.target.value)}
                  className="w-full bg-(--color-neutral-800) border-none rounded-lg px-2 py-1.5 text-[8px] font-black uppercase text-(--color-neutral-300) focus:outline-none focus:ring-1 focus:ring-(--color-secondary)">
                 <option value="">— Renglón (opcional) —</option>
                {(projects.find(p => p.id === logProjectId)?.items ?? []).filter((i: any) => i.selected).map((i: any) => (
                  <option key={i.id} value={i.id}>{i.description}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <input value={logMsg} onChange={e => setLogMsg(e.target.value)} placeholder="Descripción del evento..."
                 className="flex-1 bg-(--color-neutral-800) border-none rounded-lg px-3 py-2 text-[9px] font-bold text-(--color-neutral-50) placeholder:text-(--color-neutral-600) focus:outline-none focus:ring-1 focus:ring-(--color-secondary)" />
               <button type="submit" aria-label="Agregar evento" disabled={savingLog || !logMsg.trim()}
                  className="p-2 bg-(--color-secondary) text-(--color-primary) rounded-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-30">
                 <Plus size={14} />
              </button>
            </div>
          </form>

          {/* Filtros + búsqueda */}
          <div className="px-4 py-2 border-b border-(--color-neutral-800) space-y-2">
             <div className="flex gap-2">
               <select value={filterProject} onChange={e => setFilterProject(e.target.value)} title="Filtrar por proyecto"
                 className="flex-1 bg-(--color-neutral-800) border-none rounded-lg px-2 py-1 text-[7px] font-black uppercase text-(--color-neutral-400) focus:outline-none">
                <option value="ALL">Todos los proyectos</option>
                {execProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} title="Filtrar por tipo"
                 className="flex-1 bg-(--color-neutral-800) border-none rounded-lg px-2 py-1 text-[7px] font-black uppercase text-(--color-neutral-400) focus:outline-none">
                <option value="ALL">Todos los tipos</option>
                {LOG_TYPES.map(t => <option key={t.id} value={t.id}>{t.label} {logStats[t.id] ? `(${logStats[t.id]})` : ''}</option>)}
              </select>
            </div>
            <input value={searchLog} onChange={e => setSearchLog(e.target.value)}
              placeholder="Buscar en bitácora..." title="Buscar en bitácora"
               className="w-full bg-(--color-neutral-800) border-none rounded-lg px-3 py-1.5 text-[8px] font-bold text-(--color-neutral-50) placeholder:text-(--color-neutral-600) focus:outline-none focus:ring-1 focus:ring-(--color-secondary)" />
          </div>

          {/* Lista de entradas */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
            {filteredLogs.length === 0 && (
              <div className="py-8 text-center opacity-30">
                <p className="text-[8px] font-black uppercase tracking-widest">Sin entradas</p>
              </div>
            )}
            {filteredLogs.slice(0, 30).map(log => (
              <motion.div key={log.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                className="bg-(--color-neutral-800)/60 rounded-xl p-3 group hover:bg-(--color-neutral-800) transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('text-[6px] font-black px-1.5 py-0.5 rounded border uppercase', logTypeStyle(log.type))}>
                        {logTypeLabel(log.type)}
                      </span>
                      {log.projectName && (
                         <span className="text-[6px] font-bold text-(--color-neutral-500) uppercase truncate max-w-20">{log.projectName}</span>
                      )}
                      {log.itemName && (
                         <span className="text-[6px] font-bold text-(--color-neutral-600) uppercase truncate max-w-20">· {log.itemName}</span>
                      )}
                    </div>
                     <p className="text-[9px] font-bold text-(--color-neutral-200) leading-snug">{log.msg}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[7px] text-(--color-neutral-500) flex items-center gap-1">
                         <Clock size={8} />{new Date(log.createdAt).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                       </span>
                      {log.author && (
                        <span className="text-[7px] text-(--color-neutral-500) flex items-center gap-1">
                          <User size={8} />{log.author}
                        </span>
                      )}
                    </div>
                  </div>
                   <button type="button" aria-label="Eliminar evento" onClick={() => handleDeleteLog(log.id)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-(--color-error)/20 rounded text-(--color-neutral-500) hover:text-(--color-error) transition-all shrink-0">
                     <Trash2 size={11} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Inventario crítico ── */}
      {inventory.filter(i => (i.stock || 0) <= (i.minStock || 0)).length > 0 && (
         <div className="bg-(--color-surface-solid) rounded-2xl border border-[color-mix(in_srgb,var(--color-error)_20%,transparent)] shadow-sm overflow-hidden">
           <div className="px-5 py-3 bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] border-b border-[color-mix(in_srgb,var(--color-error)_15%,transparent)] flex items-center gap-2">
             <AlertTriangle size={14} className="text-(--color-error)" />
             <h3 className="text-[9px] font-black text-(--color-error) uppercase tracking-widest">
              Inventario Crítico — {inventory.filter(i => (i.stock || 0) <= (i.minStock || 0)).length} alertas
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
            {inventory.filter(i => (i.stock || 0) <= (i.minStock || 0)).slice(0, 8).map(item => (
               <div key={item.id} className="bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-error)_15%,transparent)] rounded-xl p-3">
                 <p className="text-[9px] font-black text-(--color-error) uppercase truncate">{item.name}</p>
                 <p className="text-[8px] font-bold text-(--color-error) mt-0.5">Stock: {item.stock} {item.unit} / Mín: {item.minStock}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Avance por Renglón ── */}
      <div className="bg-(--color-surface-solid) border border-(--color-neutral-200) rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-black text-primary uppercase tracking-tight">Avance Físico por Renglón</h3>
             <p className="text-[8px] font-bold text-(--color-neutral-400) uppercase tracking-widest mt-0.5">Ingresa el % completado por actividad · se guarda en Gantt automáticamente</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
              <select title="Seleccionar proyecto" value={activeProject?.id ?? ''} onChange={e => setSelectedProjectId(e.target.value)}
                 className="select">
               {execProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
             </select>
            <button onClick={handleSaveProgress} disabled={savingProgress || !activeProject}
               className="flex items-center gap-1.5 px-4 py-2 bg-(--color-neutral-900) text-(--color-neutral-50) rounded-xl text-xs font-black uppercase hover:bg-(--color-neutral-700) active:scale-95 transition-all disabled:opacity-40">
              <Save size={13} />{savingProgress ? 'Guardando…' : 'Guardar'}
            </button>
            {setActiveTab && (
              <button onClick={() => setActiveTab('gantt')}
                 className="flex items-center gap-1.5 px-4 py-2 bg-(--color-info) text-(--color-neutral-50) rounded-xl text-xs font-black uppercase hover:bg-(--color-info)/90 active:scale-95 transition-all">
                <BarChart2 size={13} />Ver Gantt
              </button>
            )}
          </div>
        </div>

        {!activeProject ? (
           <div className="py-10 text-center text-[9px] font-black text-(--color-neutral-300) uppercase tracking-widest">Sin proyectos en ejecución</div>
        ) : itemsByCategory.size === 0 ? (
           <div className="py-10 text-center text-[9px] font-black text-(--color-neutral-300) uppercase tracking-widest">Sin renglones asignados</div>
        ) : (
          <div className="space-y-2">
            {Array.from(itemsByCategory.entries()).map(([cat, items]) => {
              const collapsed = collapsedCats.has(cat);
              const catAvg = Math.round(items.reduce((s, i) => s + (itemProgress[i.id] ?? 0), 0) / items.length);
              return (
                <div key={cat}>
                  <button onClick={() => toggleCat(cat)}
                     className="w-full flex items-center gap-2 px-3 py-2 bg-(--color-neutral-50) border border-(--color-neutral-200) rounded-xl text-left hover:bg-(--color-neutral-100) transition-colors">
                     {collapsed ? <ChevronRight size={13} className="text-(--color-neutral-400)" /> : <ChevronDown size={13} className="text-(--color-neutral-400)" />}
                     <span className="text-[9px] font-black uppercase tracking-widest text-(--color-neutral-600) flex-1">{cat}</span>
                     <span className="text-[7px] font-bold text-(--color-neutral-400)">{items.length} renglones</span>
                     <div className="w-16 h-1.5 bg-(--color-neutral-200) rounded-full overflow-hidden mx-2">
                        <div className={cn('h-full rounded-full progress-fill-dynamic', catAvg >= 100 ? 'bg-(--color-success)' : catAvg > 0 ? 'bg-(--color-info)' : 'bg-(--color-neutral-300)')}
                         style={{ '--pw': `${catAvg}%` } as React.CSSProperties} />
                    </div>
                     <span className={cn('text-[9px] font-black w-8 text-right', catAvg >= 100 ? 'text-(--color-success)' : catAvg > 0 ? 'text-(--color-info)' : 'text-(--color-neutral-400)')}>
                      {catAvg}%
                    </span>
                  </button>
                  {!collapsed && (
                    <div className="mt-1 space-y-1 pl-2">
                      {items.map((item: any) => {
                        const val = itemProgress[item.id] ?? 0;
                        return (
                           <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-(--color-neutral-50) group">
                             <div className="flex-1 min-w-0">
                               <p className="text-[9px] font-bold text-(--color-neutral-700) uppercase truncate">{item.description}</p>
                               <p className="text-[7px] font-bold text-(--color-neutral-400) uppercase">{item.projectQuantity} {item.unit}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 w-48">
                               <input type="range" title="Porcentaje de avance" min={0} max={100} value={val}
                                 onChange={e => setItemProgress(prev => ({ ...prev, [item.id]: parseInt(e.target.value) }))}
                                 className="flex-1 h-1.5 accent-(--color-info) cursor-pointer" />
                               <span className={cn('text-[9px] font-black w-8 text-right',
                                 val >= 100 ? 'text-(--color-success)' : val > 0 ? 'text-(--color-info)' : 'text-(--color-neutral-400)')}>
                                {val}%
                              </span>
                            </div>
                            {val >= 100 && <CheckCircle2 size={13} className="text-(--color-success) shrink-0" />}
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


