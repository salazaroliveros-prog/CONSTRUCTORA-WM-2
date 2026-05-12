import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList, Package, CheckCircle2, TrendingUp, BarChart2,
  ChevronDown, ChevronRight, Save, Plus, Trash2, Filter,
  AlertTriangle, FileDown, Clock, User, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, WarehouseItem } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument, parseError } from '../services/firestoreService';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
function fmtQ(n: number) { return 'Q ' + Math.round(n).toLocaleString('es-GT'); }

const LOG_TYPES = [
  { id: 'AVANCE',    label: 'Avance Físico',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'PROBLEMA',  label: 'Problema',         color: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'MATERIAL',  label: 'Material',         color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'CLIMA',     label: 'Clima',            color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { id: 'SEGURIDAD', label: 'Seguridad',        color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'VISITA',    label: 'Visita/Inspección',color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'CUSTOM',    label: 'General',          color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

function logTypeStyle(type: string) {
  return LOG_TYPES.find(t => t.id === type)?.color ?? 'bg-slate-100 text-slate-600 border-slate-200';
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

export default function ExecutionModule({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const { user } = useAuth();
  const [projects, setProjects]     = useState<Project[]>([]);
  const [inventory, setInventory]   = useState<WarehouseItem[]>([]);
  const [logs, setLogs]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

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

  useEffect(() => {
    const u1 = subscribeToCollection('projects', d => setProjects(d));
    const u2 = subscribeToCollection('inventory', d => setInventory(d));
    const u3 = subscribeToCollection('logs', d => {
      setLogs(d.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    });
    return () => { u1(); u2(); u3(); };
  }, []);

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
        msg: logMsg,
        type: logType,
        projectId:   logProjectId || null,
        projectName: proj?.name || null,
        itemId:      logItemId || null,
        itemName:    item?.description || null,
        author:      user?.displayName || user?.email || 'Sistema',
        createdAt:   new Date().toISOString(),
      });
      setLogMsg('');
      toast.success('Entrada registrada en bitácora');
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
    performance:  projects.length > 0 ? Math.round(projects.filter(p => p.status === 'FINALIZADO').length / projects.length * 100) : 0,
    criticalStock: inventory.filter(i => (i.stock || 0) <= (i.minStock || 0)).length,
    totalBudget:  execProjects.reduce((a, p) => a + (p.budget || 0), 0),
    delayed:      execProjects.filter(p => {
      if (!p.startDate || !p.endDate) return false;
      const total   = new Date(p.endDate).getTime() - new Date(p.startDate).getTime();
      const elapsed = Date.now() - new Date(p.startDate).getTime();
      return (p.progress || 0) < Math.min(100, (elapsed / total) * 100) - 10;
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
    <div className="space-y-6 pb-10">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Eficiencia Cierre', value: `${stats.performance}%`, icon: <ClipboardList size={16} />, color: 'bg-blue-500', pulse: false },
          { label: 'Stock Crítico',     value: stats.criticalStock,      icon: <Package size={16} />,      color: stats.criticalStock > 0 ? 'bg-red-500' : 'bg-emerald-500', pulse: stats.criticalStock > 0 },
          { label: 'Presupuesto Activo',value: fmtQ(stats.totalBudget),  icon: <TrendingUp size={16} />,   color: 'bg-amber-500', pulse: false },
          { label: 'Con Retraso',       value: stats.delayed,            icon: <AlertTriangle size={16} />,color: stats.delayed > 0 ? 'bg-red-500' : 'bg-green-500', pulse: stats.delayed > 0 },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-2 rounded-xl text-white ${kpi.color}`}>{kpi.icon}</div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</span>
            </div>
            <p className="text-xl font-black text-primary">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Portafolio + Bitácora ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Tabla portafolio con indicador de desviación */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-sm uppercase tracking-tight">Estado del Portafolio</h3>
            <span className="text-[8px] font-bold text-slate-400 uppercase">{projects.length} proyectos</span>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-4 py-3">Proyecto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Avance / Desviación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
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
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[10px] font-black text-primary uppercase truncate max-w-[140px]">{p.name}</p>
                        <p className="text-[7px] font-bold text-slate-400 uppercase">{p.clientName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-[7px] font-black uppercase border',
                          p.status === 'EJECUCION' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          p.status === 'FINALIZADO' ? 'bg-green-50 text-green-700 border-green-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        )}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-900 rounded-full" style={{ width: `${p.progress || 0}%` }} />
                          </div>
                          <span className="text-[9px] font-black text-slate-700 w-8">{p.progress || 0}%</span>
                          {p.status === 'EJECUCION' && (
                            <span className={cn('text-[7px] font-black px-1.5 py-0.5 rounded',
                              deviation >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
          <div className="px-4 py-3 border-t border-slate-100">
            <Pagination currentPage={currentPage} totalPages={totalPages} onNext={nextPage} onPrev={prevPage}
              onPage={goToPage} totalItems={totalItems} startIndex={startIndex} itemsPerPage={8} compact />
          </div>
        </div>

        {/* Bitácora */}
        <div className="lg:col-span-5 bg-slate-900 rounded-2xl text-white flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-secondary">Bitácora de Obra</h3>
            <div className="flex items-center gap-2">
              <span className="text-[7px] text-slate-500 font-bold">{filteredLogs.length} entradas</span>
              <button type="button" onClick={() => exportLogsCSV(filteredLogs, filterProject !== 'ALL' ? (projects.find(p => p.id === filterProject)?.name ?? 'General') : 'General')}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-secondary transition-colors" title="Exportar CSV">
                <FileDown size={13} />
              </button>
            </div>
          </div>

          {/* Formulario nueva entrada */}
          <form onSubmit={handleAddLog} className="p-4 border-b border-slate-800 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select value={logType} onChange={e => setLogType(e.target.value)}
                className="bg-slate-800 border-none rounded-lg px-2 py-1.5 text-[8px] font-black uppercase text-slate-300 focus:outline-none focus:ring-1 focus:ring-secondary">
                {LOG_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <select value={logProjectId} onChange={e => { setLogProjectId(e.target.value); setLogItemId(''); }}
                className="bg-slate-800 border-none rounded-lg px-2 py-1.5 text-[8px] font-black uppercase text-slate-300 focus:outline-none focus:ring-1 focus:ring-secondary">
                <option value="">— Proyecto —</option>
                {execProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {logProjectId && (
              <select value={logItemId} onChange={e => setLogItemId(e.target.value)}
                className="w-full bg-slate-800 border-none rounded-lg px-2 py-1.5 text-[8px] font-black uppercase text-slate-300 focus:outline-none focus:ring-1 focus:ring-secondary">
                <option value="">— Renglón (opcional) —</option>
                {(projects.find(p => p.id === logProjectId)?.items ?? []).filter((i: any) => i.selected).map((i: any) => (
                  <option key={i.id} value={i.id}>{i.description}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <input value={logMsg} onChange={e => setLogMsg(e.target.value)} placeholder="Descripción del evento..."
                className="flex-1 bg-slate-800 border-none rounded-lg px-3 py-2 text-[9px] font-bold text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-secondary" />
              <button type="submit" disabled={savingLog || !logMsg.trim()}
                className="p-2 bg-secondary text-primary rounded-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-30">
                <Plus size={14} />
              </button>
            </div>
          </form>

          {/* Filtros + búsqueda */}
          <div className="px-4 py-2 border-b border-slate-800 space-y-2">
            <div className="flex gap-2">
              <select value={filterProject} onChange={e => setFilterProject(e.target.value)} title="Filtrar por proyecto"
                className="flex-1 bg-slate-800 border-none rounded-lg px-2 py-1 text-[7px] font-black uppercase text-slate-400 focus:outline-none">
                <option value="ALL">Todos los proyectos</option>
                {execProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} title="Filtrar por tipo"
                className="flex-1 bg-slate-800 border-none rounded-lg px-2 py-1 text-[7px] font-black uppercase text-slate-400 focus:outline-none">
                <option value="ALL">Todos los tipos</option>
                {LOG_TYPES.map(t => <option key={t.id} value={t.id}>{t.label} {logStats[t.id] ? `(${logStats[t.id]})` : ''}</option>)}
              </select>
            </div>
            <input value={searchLog} onChange={e => setSearchLog(e.target.value)}
              placeholder="Buscar en bitácora..." title="Buscar en bitácora"
              className="w-full bg-slate-800 border-none rounded-lg px-3 py-1.5 text-[8px] font-bold text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-secondary" />
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
                className="bg-slate-800/60 rounded-xl p-3 group hover:bg-slate-800 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('text-[6px] font-black px-1.5 py-0.5 rounded border uppercase', logTypeStyle(log.type))}>
                        {logTypeLabel(log.type)}
                      </span>
                      {log.projectName && (
                        <span className="text-[6px] font-bold text-slate-500 uppercase truncate max-w-[80px]">{log.projectName}</span>
                      )}
                      {log.itemName && (
                        <span className="text-[6px] font-bold text-slate-600 uppercase truncate max-w-[80px]">· {log.itemName}</span>
                      )}
                    </div>
                    <p className="text-[9px] font-bold text-slate-200 leading-snug">{log.msg}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[7px] text-slate-500 flex items-center gap-1">
                        <Clock size={8} />{new Date(log.createdAt).toLocaleString('es-GT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {log.author && (
                        <span className="text-[7px] text-slate-500 flex items-center gap-1">
                          <User size={8} />{log.author}
                        </span>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={() => handleDeleteLog(log.id)}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-900/50 rounded text-slate-500 hover:text-red-400 transition-all shrink-0">
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
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500" />
            <h3 className="text-[9px] font-black text-red-700 uppercase tracking-widest">
              Inventario Crítico — {inventory.filter(i => (i.stock || 0) <= (i.minStock || 0)).length} alertas
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
            {inventory.filter(i => (i.stock || 0) <= (i.minStock || 0)).slice(0, 8).map(item => (
              <div key={item.id} className="bg-red-50 border border-red-100 rounded-xl p-3">
                <p className="text-[9px] font-black text-red-800 uppercase truncate">{item.name}</p>
                <p className="text-[8px] font-bold text-red-500 mt-0.5">Stock: {item.stock} {item.unit} / Mín: {item.minStock}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Avance por Renglón ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-black text-primary uppercase tracking-tight">Avance Físico por Renglón</h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ingresa el % completado por actividad · se guarda en Gantt automáticamente</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={activeProject?.id ?? ''} onChange={e => setSelectedProjectId(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase focus:outline-none focus:border-blue-500">
              {execProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={handleSaveProgress} disabled={savingProgress || !activeProject}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-40">
              <Save size={13} />{savingProgress ? 'Guardando…' : 'Guardar'}
            </button>
            {setActiveTab && (
              <button onClick={() => setActiveTab('gantt')}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-700 active:scale-95 transition-all">
                <BarChart2 size={13} />Ver Gantt
              </button>
            )}
          </div>
        </div>

        {!activeProject ? (
          <div className="py-10 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin proyectos en ejecución</div>
        ) : itemsByCategory.size === 0 ? (
          <div className="py-10 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin renglones asignados</div>
        ) : (
          <div className="space-y-2">
            {Array.from(itemsByCategory.entries()).map(([cat, items]) => {
              const collapsed = collapsedCats.has(cat);
              const catAvg = Math.round(items.reduce((s, i) => s + (itemProgress[i.id] ?? 0), 0) / items.length);
              return (
                <div key={cat}>
                  <button onClick={() => toggleCat(cat)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-left hover:bg-slate-100 transition-colors">
                    {collapsed ? <ChevronRight size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 flex-1">{cat}</span>
                    <span className="text-[7px] font-bold text-slate-400">{items.length} renglones</span>
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden mx-2">
                      <div className={cn('h-full rounded-full', catAvg >= 100 ? 'bg-green-500' : catAvg > 0 ? 'bg-blue-500' : 'bg-slate-300')}
                        style={{ width: `${catAvg}%` }} />
                    </div>
                    <span className={cn('text-[9px] font-black w-8 text-right', catAvg >= 100 ? 'text-green-600' : catAvg > 0 ? 'text-blue-600' : 'text-slate-400')}>
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
                              <input type="range" min={0} max={100} value={val}
                                onChange={e => setItemProgress(prev => ({ ...prev, [item.id]: parseInt(e.target.value) }))}
                                className="flex-1 h-1.5 accent-blue-500 cursor-pointer" />
                              <span className={cn('text-[9px] font-black w-8 text-right',
                                val >= 100 ? 'text-green-600' : val > 0 ? 'text-blue-600' : 'text-slate-400')}>
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
