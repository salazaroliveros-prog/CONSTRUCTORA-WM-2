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
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-slate-900 text-white rounded-xl p-3 shadow-2xl text-[9px] pointer-events-none">
      <p className="font-black uppercase mb-2 text-amber-400 truncate">{task.name}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span className="text-slate-400">Inicio temprano</span><span className="font-bold">{fmtDate(addDays(base, task.earlyStart))}</span>
        <span className="text-slate-400">Fin temprano</span>   <span className="font-bold">{fmtDate(addDays(base, task.earlyFinish))}</span>
        <span className="text-slate-400">Inicio tardío</span>  <span className="font-bold">{fmtDate(addDays(base, task.lateStart))}</span>
        <span className="text-slate-400">Fin tardío</span>     <span className="font-bold">{fmtDate(addDays(base, task.lateFinish))}</span>
        <span className="text-slate-400">Holgura</span>        <span className={cn('font-bold', task.slack === 0 ? 'text-red-400' : 'text-green-400')}>{task.slack}d</span>
        <span className="text-slate-400">Avance</span>         <span className="font-bold text-blue-400">{task.progress}%</span>
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

// ── Componente principal ──────────────────────────────────────────────────────
export default function GanttChart() {
  const [projects, setProjects]               = useState<any[]>([]);
  const [selectedId, setSelectedId]           = useState('');
  const [config, setConfig]                   = useState<GanttConfig>(EMPTY_CONFIG);
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editDuration, setEditDuration]       = useState(1);
  const [collapsedCats, setCollapsedCats]     = useState<Set<string>>(new Set());
  const [saving, setSaving]                   = useState(false);
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
      // Normalizar config defensivamente antes de pasar a CPM
      const safeConfig: GanttConfig = {
        overrides: config?.overrides ?? {},
        progress:  config?.progress  ?? {},
      };
      return buildTasksFromItems(items, safeConfig);
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
      overrides: { ...config.overrides, [editingId]: { ...(config.overrides[editingId] ?? {}), duration: editDuration } }
    };
    setConfig(next);
    persistConfig(next);
    setEditingId(null);
    toast.success('Duración actualizada');
  }, [editingId, editDuration, config, persistConfig]);

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
        <div className="flex items-center gap-2">
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
                            <div className="flex items-center gap-1">
                              <input
                                type="number" min={1} value={editDuration}
                                onChange={e => setEditDuration(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-16 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-blue-400"
                              />
                              <span className="text-[8px] text-slate-400">días</span>
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
                                <span className="text-[7px] font-bold text-slate-400">{task.duration}d</span>
                                <button
                                  onClick={() => { setEditingId(task.id); setEditDuration(task.duration); }}
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

      {/* ── Ruta crítica ── */}
      {criticalPath.length > 0 && (
        <div className="shrink-0 bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={13} className="text-red-500" />
            <span className="text-[8px] font-black text-red-600 uppercase">Ruta Crítica — {criticalPath.length} tareas · {maxDuration} días totales</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {criticalPath.map(t => (
              <span key={t.id} className="px-2 py-0.5 bg-white border border-red-200 rounded text-[7px] font-bold text-red-700 uppercase">
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
