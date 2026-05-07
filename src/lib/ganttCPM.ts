// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface GanttTask {
  id: string;
  name: string;
  category: string;
  duration: number;       // días calendario reales
  dependencies: string[];
  progress: number;       // 0-100
  earlyStart: number;     // días desde inicio proyecto
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slack: number;
  isCritical: boolean;
  cost: number;
  // Datos editables por el usuario
  workers: number;        // cuadrilla asignada
  unit: string;
  quantity: number;
  durationPerUnit: number; // días/unidad base (del presupuesto)
}

export interface GanttConfig {
  overrides: Record<string, {
    duration?: number;
    dependencies?: string[];
    workers?: number;
  }>;
  progress: Record<string, number>;
}

// ── Orden lógico de categorías en construcción ────────────────────────────────
export const CATEGORY_ORDER: Record<string, number> = {
  Preliminares:  0,
  Cimentación:   1,
  Estructura:    2,
  Mampostería:   3,
  Fachada:       3,
  Instalaciones: 4,
  Cubierta:      5,
  Acabados:      6,
  Exteriores:    7,
  Personalizado: 8,
};

function catOrder(cat: string) { return CATEGORY_ORDER[cat] ?? 99; }

// ── Duración real por renglón ─────────────────────────────────────────────────
/**
 * Fórmula: duration = (quantity × durationDays) / workers
 * - durationDays: días por unidad con 1 cuadrilla estándar (del presupuesto)
 * - workers: suma de quantity de todos los roles de mano de obra del renglón
 * - Si el proyecto tiene startDate + endDate, escala para que la suma total
 *   de duraciones en ruta crítica no supere el plazo contractual.
 */
export function calcRealDuration(
  item: any,
  workerOverride?: number
): { duration: number; workers: number; durationPerUnit: number } {
  const qty          = item.projectQuantity || 1;
  const daysPerUnit  = item.durationDays    || 1;
  // Rendimiento real: suma de cuadrilla del renglón
  const laborWorkers = (item.labor ?? []).reduce((s: number, l: any) => s + (l.quantity || 0), 0);
  const workers      = workerOverride ?? (laborWorkers > 0 ? laborWorkers : 1);
  // Días reales = (cantidad × días/unidad) / cuadrilla
  const duration     = Math.max(1, Math.ceil((qty * daysPerUnit) / workers));
  return { duration, workers, durationPerUnit: daysPerUnit };
}

// ── CPM con ordenamiento topológico (Kahn) ────────────────────────────────────
export function calculateCPM(tasks: GanttTask[]): GanttTask[] {
  if (!tasks.length) return [];
  const map = new Map<string, GanttTask>(tasks.map(t => [t.id, { ...t }]));

  // Filtrar dependencias a IDs inexistentes
  map.forEach(t => { t.dependencies = t.dependencies.filter(dep => map.has(dep)); });

  // Kahn: grado de entrada + adyacencia
  const inDegree = new Map<string, number>();
  const adj      = new Map<string, string[]>();
  map.forEach((t, id) => { inDegree.set(id, t.dependencies.length); adj.set(id, []); });
  map.forEach(t => { t.dependencies.forEach(dep => adj.get(dep)?.push(t.id)); });

  const queue: string[] = [];
  inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });
  const topoOrder: string[] = [];

  while (queue.length) {
    const cur = queue.shift()!;
    topoOrder.push(cur);
    adj.get(cur)?.forEach(succ => {
      const deg = (inDegree.get(succ) ?? 1) - 1;
      inDegree.set(succ, deg);
      if (deg === 0) queue.push(succ);
    });
  }
  // Incluir huérfanos (ciclos o desconectados)
  map.forEach((_, id) => { if (!topoOrder.includes(id)) topoOrder.push(id); });

  // Forward pass
  topoOrder.forEach(id => {
    const t = map.get(id)!;
    const depFinishes = t.dependencies.map(dep => map.get(dep)?.earlyFinish ?? 0);
    t.earlyStart  = depFinishes.length > 0 ? Math.max(...depFinishes) : 0;
    t.earlyFinish = t.earlyStart + t.duration;
  });

  const maxFinish = Math.max(...Array.from(map.values()).map(t => t.earlyFinish), 0);

  // Backward pass
  [...topoOrder].reverse().forEach(id => {
    const t      = map.get(id)!;
    const succs  = (adj.get(id) ?? []).filter(s => map.has(s));
    const starts = succs.map(s => map.get(s)!.lateStart);
    t.lateFinish = starts.length > 0 ? Math.min(...starts) : maxFinish;
    t.lateStart  = t.lateFinish - t.duration;
    t.slack      = t.lateStart - t.earlyStart;
    t.isCritical = t.slack <= 0;
  });

  return topoOrder.map(id => map.get(id)!);
}

