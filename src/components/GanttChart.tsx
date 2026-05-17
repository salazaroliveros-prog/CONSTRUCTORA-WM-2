import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';
import { fmtQ } from '../utils/format';
import {
  Calendar, Clock, AlertTriangle, Edit2, Save, X,
  TrendingUp, Activity, ChevronDown, ChevronRight, DollarSign, Printer, Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { toast } from 'sonner';
import { useStore, updateDocument } from '../store/DataStore';
import {
  GanttTask, GanttConfig, buildTasksFromItems, daysSinceStart, fmtDate, addDays
} from '../lib/ganttCPM';

const EMPTY_CONFIG: GanttConfig = { overrides: {}, progress: {} };

// ── Tooltip flotante ──────────────────────────────────────────────────────────
function TaskTooltip({ task, startDate, expectedProgress }: {
  task: GanttTask;
  startDate: string;
  expectedProgress: number;
}) {
  const base = new Date(startDate);
  const gap  = task.progress - expectedProgress;
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-white rounded-xl p-3 shadow-2xl text-[9px] pointer-events-none">
      <p className="font-black uppercase mb-2 text-(--color-accent) truncate">{task.name}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span className="text-slate-400">Inicio temprano</span><span className="font-bold">{fmtDate(addDays(base, task.earlyStart))}</span>
        <span className="text-slate-400">Fin temprano</span>   <span className="font-bold">{fmtDate(addDays(base, task.earlyFinish))}</span>
        <span className="text-slate-400">Inicio tardío</span>  <span className="font-bold">{fmtDate(addDays(base, task.lateStart))}</span>
        <span className="text-slate-400">Fin tardío</span>     <span className="font-bold">{fmtDate(addDays(base, task.lateFinish))}</span>
        <span className="text-slate-400">Holgura</span>        <span className={cn('font-bold', task.slack === 0 ? 'text-(--color-error)' : 'text-(--color-success)')}>{task.slack}d</span>
        <span className="text-slate-400">Avance real</span>    <span className="font-bold text-(--color-info)">{task.progress}%</span>
        <span className="text-slate-400">Esperado hoy</span>   <span className={cn('font-bold', gap >= 0 ? 'text-(--color-success)' : 'text-(--color-error)')}>
          {expectedProgress}% ({gap >= 0 ? '+' : ''}{gap}%)
        </span>
        <span className="text-slate-400">Cuadrilla</span>      <span className="font-bold text-(--color-mod-dashboard)">{task.workers} obrero{task.workers !== 1 ? 's' : ''}</span>
        <span className="text-slate-400">Rendimiento</span>    <span className="font-bold">{task.durationPerUnit}d/{task.unit}</span>
        <span className="text-slate-400">Cantidad</span>       <span className="font-bold">{task.quantity} {task.unit}</span>
        <span className="text-slate-400">Costo</span>          <span className="font-bold text-(--color-accent) col-span-2">{fmtQ(task.cost)}</span>
      </div>
      {task.isCritical && <p className="mt-2 text-(--color-error) font-black uppercase text-center">⚠ Ruta Crítica</p>}
    </div>
  );
}

