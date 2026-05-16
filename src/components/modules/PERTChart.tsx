import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { cn } from "../../utils/cn";
import { PERTTask, PERTCalculated, calculatePERTNetwork, layoutPERT, LayoutNode, projectStddev, projectVariance, probabilityOfCompletionBy } from "../../engine/pertEngine";
import { Card, CardHeader } from "../shared/Card";
import { AlertTriangle, Info, TrendingUp, DollarSign, Calendar } from "lucide-react";

interface PERTChartProps {
  tasks?: PERTTask[];
  className?: string;
  projectName?: string;
}

function NodeCard({ node, isSelected, onClick }: { node: LayoutNode; isSelected: boolean; onClick: () => void }) {
  const t = node.task;
  return (
    <motion.g
      onClick={onClick}
      style={{ cursor: "pointer" }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={8}
        fill={t.isCritical ? "#fef2f2" : "#ffffff"}
        stroke={t.isCritical ? "#dc2626" : isSelected ? "#f59e0b" : "#e2e8f0"}
        strokeWidth={t.isCritical ? 2 : isSelected ? 2 : 1}
        className="transition-all duration-200"
      />
      {t.isCritical && (
        <rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={3}
          rx={1.5}
          fill="#ef4444"
        />
      )}
      <text
        x={node.x + node.width / 2}
        y={node.y + 18}
        textAnchor="middle"
        className="text-[17px]"
        fill="#0f172a"
        fontWeight="700"
        fontSize="8.5px"
        fontFamily="Inter, sans-serif"
      >
        {t.name.length > 22 ? t.name.slice(0, 21) + "…" : t.name}
      </text>
      <text
        x={node.x + node.width / 2}
        y={node.y + 34}
        textAnchor="middle"
        fill="#64748b"
        fontSize="7px"
        fontFamily="JetBrains Mono, monospace"
      >
        ES:{t.earlyStart.toFixed(1)}d · EF:{t.earlyFinish.toFixed(1)}d
      </text>
      <text
        x={node.x + node.width / 2}
        y={node.y + 47}
        textAnchor="middle"
        fill="#64748b"
        fontSize="7px"
        fontFamily="JetBrains Mono, monospace"
      >
        LS:{t.lateStart.toFixed(1)}d · LF:{t.lateFinish.toFixed(1)}d
      </text>
      <text
        x={node.x + node.width / 2}
        y={node.y + 60}
        textAnchor="middle"
        fill={t.isCritical ? "#dc2626" : "#64748b"}
        fontSize="7px"
        fontWeight="700"
        fontFamily="JetBrains Mono, monospace"
      >
        H:{t.slack.toFixed(1)}d · E:{t.expected.toFixed(1)}d
      </text>
      {t.isCritical && (
        <text
          x={node.x + node.width - 4}
          y={node.y + 10}
          textAnchor="end"
          fill="#dc2626"
          fontSize="7px"
          fontWeight="700"
        >
          ★
        </text>
      )}
    </motion.g>
  );
}

const SAMPLE_TASKS: PERTTask[] = [
  { id: "A", name: "Preliminares", optimistic: 2, mostLikely: 3, pessimistic: 5, dependencies: [], category: "Preliminares", cost: 5000 },
  { id: "B", name: "Cimentación", optimistic: 5, mostLikely: 7, pessimistic: 10, dependencies: ["A"], category: "Cimentación", cost: 15000 },
  { id: "C", name: "Estructura", optimistic: 8, mostLikely: 10, pessimistic: 14, dependencies: ["B"], category: "Estructura", cost: 25000 },
  { id: "D", name: "Inst. Eléctrica", optimistic: 4, mostLikely: 5, pessimistic: 8, dependencies: ["C"], category: "Instalaciones", cost: 8000 },
  { id: "E", name: "Inst. Hidráulica", optimistic: 3, mostLikely: 5, pessimistic: 7, dependencies: ["C"], category: "Instalaciones", cost: 7000 },
  { id: "F", name: "Mampostería", optimistic: 4, mostLikely: 6, pessimistic: 9, dependencies: ["D"], category: "Mampostería", cost: 12000 },
  { id: "G", name: "Acabados", optimistic: 3, mostLikely: 4, pessimistic: 6, dependencies: ["E", "F"], category: "Acabados", cost: 10000 },
  { id: "H", name: "Cubierta", optimistic: 5, mostLikely: 7, pessimistic: 10, dependencies: ["G"], category: "Cubierta", cost: 18000 },
  { id: "I", name: "Exteriores", optimistic: 2, mostLikely: 3, pessimistic: 5, dependencies: ["H"], category: "Exteriores", cost: 6000 },
];

export default function PERTChart({ tasks: propTasks = [], className, projectName }: PERTChartProps) {
  const tasks = propTasks.length > 0 ? propTasks : SAMPLE_TASKS;
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [targetDays, setTargetDays] = useState(60);

  const calculated = useMemo(() => calculatePERTNetwork(tasks), [tasks]);
  const layout = useMemo(() => layoutPERT(calculated), [calculated]);

  const criticalPath = useMemo(() => calculated.filter(t => t.isCritical), [calculated]);
  const prob = useMemo(() => probabilityOfCompletionBy(calculated, targetDays), [calculated, targetDays]);
  const stddev = useMemo(() => projectStddev(calculated), [calculated]);
  const variance = useMemo(() => projectVariance(calculated), [calculated]);
  const projectDuration = useMemo(() => Math.max(...calculated.map(t => t.earlyFinish)), [calculated]);
  const totalCost = useMemo(() => tasks.reduce((s, t) => s + t.cost, 0), [tasks]);

  const selected = selectedNode ? calculated.find(t => t.id === selectedNode) : null;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Diagrama PERT</h1>
          <p className="page-subtitle">{projectName || "Análisis de ruta crítica"}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Card accent="gantt" padding="md">
          <p className="text-xs font-semibold uppercase tracking-wider text-n-500">Duración proyecto</p>
          <p className="text-2xl font-extrabold text-n-900 mt-1">{projectDuration.toFixed(1)} <span className="text-sm font-medium text-n-400">días</span></p>
        </Card>
        <Card accent="dashboard" padding="md">
          <p className="text-xs font-semibold uppercase tracking-wider text-n-500">Ruta crítica</p>
          <p className="text-2xl font-extrabold text-n-900 mt-1">{criticalPath.length} <span className="text-sm font-medium text-n-400">actividades</span></p>
        </Card>
        <Card accent="seguimiento" padding="md">
          <p className="text-xs font-semibold uppercase tracking-wider text-n-500">Desviación std</p>
          <p className="text-2xl font-extrabold text-n-900 mt-1">{stddev.toFixed(1)} <span className="text-sm font-medium text-n-400">días</span></p>
        </Card>
        <Card accent="inventory" padding="md">
          <p className="text-xs font-semibold uppercase tracking-wider text-n-500">Costo total</p>
          <p className="text-2xl font-extrabold text-n-900 mt-1">Q{totalCost.toLocaleString()}</p>
        </Card>
      </div>

      <div className="flex-1 card overflow-hidden">
        <CardHeader
          action={
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-3 h-0.5 bg-red-500 rounded inline-block" />
                <span className="text-n-500 font-medium">Ruta crítica</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="label mb-0 whitespace-nowrap">Meta:</label>
                <input
                  type="number"
                  value={targetDays}
                  onChange={e => setTargetDays(Math.max(1, Number(e.target.value)))}
                  className="input w-20 text-center text-sm"
                  title="Días meta"
                />
                <span className="text-xs font-bold text-n-500">días</span>
              </div>
              <div className={cn("px-3 py-1.5 rounded-lg text-xs font-bold", prob >= 0.9 ? "bg-success-bg text-success" : prob >= 0.5 ? "bg-warning-bg text-warning" : "bg-error-bg text-error")}>
                {targetDays}d: {(prob * 100).toFixed(1)}% prob.
              </div>
            </div>
          }
        >
          <h3 className="text-sm font-bold text-n-700 uppercase tracking-wider">Red de Actividades</h3>
        </CardHeader>

        <div className="flex-1 overflow-auto p-4">
          <svg
            viewBox={(() => {
              const xs = layout.nodes.map(n => n.x);
              const ys = layout.nodes.map(n => n.y);
              const minX = Math.min(...xs) - 40;
              const maxX = Math.max(...xs.map(x => x + 160)) + 40;
              const minY = Math.min(...ys) - 40;
              const maxY = Math.max(...ys.map(y => y + 72)) + 40;
              return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
            })()}
            className="w-full h-full min-h-[400px]"
          >
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
              </marker>
              <marker id="arrowhead-critical" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
              </marker>
            </defs>

            {layout.edges.map((edge, i) => {
              const from = layout.nodes.find(n => n.id === edge.from);
              const to = layout.nodes.find(n => n.id === edge.to);
              if (!from || !to) return null;
              const fromTask = calculated.find(t => t.id === edge.from);
              const isCrit = fromTask?.isCritical && calculated.find(t => t.id === edge.to)?.isCritical;
              const x1 = from.x + from.width;
              const y1 = from.y + from.height / 2;
              const x2 = to.x;
              const y2 = to.y + to.height / 2;
              const midY = (y1 + y2) / 2;
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isCrit ? "#ef4444" : "#94a3b8"}
                  strokeWidth={isCrit ? 2.5 : 1.5}
                  strokeDasharray={isCrit ? "none" : "5,3"}
                  markerEnd={isCrit ? "url(#arrowhead-critical)" : "url(#arrowhead)"}
                  className="transition-all"
                />
              );
            })}

            {layout.nodes.map(node => (
              <NodeCard
                key={node.id}
                node={node}
                isSelected={selectedNode === node.id}
                onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
              />
            ))}
          </svg>
        </div>
      </div>

      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 grid grid-cols-4 gap-3"
        >
          <Card padding="sm">
            <p className="text-[10px] font-bold text-n-500 uppercase tracking-wider">Actividad</p>
            <p className="text-sm font-bold text-n-900 mt-0.5">{selected.name}</p>
          </Card>
          <Card padding="sm">
            <p className="text-[10px] font-bold text-n-500 uppercase tracking-wider">Duración esperada</p>
            <p className="text-sm font-bold text-n-900 mt-0.5">{selected.expected.toFixed(1)} días</p>
          </Card>
          <Card padding="sm">
            <p className="text-[10px] font-bold text-n-500 uppercase tracking-wider">Ventana (ES-EF)</p>
            <p className="text-sm font-bold text-n-900 mt-0.5">{selected.earlyStart.toFixed(1)} → {selected.earlyFinish.toFixed(1)}</p>
          </Card>
          <Card padding="sm">
            <p className="text-[10px] font-bold text-n-500 uppercase tracking-wider">Holgura</p>
            <p className={cn("text-sm font-bold mt-0.5", selected.isCritical ? "text-error" : "text-success")}>{selected.slack.toFixed(1)} días</p>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
