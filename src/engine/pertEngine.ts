export interface PERTTask {
  id: string;
  name: string;
  optimistic: number;
  mostLikely: number;
  pessimistic: number;
  dependencies: string[];
  category: string;
  cost: number;
}

export interface PERTCalculated {
  id: string;
  name: string;
  expected: number;
  variance: number;
  stddev: number;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slack: number;
  isCritical: boolean;
  dependencies: string[];
  category: string;
  cost: number;
}

export function calcPERT(o: number, m: number, p: number) {
  const expected = (o + 4 * m + p) / 6;
  const variance = Math.pow((p - o) / 6, 2);
  return { expected, variance, stddev: Math.sqrt(variance) };
}

export function calculatePERTNetwork(tasks: PERTTask[]): PERTCalculated[] {
  if (!tasks.length) return [];

  const map = new Map<string, PERTCalculated>();
  tasks.forEach(t => {
    const { expected, variance, stddev } = calcPERT(t.optimistic, t.mostLikely, t.pessimistic);
    map.set(t.id, {
      id: t.id,
      name: t.name,
      expected,
      variance,
      stddev,
      earlyStart: 0,
      earlyFinish: expected,
      lateStart: 0,
      lateFinish: expected,
      slack: 0,
      isCritical: false,
      dependencies: t.dependencies.filter(d => tasks.some(x => x.id === d)),
      category: t.category,
      cost: t.cost,
    });
  });

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  map.forEach((_, id) => { inDegree.set(id, 0); adj.set(id, []); });
  map.forEach(t => {
    t.dependencies.forEach(dep => {
      adj.get(dep)?.push(t.id);
      inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
    });
  });

  const queue: string[] = [];
  inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });
  const topoOrder: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    topoOrder.push(cur);
    adj.get(cur)?.forEach(succ => {
      const d = (inDegree.get(succ) || 1) - 1;
      inDegree.set(succ, d);
      if (d === 0) queue.push(succ);
    });
  }

  map.forEach((_, id) => { if (!topoOrder.includes(id)) topoOrder.push(id); });

  topoOrder.forEach(id => {
    const t = map.get(id)!;
    if (t.dependencies.length > 0) {
      t.earlyStart = Math.max(...t.dependencies.map(d => map.get(d)?.earlyFinish ?? 0));
    }
    t.earlyFinish = t.earlyStart + t.expected;
  });

  const projectEnd = Math.max(...Array.from(map.values()).map(t => t.earlyFinish));
  const revOrder = [...topoOrder].reverse();
  revOrder.forEach(id => {
    const t = map.get(id)!;
    const succs = Array.from(map.values()).filter(s => s.dependencies.includes(id));
    if (succs.length > 0) {
      t.lateFinish = Math.min(...succs.map(s => s.lateStart));
    } else {
      t.lateFinish = projectEnd;
    }
    t.lateStart = t.lateFinish - t.expected;
    t.slack = t.lateStart - t.earlyStart;
    t.isCritical = Math.abs(t.slack) < 0.001;
  });

  return Array.from(map.values());
}

export function projectVariance(calculated: PERTCalculated[]): number {
  const critical = calculated.filter(t => t.isCritical);
  return critical.reduce((sum, t) => sum + t.variance, 0);
}

export function projectStddev(calculated: PERTCalculated[]): number {
  return Math.sqrt(projectVariance(calculated));
}

export function probabilityOfCompletionBy(calculated: PERTCalculated[], targetDays: number): number {
  const criticalDuration = Math.max(...calculated.filter(t => t.isCritical).map(t => t.earlyFinish));
  const stddev = projectStddev(calculated);
  if (stddev === 0) return targetDays >= criticalDuration ? 1 : 0;
  const z = (targetDays - criticalDuration) / stddev;
  return cumulativeNormal(z);
}

function cumulativeNormal(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * z);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  task: PERTCalculated;
}

export interface LayoutEdge {
  from: string;
  to: string;
}

export function layoutPERT(calculated: PERTCalculated[]): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const levels = new Map<number, string[]>();
  const nodeLevel = new Map<string, number>();

  let current: string[] = calculated.filter(t => t.dependencies.length === 0).map(t => t.id);
  let level = 0;
  const visited = new Set<string>();

  while (current.length > 0) {
    levels.set(level, [...current]);
    current.forEach(id => { nodeLevel.set(id, level); visited.add(id); });
    const next: string[] = [];
    current.forEach(id => {
      const successors = calculated.filter(s => s.dependencies.includes(id));
      successors.forEach(s => {
        const allDepsVisited = s.dependencies.every(d => visited.has(d));
        if (allDepsVisited && !visited.has(s.id) && !next.includes(s.id)) {
          next.push(s.id);
        }
      });
    });
    current = next;
    level++;
  }

  calculated.forEach(t => {
    if (!nodeLevel.has(t.id)) {
      nodeLevel.set(t.id, level++);
    }
  });

  const NODE_W = 160;
  const NODE_H = 72;
  const H_GAP = 100;
  const V_GAP = 40;
  const PAD = 20;

  const nodes: LayoutNode[] = [];
  levels.forEach((ids, lv) => {
    const totalW = ids.length * NODE_W + (ids.length - 1) * V_GAP;
    ids.forEach((id, i) => {
      const task = calculated.find(t => t.id === id)!;
      const x = -totalW / 2 + i * (NODE_W + V_GAP);
      const y = lv * (NODE_H + H_GAP);
      nodes.push({ id, x, y, width: NODE_W, height: NODE_H, task });
    });
  });

  const edges: LayoutEdge[] = [];
  calculated.forEach(t => {
    t.dependencies.forEach(dep => {
      edges.push({ from: dep, to: t.id });
    });
  });

  return { nodes, edges };
}