// ── Barra de una tarea con drag & drop, redimension y baseline ────────────────
const TaskBar = React.memo(function TaskBar({
  task, maxDuration, startDate, onProgressChange, onStartDrag, onResize,
  chartRef
}: {
  task: GanttTask;
  maxDuration: number;
  startDate: string;
  onProgressChange: (id: string, val: number) => void;
  onStartDrag: (id: string, e: React.PointerEvent) => void;
  onResize: (id: string, edge: 'left' | 'right', e: React.PointerEvent) => void;
  chartRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [hover, setHover] = useState(false);
  const base     = new Date(startDate);
  const barLeft  = (task.earlyStart / maxDuration) * 100;
  const barWidth = (task.duration   / maxDuration) * 100;
  const slackW   = (task.slack      / maxDuration) * 100;

  const dateStart = fmtDate(addDays(base, task.earlyStart));
  const dateEnd   = fmtDate(addDays(base, task.earlyFinish));

  // Avance esperado a hoy (0-100) dentro de la barra
  const todayDay = Math.max(0, Math.round((Date.now() - base.getTime()) / 86400000));
  const expectedProgress = (() => {
    if (todayDay <= task.earlyStart) return 0;
    if (todayDay >= task.earlyFinish) return 100;
    return Math.round(((todayDay - task.earlyStart) / task.duration) * 100);
  })();

  const expectedLineLeft = barLeft + (expectedProgress / 100) * barWidth;
  const showExpectedLine = expectedProgress > 0 && expectedProgress < 100 && task.progress !== 100;

  return (
    <div
      className="flex-1 relative h-9 select-none"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Track */}
      <div className="absolute inset-y-1 left-0 right-0 bg-slate-100 rounded" />

      {/* Holgura */}
      {task.slack > 0 && (
        <div
          className="absolute rounded bg-slate-300/60 border border-dashed border-slate-400/40"
          style={{ left: `${barLeft + barWidth}%`, width: `${slackW}%`, top: '25%', bottom: '25%' }}
        />
      )}

      {/* Baseline bar (original plan — ghost bar behind) */}
      <div
        className="absolute rounded bg-slate-300/30 border border-dashed border-slate-400/30"
        style={{ left: `${barLeft}%`, width: `${barWidth}%`, top: '60%', bottom: '5%' }}
        title="Plan original"
      />

      {/* Barra principal (draggable) */}
      <motion.div
        className={cn(
          'absolute rounded overflow-hidden cursor-grab active:cursor-grabbing z-10',
          task.isCritical
            ? 'bg-linear-to-r from-(--color-error-bg) to-red-600'
            : task.progress === 100
              ? 'bg-linear-to-r from-emerald-500 to-emerald-600'
              : 'bg-linear-to-r from-blue-500 to-blue-600'
        )}
        style={{ left: `${barLeft}%`, width: `${barWidth}%`, top: '18%', bottom: '35%' }}
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        onPointerDown={e => { e.stopPropagation(); onStartDrag(task.id, e); }}
      >
        {/* Progreso real */}
        <div
          className="absolute inset-0 bg-white/25"
          style={{ width: `${task.progress}%` }}
        />
        {barWidth > 5 && (
          <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white drop-shadow">
            {task.progress > 0 ? `${task.progress}%` : ''}
          </span>
        )}

        {/* Resize handle — izquierda */}
        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 transition-colors rounded-l"
          onPointerDown={e => { e.stopPropagation(); onResize(task.id, 'left', e); }}
        />

        {/* Resize handle — derecha */}
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 transition-colors rounded-r"
          onPointerDown={e => { e.stopPropagation(); onResize(task.id, 'right', e); }}
        />
      </motion.div>

      {/* Línea de avance esperado */}
      {showExpectedLine && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{ left: `${expectedLineLeft}%`, top: '4%', bottom: '4%', width: 2 }}
        >
          <div className="w-full h-full border-l-2 border-dashed border-white/90 drop-shadow" />
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap" style={{ fontSize: 6 }}>
            <span className={cn(
              'px-1 py-0.5 rounded font-black text-white',
              task.progress >= expectedProgress ? 'bg-(--color-success)' : 'bg-(--color-error)'
            )}>
              {task.progress >= expectedProgress ? '+' : '-'}{Math.abs(task.progress - expectedProgress)}%
            </span>
          </div>
        </div>
      )}

      {/* Fecha inicio */}
      <span className="absolute text-[6px] font-bold text-slate-500 whitespace-nowrap"
        style={{ left: `${barLeft}%`, top: 0, transform: 'translateX(-100%) translateX(-2px)' }}>
        {dateStart}
      </span>

      {/* Fecha fin */}
      <span className="absolute text-[6px] font-bold text-slate-500 whitespace-nowrap"
        style={{ left: `${barLeft + barWidth}%`, bottom: 0, transform: 'translateX(2px)' }}>
        {dateEnd}
      </span>

      {/* Tooltip */}
      {hover && <TaskTooltip task={task} startDate={startDate} expectedProgress={expectedProgress} />}

      {/* Slider de avance */}
      {hover && (
        <input
          type="range" min={0} max={100} value={task.progress}
          onChange={e => onProgressChange(task.id, parseInt(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer z-20"
          style={{ left: `${barLeft}%`, width: `${barWidth}%`, top: '18%', bottom: '35%' }}
          title={`Avance: ${task.progress}%`}
        />
      )}
     </div>
    );
});

// ── Modo de vista y estado de tarea ───────────────────────────────────────────
type ViewMode = 'compact' | 'expanded' | 'detailed';
type TaskStatus = 'done' | 'on-track' | 'at-risk' | 'delayed' | 'pending';

function calcTaskStatus(task: GanttTask, todayDay: number): TaskStatus {
  if (task.progress === 100) return 'done';
  // Tarea que aún no ha comenzado
  if (todayDay < task.earlyStart) return 'pending';
  // Tarea que ya debió terminar pero no está al 100%
  if (todayDay >= task.earlyFinish) return 'delayed';
  // Avance esperado a hoy
  const elapsed   = todayDay - task.earlyStart;
  const expected  = Math.round((elapsed / task.duration) * 100);
  const gap       = expected - task.progress;
  if (gap <= 5)  return 'on-track';
  if (gap <= 20) return 'at-risk';
  return 'delayed';
}

const STATUS_CFG: Record<TaskStatus, { dot: string; label: string; badge: string }> = {
  done:     { dot: 'bg-(--color-success)', label: 'Completada', badge: 'bg-(--color-success-bg) text-(--color-success)' },
  'on-track': { dot: 'bg-(--color-info)',   label: 'Al día',    badge: 'bg-(--color-info-bg) text-(--color-info)'     },
  'at-risk':  { dot: 'bg-(--color-accent)',  label: 'En riesgo', badge: 'bg-(--color-warning-bg) text-(--color-warning)'   },
  delayed:  { dot: 'bg-(--color-error)',    label: 'Retrasada', badge: 'bg-(--color-error-bg) text-(--color-error)'       },
  pending:  { dot: 'bg-slate-300',  label: 'Pendiente', badge: 'bg-slate-100 text-slate-500'   },
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function GanttChart() {
  const [selectedId, setSelectedId]           = useState('');
  const [config, setConfig]                   = useState<GanttConfig>(EMPTY_CONFIG);
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editDuration, setEditDuration]       = useState(1);
  const [editWorkers, setEditWorkers]         = useState(1);
  const [editDeps, setEditDeps]               = useState<string[]>([]);
  const [collapsedCats, setCollapsedCats]     = useState<Set<string>>(new Set());
  const [saving, setSaving]                   = useState(false);
  const [viewMode, setViewMode]               = useState<ViewMode>('compact');
  const [showDependencies, setShowDependencies] = useState(false);
  const [showFinancialSummary, setShowFinancialSummary] = useState(false);
  const [financialViewMode, setFinancialViewMode] = useState<'tables' | 'charts'>('tables');
  const [showSlackTable, setShowSlackTable]       = useState(false);
  const [zoomLevel, setZoomLevel]                 = useState(1);
  const [dragTaskId, setDragTaskId]               = useState<string | null>(null);
  const [dragType, setDragType]                   = useState<'move' | 'resize-left' | 'resize-right' | null>(null);
  const chartRef                                  = useRef<HTMLDivElement>(null);
  const saveTimer                                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  const store = useStore();
  const projects = store.projects.items.filter((p: any) => p.status === 'EJECUCION');

  // Mantener selección actual si sigue válida; si no, seleccionar el primero
  useEffect(() => {
    if (projects.length > 0 && !projects.some(p => p.id === selectedId)) {
      setSelectedId(projects[0].id as string);
    } else if (projects.length === 0 && selectedId !== '') {
      setSelectedId('');
    }
  });

  const project = projects.find(p => p.id === selectedId);

  // Cargar ganttConfig del proyecto seleccionado
  useEffect(() => {
    if (!project) return;
    setConfig({ overrides: {}, progress: {}, ...(project.ganttConfig ?? {}) });
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
  const todayDay     = project?.startDate ? daysSinceStart(project.startDate) : 0;
  const todayLine    = project?.startDate ? (todayDay / maxDuration) * 100 : null;

  // Pointer event tracking for drag/resize
  const dragStartX = useRef(0);
  const dragStartVal = useRef(0);

  // Handle pointer move for drag/resize
  useEffect(() => {
    if (!dragTaskId || !dragType || !chartRef.current) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!chartRef.current) return;
      const chart = chartRef.current;
      const maxW = maxDuration;
      const pxPerDay = (chart.scrollWidth) / maxW;
      const deltaDays = Math.round((e.clientX - dragStartX.current) / pxPerDay);
      const newVal = Math.max(0, dragStartVal.current + deltaDays);

      setConfig(prev => {
        const overrides = { ...prev.overrides };
        const taskOver = { ...(overrides[dragTaskId] || {}) };

        if (dragType === 'move') {
          taskOver.startOffset = newVal;
          taskOver.startOverridden = true;
        } else if (dragType === 'resize-right') {
          taskOver.duration = Math.max(1, newVal);
          taskOver.durationOverridden = true;
        } else if (dragType === 'resize-left') {
          taskOver.startOffset = Math.max(0, dragStartVal.current - newVal);
          taskOver.duration = Math.max(1, newVal);
          taskOver.startOverridden = true;
          taskOver.durationOverridden = true;
        }

        overrides[dragTaskId] = taskOver;
        return { ...prev, overrides };
      });
    };

    const onPointerUp = () => {
      setDragTaskId(null);
      setDragType(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragTaskId, dragType, maxDuration]);

  const handleStartDrag = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    setDragTaskId(id);
    setDragType('move');
    dragStartX.current = e.clientX;
    const task = tasks.find(t => t.id === id);
    dragStartVal.current = task ? task.earlyStart : 0;
  };

  const handleResize = (id: string, edge: 'left' | 'right', e: React.PointerEvent) => {
    e.preventDefault();
    setDragTaskId(id);
    setDragType(edge === 'left' ? 'resize-left' : 'resize-right');
    dragStartX.current = e.clientX;
    const task = tasks.find(t => t.id === id);
    if (edge === 'right') {
      dragStartVal.current = task ? task.duration : 1;
    } else {
      dragStartVal.current = task ? task.earlyStart : 0;
    }
  };

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
    const atRisk = tasks.filter(t => {
      const st = calcTaskStatus(t, todayDay);
      return st === 'delayed' || st === 'at-risk';
    });
    if (atRisk.length) {
      toast.warning(`${atRisk.length} tarea(s) con retraso o en riesgo`, {
        description: atRisk[0].name,
        duration: 6000,
      });
    }
  }, [tasks, todayDay]);

  // Handlers
  const handleProgressChange = useCallback((id: string, val: number) => {
    const next: GanttConfig = { ...config, progress: { ...(config.progress ?? {}), [id]: val } };
    setConfig(next);
    persistConfig(next);
  }, [config, persistConfig]);

  const handleEditSave = useCallback(() => {
    if (!editingId) return;
    const next: GanttConfig = {
      ...config,
      overrides: {
        ...(config.overrides ?? {}),
        [editingId]: {
          ...(config.overrides?.[editingId] ?? {}),
          duration:     editDuration,
          workers:      editWorkers,
          dependencies: editDeps,
        }
      }
    };
    setConfig(next);
    persistConfig(next);
    setEditingId(null);
    toast.success('Renglón actualizado');
  }, [editingId, editDuration, editWorkers, editDeps, config, persistConfig]);

  const toggleCat = (cat: string) =>
    setCollapsedCats(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });

  // Resetear overrides de una tarea (volver a valores del presupuesto)
  const handleResetOverride = useCallback((id: string) => {
    const next: GanttConfig = {
      ...config,
      overrides: Object.fromEntries(
        Object.entries(config.overrides ?? {}).filter(([k]) => k !== id)
      ),
    };
    setConfig(next);
    persistConfig(next);
    toast.success('Renglón restaurado a valores originales');
  }, [config, persistConfig]);

  // Fecha fin real del proyecto (lateFinish máximo)
  const projectEndReal = useMemo(() => {
    if (!tasks.length || !project?.startDate) return null;
    const base = new Date(project.startDate);
    return fmtDate(addDays(base, maxDuration));
  }, [tasks, project, maxDuration]);

  // Exportar PDF profesional con jsPDF
  const handleExport = useCallback(() => {
    if (!tasks.length || !project) return;
    const base   = project.startDate ? new Date(project.startDate) : new Date();
    const totalCost = tasks.reduce((s, t) => s + t.cost, 0);
    const dailyInv  = totalCost / Math.max(maxDuration, 1);
    const weeks     = Math.ceil(maxDuration / 7);
    const months    = Math.ceil(maxDuration / 30);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();

    // ── Portada / encabezado ──────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DIAGRAMA DE GANTT — RUTA CRÍTICA CPM', W / 2, 10, { align: 'center' });
    doc.setTextColor(200, 210, 230);
    doc.setFontSize(8);
    doc.text(`Proyecto: ${project.name}`, W / 2, 16, { align: 'center' });
    doc.text(`Generado: ${new Date().toLocaleDateString('es-GT')}   |   Duración: ${maxDuration} días   |   Costo Total: ${fmtQ(totalCost)}`, W / 2, 20, { align: 'center' });

    let y = 28;

    // ── KPIs resumen ─────────────────────────────────────────────────────────
    const kpis = [
      ['Duración Total', `${maxDuration} días`],
      ['Tareas Ruta Crítica', `${criticalPath.length}`],
      ['Avance Global', `${globalProgress}%`],
      ['Costo Total', fmtQ(totalCost)],
      ['Inicio', project.startDate ? new Date(project.startDate).toLocaleDateString('es-GT') : '—'],
      ['Fin Estimado', fmtDate(addDays(base, maxDuration))],
    ];
    autoTable(doc, {
      startY: y,
      head: [['Indicador', 'Valor', 'Indicador', 'Valor', 'Indicador', 'Valor']],
      body: [[kpis[0][0], kpis[0][1], kpis[1][0], kpis[1][1], kpis[2][0], kpis[2][1]],
             [kpis[3][0], kpis[3][1], kpis[4][0], kpis[4][1], kpis[5][0], kpis[5][1]]],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [245, 158, 11], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, fontStyle: 'bold' },
      columnStyles: {
        0: { textColor: [100, 116, 139], fontStyle: 'normal' },
        2: { textColor: [100, 116, 139], fontStyle: 'normal' },
        4: { textColor: [100, 116, 139], fontStyle: 'normal' },
      },
      margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // ── Tabla principal de tareas ─────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('CRONOGRAMA DE ACTIVIDADES', 10, y);
    y += 3;

    const taskRows = tasks.map(t => {
      const exp = (() => {
        if (todayDay <= t.earlyStart) return 0;
        if (todayDay >= t.earlyFinish) return 100;
        return Math.round(((todayDay - t.earlyStart) / t.duration) * 100);
      })();
      const diff = t.progress - exp;
      const st   = calcTaskStatus(t, todayDay);
      return [
        t.isCritical ? '⚠ ' + t.name : t.name,
        t.category,
        `${t.duration}d`,
        fmtDate(addDays(base, t.earlyStart)),
        fmtDate(addDays(base, t.earlyFinish)),
        fmtDate(addDays(base, t.lateStart)),
        fmtDate(addDays(base, t.lateFinish)),
        t.slack === 0 ? '0 ⚠' : `${t.slack}d`,
        `${t.progress}%`,
        exp > 0 ? `${exp}%` : '—',
        exp > 0 ? (diff >= 0 ? `+${diff}%` : `${diff}%`) : '—',
        STATUS_CFG[st].label,
        `${t.workers}`,
        fmtQ(t.cost),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Actividad', 'Cat.', 'Dur.', 'Inicio T.', 'Fin T.', 'Inicio L.', 'Fin L.', 'Holgura', 'Avance', 'Esperado', 'Dif.', 'Estado', 'Ob.', 'Costo (Q)']],
      body: taskRows,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 6.5, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 6 },
      columnStyles: {
        0: { cellWidth: 44 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 9,  halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 12, halign: 'center' },
        8: { cellWidth: 11, halign: 'center' },
        9: { cellWidth: 11, halign: 'center' },
        10: { cellWidth: 11, halign: 'center' },
        11: { cellWidth: 16, halign: 'center' },
        12: { cellWidth: 9,  halign: 'center' },
        13: { cellWidth: 20, halign: 'right'  },
      },
      didParseCell: (data: any) => {
        const task = tasks[data.row.index];
        if (task?.isCritical && data.section === 'body') {
          data.cell.styles.fillColor = [255, 235, 235];
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        }
        // Holgura 0 en rojo
        if (data.column.index === 7 && data.section === 'body' && data.cell.raw?.toString().startsWith('0')) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
        // Diferencia: verde si positivo, rojo si negativo
        if (data.column.index === 10 && data.section === 'body') {
          const val = data.cell.raw?.toString() ?? '';
          if (val.startsWith('+')) data.cell.styles.textColor = [5, 150, 105];
          else if (val.startsWith('-')) data.cell.styles.textColor = [220, 38, 38];
        }
        // Estado: color por tipo
        if (data.column.index === 11 && data.section === 'body') {
          const val = data.cell.raw?.toString() ?? '';
          if (val === 'Retrasada')  data.cell.styles.textColor = [220, 38, 38];
          if (val === 'En riesgo')  data.cell.styles.textColor = [180, 120, 0];
          if (val === 'Completada') data.cell.styles.textColor = [5, 150, 105];
          if (val === 'Al día')    data.cell.styles.textColor = [37, 99, 235];
        }
      },
      margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Ruta crítica ──────────────────────────────────────────────────────────
    if (criticalPath.length > 0) {
      if (y > 170) { doc.addPage(); y = 15; }
      doc.setFontSize(9);
      doc.setTextColor(185, 28, 28);
      doc.setFont('helvetica', 'bold');
      doc.text('RUTA CRÍTICA — TAREAS SIN HOLGURA', 10, y);
      y += 3;
      autoTable(doc, {
        startY: y,
        head: [['#', 'Actividad', 'Duración', 'Inicio Temprano', 'Fin Temprano', 'Costo (Q)']],
        body: criticalPath.map((t, i) => [
          i + 1,
          t.name,
          `${t.duration} días`,
          fmtDate(addDays(base, t.earlyStart)),
          fmtDate(addDays(base, t.earlyFinish)),
          `Q ${Math.round(t.cost).toLocaleString('es-GT')}`,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [185, 28, 28], textColor: 255, fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5, fillColor: [255, 245, 245] },
        margin: { left: 10, right: 10 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Inversión semanal ─────────────────────────────────────────────────────
    if (y > 160) { doc.addPage(); y = 15; }
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('INVERSIÓN PROYECTADA POR SEMANA', 10, y);
    y += 3;
    const weeklyRows = Array.from({ length: weeks }, (_, i) => {
      const ws = i * 7, we = Math.min((i + 1) * 7, maxDuration);
      const wt = tasks.filter(t => t.earlyStart < we && t.earlyFinish > ws);
      const wc = wt.reduce((s, t) => s + (t.cost / t.duration) * (Math.min(we, t.earlyFinish) - Math.max(ws, t.earlyStart)), 0);
      const acc = Array.from({ length: i + 1 }, (_, j) => {
        const js = j * 7, je = Math.min((j + 1) * 7, maxDuration);
        const jt = tasks.filter(t => t.earlyStart < je && t.earlyFinish > js);
        return jt.reduce((s, t) => s + (t.cost / t.duration) * (Math.min(je, t.earlyFinish) - Math.max(js, t.earlyStart)), 0);
      }).reduce((a, b) => a + b, 0);
      return [
        `Semana ${i + 1}`,
        project.startDate ? fmtDate(addDays(base, ws)) : `Día ${ws}`,
        project.startDate ? fmtDate(addDays(base, Math.min(we, maxDuration))) : `Día ${we}`,
        wt.length,
        `Q ${Math.round(wc).toLocaleString('es-GT')}`,
        `Q ${Math.round(acc).toLocaleString('es-GT')}`,
        `${Math.round((acc / totalCost) * 100)}%`,
      ];
    });
    autoTable(doc, {
      startY: y,
      head: [['Semana', 'Inicio', 'Fin', 'Tareas', 'Inversión', 'Acumulado', '% Avance $']],
      body: weeklyRows,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'center' },
      },
      margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ── Inversión mensual ─────────────────────────────────────────────────────
    if (months > 1) {
      if (y > 160) { doc.addPage(); y = 15; }
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('INVERSIÓN PROYECTADA POR MES', 10, y);
      y += 3;
      const monthlyRows = Array.from({ length: months }, (_, i) => {
        const ms = i * 30, me = Math.min((i + 1) * 30, maxDuration);
        const mt = tasks.filter(t => t.earlyStart < me && t.earlyFinish > ms);
        const mc = mt.reduce((s, t) => s + (t.cost / t.duration) * (Math.min(me, t.earlyFinish) - Math.max(ms, t.earlyStart)), 0);
        const acc = Array.from({ length: i + 1 }, (_, j) => {
          const js = j * 30, je = Math.min((j + 1) * 30, maxDuration);
          const jt = tasks.filter(t => t.earlyStart < je && t.earlyFinish > js);
          return jt.reduce((s, t) => s + (t.cost / t.duration) * (Math.min(je, t.earlyFinish) - Math.max(js, t.earlyStart)), 0);
        }).reduce((a, b) => a + b, 0);
        return [
          `Mes ${i + 1}`,
          project.startDate ? fmtDate(addDays(base, ms)) : `Día ${ms}`,
          project.startDate ? fmtDate(addDays(base, Math.min(me, maxDuration))) : `Día ${me}`,
          mt.length,
          `Q ${Math.round(mc).toLocaleString('es-GT')}`,
          `Q ${Math.round(acc).toLocaleString('es-GT')}`,
          `${Math.round((acc / totalCost) * 100)}%`,
        ];
      });
      autoTable(doc, {
        startY: y,
        head: [['Mes', 'Inicio', 'Fin', 'Tareas', 'Inversión', 'Acumulado', '% Avance $']],
        body: monthlyRows,
        theme: 'striped',
        headStyles: { fillColor: [109, 40, 217], textColor: 255, fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold' },
          6: { halign: 'center' },
        },
        margin: { left: 10, right: 10 },
      });
    }

    // ── Pie de página en todas las páginas ────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(15, 23, 42);
      doc.rect(0, doc.internal.pageSize.getHeight() - 8, W, 8, 'F');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`ERP Constructora WM · ${project.name} · Página ${p} de ${totalPages}`, W / 2, doc.internal.pageSize.getHeight() - 2.5, { align: 'center' });
    }

    doc.save(`Gantt_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF exportado correctamente');
  }, [tasks, project, maxDuration, criticalPath, globalProgress]);

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
    <div className="h-full flex flex-col p-4 gap-3 overflow-hidden overflow-x-hidden">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-linear-to-br from-blue-500 to-blue-700 rounded-xl shadow">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tight leading-none">Diagrama de Gantt</h1>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CPM · Ruta Crítica · Holguras · Avance Real</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {saving && <span className="text-[8px] font-bold text-(--color-accent) uppercase animate-pulse">Guardando…</span>}
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            title="Seleccionar proyecto"
            className="px-3 py-2 bg-white/70 backdrop-blur-md border border-white/30 rounded-xl shadow-lg text-xs font-bold uppercase focus:outline-none focus:border-(--color-info)"
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
                viewMode === 'compact' ? 'bg-white shadow text-(--color-info)' : 'text-slate-500 hover:text-slate-700'
              )}
              title="Vista Compacta"
            >
              Compacta
            </button>
            <button
              onClick={() => setViewMode('expanded')}
              className={cn(
                'px-2 py-1.5 rounded-md text-[10px] font-black uppercase transition-all',
                viewMode === 'expanded' ? 'bg-white shadow text-(--color-info)' : 'text-slate-500 hover:text-slate-700'
              )}
              title="Vista Expandida"
            >
              Ver Todo
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={cn(
                'px-2 py-1.5 rounded-md text-[10px] font-black uppercase transition-all',
                viewMode === 'detailed' ? 'bg-white shadow text-(--color-info)' : 'text-slate-500 hover:text-slate-700'
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
              showDependencies ? 'bg-(--color-mod-dashboard)/10 text-(--color-mod-dashboard) border border-(--color-mod-dashboard)' : 'bg-white/70 backdrop-blur-md border border-white/30 text-slate-600 hover:border-(--color-mod-dashboard)'
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
              showFinancialSummary ? 'bg-(--color-success-bg) text-(--color-success) border border-(--color-green-border)' : 'bg-white/70 backdrop-blur-md border border-white/30 text-slate-600 hover:border-(--color-green-border)'
            )}
            title="Resumen financiero"
          >
            <DollarSign size={14} />
            <span className="hidden sm:inline">Financiero</span>
          </button>
          
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
              className="px-1.5 py-1 rounded text-[10px] font-black text-slate-500 hover:bg-white hover:shadow transition-all"
              title="Alejar"
            >−</button>
            <span className="text-[10px] font-bold text-slate-600 min-w-9 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}
              className="px-1.5 py-1 rounded text-[10px] font-black text-slate-500 hover:bg-white hover:shadow transition-all"
              title="Acercar"
            >+</button>
          </div>

          <button
            onClick={() => {
              const el = chartRef.current?.querySelector('[data-today]');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase bg-(--color-warning-bg) text-(--color-warning) border border-(--color-amber-border) hover:bg-(--color-warning-bg) transition-all"
            title="Ir a hoy"
          >
            <Clock size={14} />
            <span className="hidden sm:inline">Hoy</span>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 shrink-0">
        {[
          { icon: <Calendar size={13} className="text-(--color-info)" />,    label: 'Duración',       value: `${maxDuration}d`,                                          color: 'text-slate-700' },
          { icon: <AlertTriangle size={13} className="text-(--color-error)" />, label: 'Ruta Crítica',   value: `${criticalPath.length} tareas`,                            color: 'text-(--color-error)'   },
          { icon: <TrendingUp size={13} className="text-(--color-success)" />,  label: 'Avance Global',  value: `${globalProgress}%`,                                       color: 'text-(--color-success)' },
          { icon: <DollarSign size={13} className="text-(--color-accent)" />,  label: 'Costo Total',    value: fmtQ(tasks.reduce((s,t)=>s+t.cost,0)),                      color: 'text-(--color-warning)' },
          { icon: <Calendar size={13} className="text-(--color-mod-dashboard)" />,   label: 'Fin Estimado',   value: projectEndReal ?? '—',                                       color: 'text-(--color-mod-dashboard)' },
        ].map(k => (
          <div key={k.label} className="bg-white/70 backdrop-blur-md border border-white/30 rounded-xl shadow-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">{k.icon}<span className="text-[7px] font-black text-slate-400 uppercase">{k.label}</span></div>
            <p className={cn('text-sm font-black leading-tight', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Leyenda de colores ── */}
      <div className="flex items-center gap-3 shrink-0 px-1 flex-wrap">
        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Barras:</span>
        {[
          { color: 'bg-linear-to-r from-(--color-error-bg) to-red-600',         label: 'Ruta crítica' },
          { color: 'bg-linear-to-r from-blue-500 to-blue-600',       label: 'Normal'       },
          { color: 'bg-linear-to-r from-emerald-500 to-emerald-600', label: 'Completada'   },
          { color: 'bg-slate-300/70 border border-dashed border-slate-400/50', label: 'Holgura' },
          { color: 'bg-slate-300/30 border border-dashed border-slate-400/30', label: 'Original' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className={cn('w-5 h-2.5 rounded-sm', l.color)} />
            <span className="text-[7px] font-bold text-slate-500">{l.label}</span>
          </div>
        ))}
        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-2">Estado:</span>
        {(Object.entries(STATUS_CFG) as [TaskStatus, typeof STATUS_CFG[TaskStatus]][]).map(([, cfg]) => (
          <div key={cfg.label} className="flex items-center gap-1">
            <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
            <span className="text-[7px] font-bold text-slate-500">{cfg.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setShowSlackTable(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all border',
              showSlackTable
                ? 'bg-(--color-warning-bg) text-(--color-warning) border-(--color-amber-border)'
                : 'bg-white text-slate-500 border-slate-200 hover:border-(--color-amber-border)'
            )}
            title="Tabla de holguras"
          >
            <AlertTriangle size={11} />
            Holguras
          </button>
        </div>
      </div>

      {/* ── Diagrama ── */}
      <div ref={chartRef} className="flex-1 bg-white/70 backdrop-blur-md border border-white/30 rounded-xl shadow-lg overflow-x-auto overflow-y-auto max-h-125">
        <div
          style={{
            minWidth: Math.max(1100, 1100 * zoomLevel),
            minHeight: '100%',
            transform: `scaleX(${zoomLevel})`,
            transformOrigin: 'top left',
          }}
          className="p-4"
        >

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
                    className="absolute top-0 bottom-0 border-l-2 border-(--color-accent) z-10"
                    style={{ left: `${todayLine}%` }}
                    data-today
                  >
                    <span className="absolute -top-5 -translate-x-1/2 text-[7px] font-black text-(--color-accent) uppercase bg-(--color-warning-bg) px-1 rounded">Hoy</span>
                  </div>
                )}
              </div>
            </div>

            {/* SVG Overlay para flechas de dependencia */}
            {showDependencies && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-5 overflow-visible"
                style={{ display: 'block' }}
              >
                {tasks.filter(t => t.dependencies && t.dependencies.length > 0).map(task =>
                  task.dependencies.map(depId => {
                    const from = tasks.find(t => t.id === depId);
                    if (!from) return null;
                    const x1 = (from.earlyFinish / maxDuration) * 100;
                    const x2 = (task.earlyStart / maxDuration) * 100;
                    if (x2 <= x1) return null;

                    const col = 'rgba(100,116,139,0.5)';
                    const midX = (x1 + x2) / 2;
                    // Bezier curve: start → up → right → down → end
                    const d = `M ${x1}% 50 C ${x1 + (midX - x1) * 0.5}% 50, ${midX}% 25, ${midX}% 0 
                               L ${midX}% 100 C ${midX}% 75, ${x1 + (x2 - x1) * 0.8}% 50, ${x2}% 50`;

                    return (
                      <g key={`${task.id}-${depId}`}>
                        <path d={d} fill="none" stroke={col} strokeWidth={1.5} strokeDasharray="4 2"
                          markerEnd="url(#arrowhead)" />
                        <path d={d} fill="none" stroke="transparent" strokeWidth={8} className="pointer-events-auto"
                          onPointerEnter={() => toast.info(`${from.name} → ${task.name}`, { duration: 1500 })}
                        />
                      </g>
                    );
                  })
                )}
                <defs>
                  <marker id="arrowhead" markerWidth={6} markerHeight={4} refX={6} refY={2} orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="rgba(100,116,139,0.6)" />
                  </marker>
                </defs>
              </svg>
            )}

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
                      catCritical ? 'bg-red-50 border border-(--color-red-border)' : 'bg-white/40 backdrop-blur-sm border border-slate-200'
                    )}
                  >
                    {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    <span className={cn('text-[9px] font-black uppercase tracking-widest flex-1', catCritical ? 'text-(--color-error)' : 'text-slate-600')}>{cat}</span>
                    <span className="text-[7px] font-bold text-slate-400">{catTasks.length} renglones</span>
                  </button>

                  {/* Filas de tareas */}
                  {!collapsed && catTasks.map(task => {
                    const isEditing = editingId === task.id;
                    const status    = calcTaskStatus(task, todayDay);
                    const sCfg      = STATUS_CFG[status];
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'flex items-center gap-2 mb-1 px-2 py-1 rounded-lg border',
                          task.isCritical ? 'bg-(--color-error-bg) border-(--color-red-border)' : 'border-transparent hover:bg-white/30'
                        )}
                      >
                        {/* Semáforo de estado */}
                        <div className="shrink-0 flex flex-col items-center gap-0.5" title={sCfg.label}>
                          <div className={cn('w-2 h-2 rounded-full', sCfg.dot,
                            status === 'delayed' && 'animate-pulse',
                            status === 'at-risk' && 'animate-pulse'
                          )} />
                        </div>
                        {/* Info tarea */}
                        <div className="w-64 shrink-0">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5 py-1">
                              {/* Fila 1: Días + Obreros */}
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <span className="text-[7px] text-slate-400">Días</span>
                                  <input
                                    type="number" min={1} value={editDuration}
                                    onChange={e => setEditDuration(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-12 px-1.5 py-0.5 text-[10px] border border-slate-300 rounded focus:outline-none focus:border-(--color-blue-border)"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[7px] text-slate-400">Obreros</span>
                                  <input
                                    type="number" min={1} value={editWorkers}
                                    onChange={e => setEditWorkers(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-12 px-1.5 py-0.5 text-[10px] border border-slate-300 rounded focus:outline-none focus:border-(--color-mod-dashboard)"
                                  />
                                </div>
                                <button onClick={handleEditSave} className="p-1 bg-(--color-success) text-white rounded hover:bg-(--color-success) ml-auto">
                                  <Save size={10} />
                                </button>
                                <button onClick={() => setEditingId(null)} className="p-1 bg-slate-200 rounded hover:bg-slate-300">
                                  <X size={10} />
                                </button>
                              </div>
                              {/* Fila 2: Dependencias */}
                              <div>
                                <span className="text-[7px] text-slate-400 block mb-0.5">Predecesoras</span>
                                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                                  {tasks
                                    .filter(t => t.id !== editingId)
                                    .map(t => {
                                      const checked = editDeps.includes(t.id);
                                      return (
                                        <label
                                          key={t.id}
                                          className={cn(
                                            'flex items-center gap-0.5 px-1.5 py-0.5 rounded cursor-pointer text-[7px] font-bold border transition-all',
                                            checked
                                              ? 'bg-(--color-mod-dashboard)/10 border-(--color-mod-dashboard) text-(--color-mod-dashboard)'
                                              : 'bg-white/40 backdrop-blur-sm border-slate-200 text-slate-500 hover:border-(--color-mod-dashboard)'
                                          )}
                                        >
                                          <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={checked}
                                            onChange={() =>
                                              setEditDeps(prev =>
                                                prev.includes(t.id)
                                                  ? prev.filter(d => d !== t.id)
                                                  : [...prev, t.id]
                                              )
                                            }
                                          />
                                          {t.name.length > 18 ? t.name.slice(0, 16) + '…' : t.name}
                                        </label>
                                      );
                                    })}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <p className="text-[9px] font-bold text-slate-700 truncate flex-1">{task.name}</p>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <span className="text-[7px] font-bold text-slate-400">{task.duration}d·{task.workers}ob</span>
                                <button
                                  title="Editar renglon"
                                  onClick={() => {
                                    setEditingId(task.id);
                                    setEditDuration(task.duration);
                                    setEditWorkers(task.workers);
                                    setEditDeps(config.overrides?.[task.id]?.dependencies ?? task.dependencies);
                                  }}
                                  className="p-0.5 hover:bg-(--color-info-bg) rounded text-(--color-info)"
                                >
                                  <Edit2 size={10} />
                                </button>
                                {config.overrides?.[task.id] && (
                                  <button
                                    title="Restaurar valores originales"
                                    onClick={() => handleResetOverride(task.id)}
                                    className="p-0.5 hover:bg-(--color-error-bg) rounded text-(--color-error)"
                                  >
                                    <X size={10} />
                                  </button>
                                )}
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
                            <span className="text-[7px] font-black text-(--color-info) w-6 text-right">{task.progress}%</span>
                          </div>
                        </div>

                        {/* Barra Gantt con drag, resize y baseline */}
                        <TaskBar
                          task={task}
                          maxDuration={maxDuration}
                          startDate={project?.startDate ?? new Date().toISOString()}
                          onProgressChange={handleProgressChange}
                          onStartDrag={handleStartDrag}
                          onResize={handleResize}
                          chartRef={chartRef}
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

      {/* ── Tabla de holguras ── */}
      {showSlackTable && tasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 bg-white/70 backdrop-blur-md border border-white/30 rounded-xl shadow-lg overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-2.5 bg-white/40 backdrop-blur-sm border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-(--color-accent)" />
              <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Tabla de Holguras y Fechas Reales</span>
            </div>
            <span className="text-[7px] font-bold text-slate-400">{tasks.length} actividades</span>
          </div>
          <div className="overflow-x-auto max-h-56 overflow-y-auto">
            <table className="w-full text-[8px]">
              <thead className="sticky top-0 bg-white/40 backdrop-blur-sm z-10">
                <tr className="border-b border-slate-100">
                  <th className="text-left px-3 py-2 font-black text-slate-500 uppercase">Actividad</th>
                  <th className="text-center px-2 py-2 font-black text-slate-500 uppercase">Cat.</th>
                  <th className="text-center px-2 py-2 font-black text-slate-500 uppercase">Dur.</th>
                  <th className="text-center px-2 py-2 font-black text-(--color-info) uppercase">Inicio T.</th>
                  <th className="text-center px-2 py-2 font-black text-(--color-info) uppercase">Fin T.</th>
                  <th className="text-center px-2 py-2 font-black text-(--color-mod-dashboard) uppercase">Inicio L.</th>
                  <th className="text-center px-2 py-2 font-black text-(--color-mod-dashboard) uppercase">Fin L.</th>
                  <th className="text-center px-2 py-2 font-black text-(--color-warning) uppercase">Holgura</th>
                  <th className="text-center px-2 py-2 font-black text-slate-500 uppercase">Estado</th>
                  <th className="text-center px-2 py-2 font-black text-(--color-success) uppercase">Avance</th>
                  <th className="text-center px-2 py-2 font-black text-(--color-info) uppercase">Esperado</th>
                  <th className="text-center px-2 py-2 font-black text-slate-500 uppercase">Dif.</th>
                  <th className="text-right px-3 py-2 font-black text-slate-500 uppercase">Costo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tasks.map(t => {
                  const base = project?.startDate ? new Date(project.startDate) : new Date();
                  return (
                    <tr
                      key={t.id}
                      className={cn(
                        'hover:bg-white/40 backdrop-blur-sm transition-colors',
                        t.isCritical && 'bg-(--color-error-bg)'
                      )}
                    >
                      <td className="px-3 py-1.5 font-bold text-slate-700 max-w-45 truncate">
                        {t.isCritical && <span className="text-(--color-error) mr-1">⚠</span>}
                        {t.name}
                      </td>
                      <td className="px-2 py-1.5 text-center text-slate-500">{t.category}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-slate-700">{t.duration}d</td>
                      <td className="px-2 py-1.5 text-center text-(--color-info) font-bold">{fmtDate(addDays(base, t.earlyStart))}</td>
                      <td className="px-2 py-1.5 text-center text-(--color-info) font-bold">{fmtDate(addDays(base, t.earlyFinish))}</td>
                      <td className="px-2 py-1.5 text-center text-(--color-mod-dashboard)">{fmtDate(addDays(base, t.lateStart))}</td>
                      <td className="px-2 py-1.5 text-center text-(--color-mod-dashboard)">{fmtDate(addDays(base, t.lateFinish))}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded-full font-black text-[7px]',
                          t.slack === 0
                            ? 'bg-(--color-error-bg) text-(--color-error)'
                            : t.slack <= 3
                              ? 'bg-(--color-warning-bg) text-(--color-warning)'
                              : 'bg-(--color-success-bg) text-(--color-success)'
                        )}>
                          {t.slack === 0 ? 'CRÍTICA' : `${t.slack}d`}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {(() => {
                          const st   = calcTaskStatus(t, todayDay);
                          const scfg = STATUS_CFG[st];
                          return (
                            <span className={cn('px-1.5 py-0.5 rounded-full font-black text-[7px] flex items-center gap-1 justify-center', scfg.badge)}>
                              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', scfg.dot)} />
                              {scfg.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', t.progress === 100 ? 'bg-(--color-success)' : 'bg-(--color-info)')}
                              style={{ width: `${t.progress}%` }}
                            />
                          </div>
                          <span className="font-black text-slate-600 w-6 text-right">{t.progress}%</span>
                        </div>
                      </td>
                      {/* Avance esperado */}
                      <td className="px-2 py-1.5 text-center">
                        {(() => {
                          const exp = (() => {
                            if (todayDay <= t.earlyStart) return 0;
                            if (todayDay >= t.earlyFinish) return 100;
                            return Math.round(((todayDay - t.earlyStart) / t.duration) * 100);
                          })();
                          return <span className="font-bold text-(--color-info)">{exp}%</span>;
                        })()}
                      </td>
                      {/* Diferencia real vs esperado */}
                      <td className="px-2 py-1.5 text-center">
                        {(() => {
                          const exp = (() => {
                            if (todayDay <= t.earlyStart) return 0;
                            if (todayDay >= t.earlyFinish) return 100;
                            return Math.round(((todayDay - t.earlyStart) / t.duration) * 100);
                          })();
                          const diff = t.progress - exp;
                          if (exp === 0 && t.progress === 0) return <span className="text-slate-400 font-bold">—</span>;
                          return (
                            <span className={cn(
                              'px-1.5 py-0.5 rounded-full font-black text-[7px]',
                              diff >= 0 ? 'bg-(--color-success-bg) text-(--color-success)' : 'bg-(--color-error-bg) text-(--color-error)'
                            )}>
                              {diff >= 0 ? '+' : ''}{diff}%
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-(--color-warning)">{fmtQ(t.cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-white/40 backdrop-blur-sm border-t border-slate-200">
                <tr>
                  <td colSpan={2} className="px-3 py-2 font-black text-slate-700 uppercase text-[8px]">TOTALES</td>
                  <td className="px-2 py-2 text-center font-black text-slate-700">{tasks.reduce((s,t)=>s+t.duration,0)}d</td>
                  <td colSpan={6} />
                  <td className="px-2 py-2 text-center font-black text-(--color-info)">{globalProgress}%</td>
                  <td colSpan={2} />
                  <td className="px-3 py-2 text-right font-black text-(--color-warning)">{fmtQ(tasks.reduce((s,t)=>s+t.cost,0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── Ruta crítica mejorada ── */}
      {criticalPath.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 bg-linear-to-r from-(--color-error-bg) to-(--color-mod-gantt)/5 border border-(--color-red-border) rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-(--color-error)" />
              <span className="text-[9px] font-black text-(--color-error) uppercase tracking-wider">
                Ruta Crítica — {criticalPath.length} tareas · {maxDuration} días totales
              </span>
            </div>
            <div className="flex items-center gap-2 text-[8px]">
              <span className="px-2 py-1 bg-(--color-error-bg) text-(--color-error) rounded font-bold">
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
                className="px-3 py-1.5 bg-linear-to-r from-(--color-error-bg) to-red-600 text-white rounded-lg text-[8px] font-bold uppercase shadow-sm"
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
          className="shrink-0 bg-linear-to-br from-slate-800 to-slate-900 rounded-xl p-4 shadow-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-(--color-success)/20 rounded-lg">
                <DollarSign size={18} className="text-(--color-success)" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Resumen Físico-Financiero</h3>
                <p className="text-[9px] text-slate-400">Inversión proyectada por período</p>
              </div>
            </div>
            {/* Toggle Tablas / Gráficos */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setFinancialViewMode('tables')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all',
                    financialViewMode === 'tables' ? 'bg-(--color-success) text-white' : 'text-slate-400 hover:text-white'
                  )}
                  title="Ver tablas"
                >
                  Tablas
                </button>
                <button
                  onClick={() => setFinancialViewMode('charts')}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all',
                    financialViewMode === 'charts' ? 'bg-(--color-success) text-white' : 'text-slate-400 hover:text-white'
                  )}
                  title="Ver gráficos"
                >
                  Gráficos
                </button>
              </div>
              <button
                onClick={() => {
                  const totalCost = tasks.reduce((s, t) => s + t.cost, 0);
                  const weeks = Math.ceil(maxDuration / 7);
                  const months = Math.ceil(maxDuration / 30);
                  const dailyInvestment = totalCost / maxDuration;
                  
                  // Calcular datos
                  const weeklyData = Array.from({ length: weeks }, (_, i) => {
                    const weekStart = i * 7;
                    const weekEnd = Math.min((i + 1) * 7, maxDuration);
                    const weekTasks = tasks.filter(t => t.earlyStart < weekEnd && t.earlyFinish > weekStart);
                    const weekCost = weekTasks.reduce((s, t) => s + (t.cost * (t.progress / 100)), 0);
                    const effectiveDays = Math.min(weekEnd, maxDuration) - Math.max(weekStart, 0);
                    return { week: i + 1, cost: weekCost || (dailyInvestment * effectiveDays) };
                  });
                  
                  const monthlyData = Array.from({ length: months }, (_, i) => {
                    const monthStart = i * 30;
                    const monthEnd = Math.min((i + 1) * 30, maxDuration);
                    const monthTasks = tasks.filter(t => t.earlyStart < monthEnd && t.earlyFinish > monthStart);
                    const monthCost = monthTasks.reduce((s, t) => s + (t.cost * (t.progress / 100)), 0);
                    const effectiveDays = Math.min(monthEnd, maxDuration) - Math.max(monthStart, 0);
                    return { month: i + 1, cost: monthCost || (dailyInvestment * effectiveDays) };
                  });
                  
                  // Generar CSV
                  const headers = ['Período', 'Tipo', 'Inversión (Q)', 'Acumulado (Q)'];
                  const rows: string[][] = [];
                  
                  // Semanas
                  weeklyData.forEach((w, i) => {
                    const acumulado = weeklyData.slice(0, i + 1).reduce((s, x) => s + x.cost, 0);
                    rows.push([`Semana ${w.week}`, 'Semanal', w.cost.toFixed(2), acumulado.toFixed(2)]);
                  });
                  
                  rows.push(['', '', '', '']);
                  rows.push(['RESUMEN MENSUAL', '', '', '']);
                  
                  // Meses
                  monthlyData.forEach((m, i) => {
                    const acumulado = monthlyData.slice(0, i + 1).reduce((s, x) => s + x.cost, 0);
                    rows.push([`Mes ${m.month}`, 'Mensual', m.cost.toFixed(2), acumulado.toFixed(2)]);
                  });
                  
                  rows.push(['', '', '', '']);
                  rows.push(['TOTAL PROYECTO', '', totalCost.toFixed(2), '']);
                  
                  const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
                  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = `Resumen_Financiero_${project?.name || 'Proyecto'}_${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                  toast.success('Exportado a Excel/CSV');
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-(--color-success) text-white rounded-lg text-xs font-black uppercase hover:bg-(--color-success) transition-all"
                title="Exportar a Excel/CSV"
              >
                <Download size={14} />
                Excel
              </button>
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
                    <p className="text-lg font-black text-(--color-success)">{fmtQ(totalCost)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-[8px] text-slate-400 uppercase font-black mb-1">Por Semana</p>
                    <p className="text-lg font-black text-(--color-info)">{fmtQ(weeklyInvestment)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <p className="text-[8px] text-slate-400 uppercase font-black mb-1">Por Mes</p>
                    <p className="text-lg font-black text-(--color-mod-dashboard)">{fmtQ(monthlyInvestment)}</p>
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
                              <td className="py-2 text-right font-black text-(--color-success)">{fmtQ(w.cost)}</td>
                              <td className="py-2 text-center text-slate-400">{w.tasks}</td>
                              <td className="py-2 text-right font-bold text-(--color-info)">{fmtQ(accumulated)}</td>
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
                              <td className="py-2 text-right font-black text-(--color-mod-dashboard)">{fmtQ(m.cost)}</td>
                              <td className="py-2 text-center text-slate-400">{m.tasks}</td>
                              <td className="py-2 text-right font-bold text-(--color-info)">{fmtQ(accumulated)}</td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Gráficos financieros */}
                {financialViewMode === 'charts' && (
                  <div className="space-y-6 mt-6">
                    {/* Gráfico de inversión por semana */}
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <h4 className="text-[10px] font-black text-slate-300 uppercase mb-3">Inversión por Semana (Q)</h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weeklyData.map(w => ({ ...w, name: `S${w.week}` }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `Q ${(v/1000).toFixed(0)}k`} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                              formatter={(value: number) => [fmtQ(value), 'Inversión']}
                            />
                            <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} name="Inversión" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Gráfico de inversión por mes */}
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <h4 className="text-[10px] font-black text-slate-300 uppercase mb-3">Inversión por Mes (Q)</h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={monthlyData.map(m => ({ ...m, name: `Mes ${m.month}` }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `Q ${(v/1000).toFixed(0)}k`} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                              formatter={(value: number) => [fmtQ(value), 'Inversión']}
                            />
                            <Area type="monotone" dataKey="cost" stroke="#8b5cf6" fill="rgba(139, 92, 246, 0.3)" name="Inversión" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Gráfico de inversión acumulada */}
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <h4 className="text-[10px] font-black text-slate-300 uppercase mb-3">Inversión Acumulada (Q)</h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={weeklyData.map((w, i) => ({
                            name: `S${w.week}`,
                            acumulado: weeklyData.slice(0, i + 1).reduce((s, x) => s + x.cost, 0)
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `Q ${(v/1000).toFixed(0)}k`} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                              formatter={(value: number) => [fmtQ(value), 'Acumulado']}
                            />
                            <Line type="monotone" dataKey="acumulado" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} name="Acumulado" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
}