// ── Construir tareas desde items del presupuesto ──────────────────────────────
export function buildTasksFromItems(
  items: any[],
  config: GanttConfig,
  projectStartDate?: string,
  projectEndDate?: string
): GanttTask[] {
  // Normalizar config defensivamente
  const overrides   = config?.overrides  ?? {};
  const progressMap = config?.progress   ?? {};

  // Ordenar por categoría lógica
  const sorted = [...items].sort((a, b) => catOrder(a.category) - catOrder(b.category));

  // Calcular duración total CPM sin escalar para saber si hay que ajustar
  const lastInCategory = new Map<string, string>();

  const tasks: GanttTask[] = sorted.map(item => {
    const ov = overrides[item.id] ?? {};

    // Duración real basada en rendimiento de mano de obra
    const { duration: baseDuration, workers: baseWorkers, durationPerUnit } = calcRealDuration(item, ov.workers);
    const duration = ov.duration ?? baseDuration;
    const workers  = ov.workers  ?? baseWorkers;

    // Dependencias automáticas entre categorías
    let dependencies: string[];
    if (ov.dependencies) {
      dependencies = ov.dependencies;
    } else {
      const deps: string[] = [];
      const prevCatOrder = catOrder(item.category) - 1;
      if (prevCatOrder >= 0) {
        const prevCatName = Object.keys(CATEGORY_ORDER).find(k => CATEGORY_ORDER[k] === prevCatOrder);
        if (prevCatName && lastInCategory.has(prevCatName)) deps.push(lastInCategory.get(prevCatName)!);
      }
      if (lastInCategory.has(item.category)) deps.push(lastInCategory.get(item.category)!);
      dependencies = [...new Set(deps)];
    }
    lastInCategory.set(item.category, item.id);

    const matCost   = (item.materials ?? []).reduce((s: number, m: any) => s + (m.price || 0) * (m.quantity || 0) * (item.projectQuantity || 1), 0);
    const laborCost = (item.labor    ?? []).reduce((s: number, l: any) => s + (l.price || 0) * (l.quantity || 0) * (item.projectQuantity || 1), 0);

    return {
      id: item.id, name: item.description, category: item.category,
      duration, dependencies,
      progress: progressMap[item.id] ?? 0,
      earlyStart: 0, earlyFinish: 0, lateStart: 0, lateFinish: 0,
      slack: 0, isCritical: false,
      cost: matCost + laborCost,
      workers, unit: item.unit, quantity: item.projectQuantity || 1, durationPerUnit,
    };
  });

  const result = calculateCPM(tasks);

  // Si el proyecto tiene fechas contractuales, escalar para que la ruta crítica
  // quepa dentro del plazo. Solo si NO hay overrides manuales de duración.
  if (projectStartDate && projectEndDate && Object.keys(overrides).length === 0) {
    const contractDays = Math.max(1, Math.floor(
      (new Date(projectEndDate).getTime() - new Date(projectStartDate).getTime()) / 86_400_000
    ));
    const cpmDuration = Math.max(...result.map(t => t.earlyFinish), 1);
    if (cpmDuration !== contractDays) {
      const scale = contractDays / cpmDuration;
      result.forEach(t => {
        t.duration    = Math.max(1, Math.round(t.duration * scale));
        t.earlyFinish = t.earlyStart + t.duration;
      });
      // Recalcular CPM con duraciones escaladas
      return calculateCPM(result);
    }
  }

  return result;
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────
export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function daysSinceStart(startDate: string): number {
  const start = new Date(startDate);
  const today = new Date();
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
}
