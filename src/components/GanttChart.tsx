import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Calendar, Clock, AlertTriangle, Edit2, Save, X,
  TrendingUp, Activity, ChevronDown, ChevronRight, DollarSign, Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { subscribeToCollection, updateDocument } from '../services/firestoreService';
import {
  GanttTask, GanttConfig, buildTasksFromItems, daysSinceStart, fmtDate, addDays
} from '../lib/ganttCPM';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
function fmtQ(n: number) { return 'Q ' + Math.round(n).toLocaleString('es-GT'); }

const EMPTY_CONFIG: GanttConfig = { overrides: {}, progress: {} };

// ── Tooltip flotante ──────────────────────────────────────────────────────────
function TaskTooltip({ task, startDate }: { task: GanttTask; startDate: string }) {
  const base = new Date(startDate);
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-white rounded-xl p-3 shadow-2xl text-[9px] pointer-events-none">
      <p className="font-black uppercase mb-2 text-amber-400 truncate">{task.name}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span className="text-slate-400">Inicio temprano</span><span className="font-bold">{fmtDate(addDays(base, task.earlyStart))}</span>
        <span className="text-slate-400">Fin temprano</span>   <span className="font-bold">{fmtDate(addDays(base, task.earlyFinish))}</span>
        <span className="text-slate-400">Inicio tardío</span>  <span className="font-bold">{fmtDate(addDays(base, task.lateStart))}</span>
        <span className="text-slate-400">Fin tardío</span>     <span className="font-bold">{fmtDate(addDays(base, task.lateFinish))}</span>
        <span className="text-slate-400">Holgura</span>        <span className={cn('font-bold', task.slack === 0 ? 'text-red-400' : 'text-green-400')}>{task.slack}d</span>
        <span className="text-slate-400">Avance</span>         <span className="font-bold text-blue-400">{task.progress}%</span>
        <span className="text-slate-400">Cuadrilla</span>      <span className="font-bold text-purple-400">{task.workers} obrero{task.workers !== 1 ? 's' : ''}</span>
        <span className="text-slate-400">Rendimiento</span>    <span className="font-bold">{task.durationPerUnit}d/{task.unit}</span>
        <span className="text-slate-400">Cantidad</span>       <span className="font-bold">{task.quantity} {task.unit}</span>
        <span className="text-slate-400">Costo</span>          <span className="font-bold text-amber-400 col-span-2">{fmtQ(task.cost)}</span>
      </div>
      {task.isCritical && <p className="mt-2 text-red-400 font-black uppercase text-center">⚠ Ruta Crítica</p>}
    </div>
  );
}

// ── Barra de una tarea ────────────────────────────────────────────────────────
function TaskBar({
  task, maxDuration, startDate, onProgressChange
}: {
  task: GanttTask;
  maxDuration: number;
  startDate: string;
  onProgressChange: (id: string, val: number) => void;
}) {
  const [hover, setHover] = useState(false);
  const barLeft  = (task.earlyStart  / maxDuration) * 100;
  const barWidth = (task.duration    / maxDuration) * 100;
  const slackW   = (task.slack       / maxDuration) * 100;
  const progW    = (task.progress / 100) * barWidth;

  return (
    <div
      className="flex-1 relative h-7"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Track */}
      <div className="absolute inset-y-1 left-0 right-0 bg-slate-100 rounded" />

      {/* Holgura (gris claro) */}
      {task.slack > 0 && (
        <div
          className="absolute inset-y-2 rounded bg-slate-300/60"
          style={{ left: `${barLeft + barWidth}%`, width: `${slackW}%` }}
        />
      )}

      {/* Barra principal */}
      <motion.div
        className={cn(
          'absolute inset-y-1 rounded',
          task.isCritical
            ? 'bg-gradient-to-r from-red-500 to-red-600'
            : 'bg-gradient-to-r from-blue-500 to-blue-600'
        )}
        style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Progreso real */}
        <div
          className="absolute inset-0 rounded bg-white/30"
          style={{ width: `${task.progress}%` }}
        />
        {barWidth > 6 && (
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white">
            {task.progress > 0 ? `${task.progress}%` : ''}
          </span>
        )}
      </motion.div>

      {/* Tooltip */}
      {hover && <TaskTooltip task={task} startDate={startDate} />}

      {/* Input de avance al hacer click */}
      {hover && (
        <input
          type="range" min={0} max={100} value={task.progress}
          onChange={e => onProgressChange(task.id, parseInt(e.target.value))}
          className="absolute bottom-0 left-0 right-0 h-1 opacity-0 hover:opacity-100 cursor-pointer"
          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
          title="Arrastrar para ajustar avance"
        />
      )}
    </div>
  );
}

