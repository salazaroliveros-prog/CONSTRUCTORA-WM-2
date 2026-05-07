// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface GanttTask {
  id: string;
  name: string;
  category: string;
  duration: number;       // días calendario
  dependencies: string[]; // IDs predecesoras
  progress: number;       // 0-100 avance físico real
  earlyStart: number;     // días desde inicio proyecto
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slack: number;
  isCritical: boolean;
  cost: number;           // costo total del renglón
}

export interface GanttConfig {
  /** duraciones y dependencias editadas manualmente por renglón */
  overrides: Record<string, { duration?: number; dependencies?: string[] }>;
  /** avance físico ingresado por el usuario */
  progress: Record<string, number>;
}

// ── Orden de categorías en construcción ───────────────────────────────────────
export const CATEGORY_ORDER: Record<string, number> = {
  Preliminares: 0,
  Cimentación:  1,
  Estructura:   2,
  Mampostería:  3,
  Fachada:      3,
  Instalaciones:4,
  Cubierta:     5,
  Acabados:     6,
  Exteriores:   7,
};

function catOrder(cat: string) {
  return CATEGORY_ORDER[cat] ?? 99;
}

// ── CPM con ordenamiento topológico (Kahn) ────────────────────────────────────
export function calculateCPM(tasks: GanttTask[]): GanttTask[] {
  const map = new Map<string, GanttTask>(tasks.map(t => [t.id, { ...t }]));

  // Filtrar dependencias que apunten a IDs que no existen en el mapa
  map.forEach(t => {
    t.dependencies = t.dependencies.filter(dep => map.has(dep));
  });

  // Kahn: construir grado de entrada y lista de adyacencia
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  map.forEach((t, id) => {
    inDegree.set(id, t.dependencies.length);
    adj.set(id, []);
  });
  map.forEach(t => {
    t.dependencies.forEach(dep => {
      adj.get(dep)?.push(t.id);
    });
  });

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

  // Incluir nodos que no llegaron al topoOrder (ciclos o huérfanos)
  map.forEach((_, id) => { if (!topoOrder.includes(id)) topoOrder.push(id); });

  // Forward pass
  topoOrder.forEach(id => {
    const t = map.get(id)!;
    const depFinishes = t.dependencies.map(dep => map.get(dep)?.earlyFinish ?? 0);
    t.earlyStart  = depFinishes.length > 0 ? Math.max(...depFinishes) : 0;
    t.earlyFinish = t.earlyStart + t.duration;
  });

  const maxFinish = Math.max(...Array.from(map.values()).map(t => t.earlyFinish), 0);

  // Backward pass (reverse topo)
  [...topoOrder].reverse().forEach(id => {
    const t = map.get(id)!;
    const succs = (adj.get(id) ?? []).filter(s => map.has(s));
    const succStarts = succs.map(s => map.get(s)!.lateStart);
    t.lateFinish = succStarts.length > 0 ? Math.min(...succStarts) : maxFinish;
    t.lateStart  = t.lateFinish - t.duration;
    t.slack       = t.lateStart - t.earlyStart;
    t.isCritical  = t.slack <= 0;
  });

  // Devolver en orden topológico
  return topoOrder.map(id => map.get(id)!);
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────
export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
}

/** Días transcurridos desde startDate hasta hoy */
export function daysSinceStart(startDate: string): number {
  const start = new Date(startDate);
  const today = new Date();
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
}

// ── Construir tareas desde items del presupuesto ──────────────────────────────
export function buildTasksFromItems(
  items: any[],
  config: GanttConfig
): GanttTask[] {
  // Normalizar config defensivamente — Firestore puede devolver campos undefined
  const overrides = config?.overrides ?? {};
  const progressMap = config?.progress ?? {};

  const sorted = [...items].sort((a, b) => catOrder(a.category) - catOrder(b.category));
  const lastInCategory = new Map<string, string>();

  const tasks: GanttTask[] = sorted.map(item => {
    const ov = overrides[item.id] ?? {};
    const baseDuration = Math.max(1, Math.ceil((item.projectQuantity || 1) * (item.durationDays || 1)));
    const duration = ov.duration ?? baseDuration;

    let dependencies: string[];
    if (ov.dependencies) {
      dependencies = ov.dependencies;
    } else {
      const deps: string[] = [];
      const prevCatOrder = catOrder(item.category) - 1;
      if (prevCatOrder >= 0) {
        const prevCatName = Object.keys(CATEGORY_ORDER).find(k => CATEGORY_ORDER[k] === prevCatOrder);
        if (prevCatName && lastInCategory.has(prevCatName)) {
          deps.push(lastInCategory.get(prevCatName)!);
        }
      }
      if (lastInCategory.has(item.category)) {
        deps.push(lastInCategory.get(item.category)!);
      }
      dependencies = [...new Set(deps)];
    }

    lastInCategory.set(item.category, item.id);

    const matCost   = (item.materials ?? []).reduce((s: number, m: any) => s + (m.price || 0) * (m.quantity || 0) * (item.projectQuantity || 1), 0);
    const laborCost = (item.labor    ?? []).reduce((s: number, l: any) => s + (l.price || 0) * (l.quantity || 0) * (item.projectQuantity || 1), 0);

    return {
      id: item.id,
      name: item.description,
      category: item.category,
      duration,
      dependencies,
      progress: progressMap[item.id] ?? 0,
      earlyStart: 0, earlyFinish: 0,
      lateStart: 0,  lateFinish: 0,
      slack: 0, isCritical: false,
      cost: matCost + laborCost,
    };
  });

  return calculateCPM(tasks);
}