type ViewMode = 'compact' | 'expanded' | 'detailed';

// ── Componente principal ──────────────────────────────────────────────────────
export default function GanttChart() {
  const [projects, setProjects]               = useState<any[]>([]);
  const [selectedId, setSelectedId]           = useState('');
  const [config, setConfig]                   = useState<GanttConfig>(EMPTY_CONFIG);
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editDuration, setEditDuration]       = useState(1);
  const [editWorkers, setEditWorkers]         = useState(1);
  const [collapsedCats, setCollapsedCats]     = useState<Set<string>>(new Set());
  const [saving, setSaving]                   = useState(false);
  const [viewMode, setViewMode]               = useState<ViewMode>('compact');
  const [showDependencies, setShowDependencies] = useState(false);
  const [showFinancialSummary, setShowFinancialSummary] = useState(false);
  const saveTimer                             = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar proyectos en ejecución
  useEffect(() => {
    return subscribeToCollection('projects', (data: any[]) => {
      const exec = data.filter(p => p.status === 'EJECUCION');
      setProjects(exec);
      // Mantener selección actual si sigue válida; si no, seleccionar el primero
      setSelectedId(prev => exec.find(p => p.id === prev) ? prev : (exec[0]?.id || ''));
    });
  }, []);

  const project = projects.find(p => p.id === selectedId);

  // Cargar ganttConfig del proyecto seleccionado
  useEffect(() => {
    if (!project) return;
    setConfig(project.ganttConfig ?? EMPTY_CONFIG);
  }, [project?.id]);

  // Aplicar vista compacta por defecto al cargar proyecto
  useEffect(() => {
    if (viewMode === 'compact') {
      // En vista compacta, colapsar todas las categorías excepto las críticas
      const criticalCats = new Set<string>();
      tasks.forEach(t => {
        if (t.isCritical) criticalCats.add(t.category);
      });
      setCollapsedCats(prev => {
        const newSet = new Set<string>();
        byCategory.forEach((_, cat) => {
          if (!criticalCats.has(cat)) newSet.add(cat);
        });
        return newSet;
      });
    } else if (viewMode === 'expanded') {
      // En expandida, mostrar todo
      setCollapsedCats(new Set());
    }
  }, [viewMode, project?.id]);

  // Guardar config en Firestore con debounce
  const persistConfig = useCallback((newConfig: GanttConfig) => {
    if (!project) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateDocument('projects', project.id, { ganttConfig: newConfig });
      } catch {
        toast.error('Error al guardar configuración');
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [project]);

  // Calcular tareas con CPM
  const tasks = useMemo<GanttTask[]>(() => {
    try {
      const items = (project?.items ?? []).filter((i: any) => i.selected);
      if (!items.length) return [];
      const safeConfig: GanttConfig = {
        overrides: config?.overrides ?? {},
        progress:  config?.progress  ?? {},
      };
      return buildTasksFromItems(items, safeConfig, project?.startDate, project?.endDate);
    } catch (e) {
      console.error('GanttCPM error:', e);
      return [];
    }
  }, [project, config]);

  const maxDuration  = tasks.length ? Math.max(...tasks.map(t => t.lateFinish)) : 1;
  const criticalPath = tasks.filter(t => t.isCritical);
  const todayLine    = project?.startDate ? (daysSinceStart(project.startDate) / maxDuration) * 100 : null;

  // Avance global ponderado por duración
  const globalProgress = useMemo(() => {
    if (!tasks.length) return 0;
    const totalDays = tasks.reduce((s, t) => s + t.duration, 0);
    const done      = tasks.reduce((s, t) => s + t.progress * t.duration, 0);
    return Math.round(done / totalDays);
  }, [tasks]);

  // Notificaciones automáticas
  useEffect(() => {
    if (!tasks.length || !project?.startDate) return;
    const today = daysSinceStart(project.startDate);
    const atRisk = tasks.filter(t =>
      t.isCritical &&
      t.earlyStart <= today &&
      t.earlyFinish > today &&
      t.progress < Math.round(((today - t.earlyStart) / t.duration) * 100) - 10
    );
    if (atRisk.length) {
      toast.warning(`${atRisk.length} tarea(s) crítica(s) con retraso`, {
        description: atRisk[0].name,
        duration: 6000,
      });
    }
  }, [tasks]);

  // Handlers
  const handleProgressChange = useCallback((id: string, val: number) => {
    const next: GanttConfig = { ...config, progress: { ...config.progress, [id]: val } };
    setConfig(next);
    persistConfig(next);
  }, [config, persistConfig]);

  const handleEditSave = useCallback(() => {
    if (!editingId) return;
    const next: GanttConfig = {
      ...config,
      overrides: {
        ...config.overrides,
        [editingId]: {
          ...(config.overrides[editingId] ?? {}),
          duration: editDuration,
          workers:  editWorkers,
        }
      }
    };
    setConfig(next);
    persistConfig(next);
    setEditingId(null);
    toast.success('Renglón actualizado');
  }, [editingId, editDuration, editWorkers, config, persistConfig]);

  const toggleCat = (cat: string) =>
    setCollapsedCats(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });

  // Exportar a PDF via print
  const handleExport = useCallback(() => {
    // Expandir todas las categorías antes de imprimir
    setCollapsedCats(new Set());
    setTimeout(() => window.print(), 300);
  }, []);

  // Agrupar por categoría
  const byCategory = useMemo(() => {
    const map = new Map<string, GanttTask[]>();
    tasks.forEach(t => {
      if (!map.has(t.category)) map.set(t.category, []);
      map.get(t.category)!.push(t);
    });
    return map;
  }, [tasks]);

  // Escala de tiempo: columnas cada N días
  const tickEvery = maxDuration <= 30 ? 5 : maxDuration <= 90 ? 10 : 20;
  const ticks = Array.from({ length: Math.ceil(maxDuration / tickEvery) + 1 }, (_, i) => i * tickEvery);

  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tight leading-none">Diagrama de Gantt</h1>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CPM · Ruta Crítica · Holguras · Avance Real</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {saving && <span className="text-[8px] font-bold text-amber-500 uppercase animate-pulse">Guardando…</span>}
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase focus:outline-none focus:border-blue-500"
          >
            {projects.length === 0
              ? <option value="">Sin proyectos en ejecución</option>
              : projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
            }
          </select>
          
          {/* Vista Compacta/Expandida/Detallada */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('compact')}
              className={cn(
                'px-2 py-1.5 rounded-md text-[10px] font-black uppercase transition-all',
                viewMode === 'compact' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
              )}
              title="Vista Compacta"
            >
              Compacta
            </button>
            <button
              onClick={() => setViewMode('expanded')}
              className={cn(
                'px-2 py-1.5 rounded-md text-[10px] font-black uppercase transition-all',
                viewMode === 'expanded' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
              )}
              title="Vista Expandida"
            >
              Ver Todo
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={cn(
                'px-2 py-1.5 rounded-md text-[10px] font-black uppercase transition-all',
                viewMode === 'detailed' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
              )}
              title="Vista Detallada"
            >
              Detalle
            </button>
          </div>
          
          {/* Mostrar/Ocultar Dependencias */}
          <button
            onClick={() => setShowDependencies(!showDependencies)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase transition-all',
              showDependencies ? 'bg-purple-100 text-purple-700 border border-purple-300' : 'bg-white border border-slate-200 text-slate-600 hover:border-purple-300'
            )}
            title="Mostrar dependencias"
          >
            <TrendingUp size={14} />
            <span className="hidden sm:inline">Rutas</span>
          </button>
          
          {/* Resumen Financiero */}
          <button
            onClick={() => setShowFinancialSummary(!showFinancialSummary)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase transition-all',
              showFinancialSummary ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-white border border-slate-200 text-slate-600 hover:border-green-300'
            )}
            title="Resumen financiero"
          >
            <DollarSign size={14} />
            <span className="hidden sm:inline">Financiero</span>
          </button>
          
          <button
            onClick={handleExport}
            disabled={tasks.length === 0}
            title="Exportar / Imprimir Gantt"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-40"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {[
          { icon: <Calendar size={13} className="text-blue-500" />,    label: 'Duración',      value: `${maxDuration}d`,          color: 'text-slate-700' },
          { icon: <AlertTriangle size={13} className="text-red-500" />, label: 'Ruta Crítica',  value: `${criticalPath.length} tareas`, color: 'text-red-600' },
          { icon: <TrendingUp size={13} className="text-green-500" />,  label: 'Avance Global', value: `${globalProgress}%`,       color: 'text-green-600' },
          { icon: <DollarSign size={13} className="text-amber-500" />,  label: 'Costo Total',   value: fmtQ(tasks.reduce((s,t)=>s+t.cost,0)), color: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">{k.icon}<span className="text-[7px] font-black text-slate-400 uppercase">{k.label}</span></div>
            <p className={cn('text-lg font-black', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Diagrama ── */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-auto">
        <div style={{ minWidth: 1100 }} className="p-4">

          {/* Escala de tiempo */}
          <div className="flex mb-3 pl-72">
            <div className="flex-1 relative h-5">
              {ticks.map(d => (
                <div
                  key={d}
                  className="absolute top-0 text-[7px] font-black text-slate-400 uppercase -translate-x-1/2"
                  style={{ left: `${(d / maxDuration) * 100}%` }}
                >
                  {project?.startDate ? fmtDate(addDays(new Date(project.startDate), d)) : `D${d}`}
                </div>
              ))}
            </div>
          </div>

          {/* Líneas de cuadrícula + línea de hoy */}
          <div className="relative">
            {/* Grid lines */}
            <div className="absolute inset-0 pl-72 pointer-events-none">
              <div className="relative h-full flex-1">
                {ticks.map(d => (
                  <div
                    key={d}
                    className="absolute top-0 bottom-0 border-l border-slate-100"
                    style={{ left: `${(d / maxDuration) * 100}%` }}
                  />
                ))}
                {/* Línea de hoy */}
                {todayLine !== null && todayLine <= 100 && (
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-amber-400 z-10"
                    style={{ left: `${todayLine}%` }}
                  >
                    <span className="absolute -top-5 -translate-x-1/2 text-[7px] font-black text-amber-500 uppercase bg-amber-50 px-1 rounded">Hoy</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tareas por categoría */}
            {Array.from(byCategory.entries()).map(([cat, catTasks]) => {
              const collapsed = collapsedCats.has(cat);
              const catCritical = catTasks.some(t => t.isCritical);
              return (
                <div key={cat} className="mb-1">
                  {/* Cabecera de categoría */}
                  <button
                    onClick={() => toggleCat(cat)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 text-left',
                      catCritical ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200'
                    )}
                  >
                    {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    <span className={cn('text-[9px] font-black uppercase tracking-widest flex-1', catCritical ? 'text-red-600' : 'text-slate-600')}>{cat}</span>
                    <span className="text-[7px] font-bold text-slate-400">{catTasks.length} renglones</span>
                  </button>

                  {/* Filas de tareas */}
                  {!collapsed && catTasks.map(task => {
                    const isEditing = editingId === task.id;
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'flex items-center gap-2 mb-1 px-2 py-1 rounded-lg border',
                          task.isCritical ? 'bg-red-50/50 border-red-100' : 'border-transparent hover:bg-slate-50'
                        )}
                      >
                        {/* Info tarea */}
                        <div className="w-64 shrink-0">
                          {isEditing ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <div className="flex items-center gap-1">
                                <span className="text-[7px] text-slate-400">Días</span>
                                <input
                                  type="number" min={1} value={editDuration}
                                  onChange={e => setEditDuration(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-14 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-blue-400"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[7px] text-slate-400">Obreros</span>
                                <input
                                  type="number" min={1} value={editWorkers}
                                  onChange={e => setEditWorkers(Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-14 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-purple-400"
                                />
                              </div>
                              <button onClick={handleEditSave} className="p-1 bg-green-500 text-white rounded hover:bg-green-600">
                                <Save size={10} />
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-1 bg-slate-200 rounded hover:bg-slate-300">
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <p className="text-[9px] font-bold text-slate-700 truncate flex-1">{task.name}</p>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <span className="text-[7px] font-bold text-slate-400">{task.duration}d · {task.workers}ob</span>
                                <button
                                  onClick={() => { setEditingId(task.id); setEditDuration(task.duration); setEditWorkers(task.workers); }}
                                  className="p-0.5 hover:bg-slate-200 rounded"
                                >
                                  <Edit2 size={10} className="text-slate-400" />
                                </button>
                              </div>
                            </div>
                          )}
                          {/* Slider de avance */}
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock size={8} className="text-slate-300 shrink-0" />
                            <input
                              type="range" min={0} max={100} value={task.progress}
                              onChange={e => handleProgressChange(task.id, parseInt(e.target.value))}
                              className="flex-1 h-1 accent-blue-500 cursor-pointer"
                              title={`Avance: ${task.progress}%`}
                            />
                            <span className="text-[7px] font-black text-blue-600 w-6 text-right">{task.progress}%</span>
                          </div>
                        </div>

                        {/* Barra Gantt */}
                        <TaskBar
                          task={task}
                          maxDuration={maxDuration}
                          startDate={project?.startDate ?? new Date().toISOString()}
                          onProgressChange={handleProgressChange}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Ruta crítica mejorada ── */}
      {criticalPath.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-600" />
              <span className="text-[9px] font-black text-red-700 uppercase tracking-wider">
                Ruta Crítica — {criticalPath.length} tareas · {maxDuration} días totales
              </span>
            </div>
            <div className="flex items-center gap-2 text-[8px]">
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-bold">
                CRÍTICO
              </span>
              <span className="text-slate-500">Las tareas en rojo no pueden sufrir retrasos</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {criticalPath.map((t, idx) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg text-[8px] font-bold uppercase shadow-sm"
              >
                {t.name.length > 25 ? t.name.substring(0, 25) + '...' : t.name}
                <span className="ml-2 opacity-75">{t.duration}d</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Resumen Físico-Financiero ── */}
      {showFinancialSummary && tasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="shrink-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 shadow-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <DollarSign size={18} className="text-green-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Resumen Físico-Financiero</h3>
                <p className="text-[9px] text-slate-400">Inversión proyectada por período</p>
              </div>
            </div>
          </div>

          {/* Cálculo de inversión por semana y mes */}
          {(() => {
            const totalCost = tasks.reduce((s, t) => s + t.cost, 0);
            const weeks = Math.ceil(maxDuration / 7);
            const months = Math.ceil(maxDuration / 30);
            
            // Calcular inversión por día basado en el costo total
            const dailyInvestment = totalCost / maxDuration;
            const weeklyInvestment = dailyInvestment * 7;
            const monthlyInvestment = dailyInvestment * 30;

            // Calcular inversión acumulada por semana
            const weeklyData = Array.from({ length: weeks }, (_, i) => {
              const weekStart = i * 7;
              const weekEnd = Math.min((i + 1) * 7, maxDuration);
              const weekTasks = tasks.filter(t =>
                t.earlyStart < weekEnd && t.earlyFinish > weekStart
              );
              const weekCost = weekTasks.reduce((s, t) => s + (t.cost * (t.progress / 100)), 0);
              const effectiveDays = Math.min(weekEnd, maxDuration) - Math.max(weekStart, 0);
              return {
                week: i + 1,
                cost: weekCost || (dailyInvestment * effectiveDays),
                tasks: weekTasks.length
              };
            });

            // Calcular inversión por mes
            const monthlyData = Array.from({ length: months }, (_, i) => {
              const monthStart = i * 30;
              const monthEnd = Math.min((i + 1) * 30, maxDuration);
              const monthTasks = tasks.filter(t =>
                t.earlyStart < monthEnd && t.earlyFinish > monthStart
              );
              const monthCost = monthTasks.reduce((s, t) => s + (t.cost * (t.progress / 100)), 0);
              const effectiveDays = Math.min(monthEnd, maxDuration) - Math.max(monthStart, 0);
              return {
                month: i + 1,
                cost: monthCost || (dailyInvestment * effectiveDays),
                tasks: monthTasks.length
              };
            });

            return (
              <div className="space-y-4">
                {/* KPIs de inversión */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-[8px] text-slate-400 uppercase font-black mb-1">Inversión Total</p>
                    <p className="text-lg font-black text-green-400">{fmtQ(totalCost)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-[8px] text-slate-400 uppercase font-black mb-1">Por Semana</p>
                    <p className="text-lg font-black text-blue-400">{fmtQ(weeklyInvestment)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-[8px] text-slate-400 uppercase font-black mb-1">Por Mes</p>
                    <p className="text-lg font-black text-purple-400">{fmtQ(monthlyInvestment)}</p>
                  </div>
                </div>

                {/* Tabla de inversión semanal */}
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <h4 className="text-[10px] font-black text-slate-300 uppercase mb-3">Inversión por Semana</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[9px]">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-2 font-black text-slate-400 uppercase">Semana</th>
                          <th className="text-right py-2 font-black text-slate-400 uppercase">Inversión</th>
                          <th className="text-center py-2 font-black text-slate-400 uppercase">Tareas</th>
                          <th className="text-right py-2 font-black text-slate-400 uppercase">Acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyData.map((w, idx) => {
                          const accumulated = weeklyData.slice(0, idx + 1).reduce((s, x) => s + x.cost, 0);
                          return (
                            <motion.tr
                              key={w.week}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.02 }}
                              className="border-b border-white/5 hover:bg-white/5"
                            >
                              <td className="py-2 font-bold text-slate-300">Semana {w.week}</td>
                              <td className="py-2 text-right font-black text-green-400">{fmtQ(w.cost)}</td>
                              <td className="py-2 text-center text-slate-400">{w.tasks}</td>
                              <td className="py-2 text-right font-bold text-blue-400">{fmtQ(accumulated)}</td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabla de inversión mensual */}
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <h4 className="text-[10px] font-black text-slate-300 uppercase mb-3">Inversión por Mes</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[9px]">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-2 font-black text-slate-400 uppercase">Mes</th>
                          <th className="text-right py-2 font-black text-slate-400 uppercase">Inversión</th>
                          <th className="text-center py-2 font-black text-slate-400 uppercase">Tareas</th>
                          <th className="text-right py-2 font-black text-slate-400 uppercase">Acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.map((m, idx) => {
                          const accumulated = monthlyData.slice(0, idx + 1).reduce((s, x) => s + x.cost, 0);
                          return (
                            <motion.tr
                              key={m.month}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="border-b border-white/5 hover:bg-white/5"
                            >
                              <td className="py-2 font-bold text-slate-300">Mes {m.month}</td>
                              <td className="py-2 text-right font-black text-purple-400">{fmtQ(m.cost)}</td>
                              <td className="py-2 text-center text-slate-400">{m.tasks}</td>
                              <td className="py-2 text-right font-bold text-blue-400">{fmtQ(accumulated)}</td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
}
