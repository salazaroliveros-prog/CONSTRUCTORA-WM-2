import React, { useMemo, useState, useRef } from "react";
import { motion } from "motion/react";
import { cn } from "../../utils/cn";
import { fmtQ, PMath } from "../../engine/precision";
import { useStore } from "../../store/DataStore";
import { Card, CardHeader } from "../shared/Card";
import { generateProgressReport, generatePhysicalFinancialPDF } from "../../lib/reportEngine";
import { FileDown, Printer, BarChart3, Clock, DollarSign, TrendingUp, Calendar, Building2 } from "lucide-react";

interface LineItemSpend {
  code: string;
  description: string;
  unit: string;
  quantity: number;
  plannedCost: number;
  actualCost: number;
  duration: number;
  startDay: number;
  endDay: number;
  progress: number;
  category: string;
}

const STATUS_COLORS: Record<string, string> = {
  COTIZACION: "bg-warning-bg text-warning border-warning/20",
  EJECUCION: "bg-success-bg text-success border-success/20",
  FINALIZADO: "bg-info-bg text-info border-info/20",
  PAUSADO: "bg-error-bg text-error border-error/20",
};

export default function PhysicalFinancialDashboard() {
  const store = useStore();
  const projects = store.projects.items;
  const allTransactions = store.transactions.items;
  const [selectedId, setSelectedId] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const printRef = useRef<HTMLDivElement>(null);

  const active = projects.filter(p => p.status === "EJECUCION" || p.status === "FINALIZADO");
  const selected = selectedId === "ALL" ? null : active.find(p => p.id === selectedId);
  const displayProjects = selected ? active.filter(p => p.id === selectedId) : active;

  const lineItems = useMemo(() => {
    return displayProjects.map(project => {
      const txExpense = PMath.sum(allTransactions.filter(t => t.projectId === project.id && t.type === "GASTO").map(t => t.amount || 0));
      const budgetItems: LineItemSpend[] = (project.items || []).map((item: any, idx: number) => {
        const qty = item.projectQuantity || 1;
        const matTotal = (item.materials || []).reduce((s: number, m: any) => s + ((m.quantity || 0) * (m.price || 0) * qty), 0);
        const laborTotal = (item.labor || []).reduce((s: number, l: any) => s + ((l.quantity || 0) * (l.dailyWage || 0) * qty), 0);
        const eqTotal = (item.equipment || []).reduce((s: number, e: any) => s + ((e.quantity || 0) * (e.hourlyRate || 0) * qty), 0);
        const total = matTotal + laborTotal + eqTotal;
        const durDays = item.durationDays || Math.max(1, Math.ceil(qty / 5));
        const cat = item.category || "General";
        return {
          code: item.code || `L${idx + 1}`,
          description: item.description || item.name || item.code || `Renglón ${idx + 1}`,
          unit: item.unit || "U",
          quantity: qty,
          plannedCost: total,
          actualCost: total * ((project.progress || 0) / 100),
          duration: durDays,
          startDay: idx * 2,
          endDay: idx * 2 + durDays,
          progress: item.progress || project.progress || 0,
          category: cat,
        };
      });
      const totalPlanned = budgetItems.reduce((s, i) => s + i.plannedCost, 0);
      const totalActual = budgetItems.reduce((s, i) => s + i.actualCost, 0);
      return { project, items: budgetItems, totalPlanned, totalActual, txExpense };
    });
  }, [displayProjects, allTransactions]);

  const totalPlanned = useMemo(() => lineItems.reduce((s, li) => s + li.totalPlanned, 0), [lineItems]);
  const totalActual = useMemo(() => lineItems.reduce((s, li) => s + li.totalActual, 0), [lineItems]);
  const totalTxExpense = useMemo(() => lineItems.reduce((s, li) => s + li.txExpense, 0), [lineItems]);
  const overallProgress = displayProjects.length > 0
    ? Math.round(displayProjects.reduce((s, p) => s + (p.progress || 0), 0) / displayProjects.length)
    : 0;
  const maxDays = useMemo(() => Math.max(1, ...lineItems.flatMap(li => li.items.map(i => i.endDay))), [lineItems]);

  const handleExportPDF = () => {
    const p = displayProjects[0];
    if (p) {
      generateProgressReport(p as any, lineItems[0]?.items as any || []);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (active.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-n-400">
        <Building2 size={48} className="text-n-300" />
        <h2 className="text-lg font-bold text-n-500">Sin proyectos en ejecución</h2>
        <p className="text-sm text-n-400">Los proyectos deben estar en estado EJECUCIÓN para mostrar el dashboard físico-financiero</p>
      </div>
    );
  }

  return (
    <div ref={printRef} className="flex flex-col h-full">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Físico-Financiero</h1>
          <p className="page-subtitle">Avance de obra · Costos por renglón · Proyección</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="select w-auto text-xs"
            title="Seleccionar proyecto"
          >
            <option value="ALL">Todos los proyectos</option>
            {active.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="flex bg-n-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("chart")}
              className={cn("px-3 py-1.5 rounded-md text-xs font-bold transition-all", viewMode === "chart" ? "bg-white shadow-sm text-n-800" : "text-n-500 hover:text-n-700")}
            >
              <BarChart3 size={14} className="inline mr-1" />Gráfico
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn("px-3 py-1.5 rounded-md text-xs font-bold transition-all", viewMode === "table" ? "bg-white shadow-sm text-n-800" : "text-n-500 hover:text-n-700")}
            >
              Tabla
            </button>
          </div>
          <button onClick={handlePrint} className="btn-outline btn-sm">
            <Printer size={14} /> Imprimir
          </button>
          <button onClick={handleExportPDF} className="btn-accent btn-sm">
            <FileDown size={14} /> Exportar PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card accent="execution" padding="md">
          <p className="text-xs font-semibold uppercase tracking-wider text-n-500">Proyectos activos</p>
          <p className="text-2xl font-extrabold text-n-900 mt-1">{active.length}</p>
        </Card>
        <Card accent="inventory" padding="md">
          <p className="text-xs font-semibold uppercase tracking-wider text-n-500">Avance físico promedio</p>
          <p className="text-2xl font-extrabold text-n-900 mt-1">{overallProgress}%</p>
        </Card>
        <Card accent="seguimiento" padding="md">
          <p className="text-xs font-semibold uppercase tracking-wider text-n-500">Costo planificado</p>
          <p className="text-2xl font-extrabold text-n-900 mt-1">{fmtQ(totalPlanned)}</p>
        </Card>
        <Card accent="projects" padding="md">
          <p className="text-xs font-semibold uppercase tracking-wider text-n-500">Costo real</p>
          <p className="text-2xl font-extrabold text-n-900 mt-1">{fmtQ(totalTxExpense)}</p>
        </Card>
      </div>

      <div className="flex-1 overflow-auto space-y-4">
        {lineItems.map(({ project, items, totalPlanned: tp, totalActual: ta, txExpense }) => (
          <Card key={project.id} accent="execution" padding="none" className="print:break-inside-avoid">
            <CardHeader
              className="px-4 py-3 border-b border-border"
              action={
                <span className={cn("badge", STATUS_COLORS[project.status as string] || "badge-neutral")}>
                  {project.status}
                </span>
              }
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-mod-execution/10 flex items-center justify-center text-mod-execution shrink-0">
                  <Building2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-n-800">{project.name}</h3>
                  <p className="text-[10px] font-medium text-n-500">{items.length} renglones · {fmtQ(tp)} planificado</p>
                </div>
              </div>
            </CardHeader>

            <div className="px-4 py-3 grid grid-cols-3 gap-4 border-b border-border bg-n-50/50">
              <div>
                <p className="text-[10px] font-bold text-n-500 uppercase tracking-wider">Costo planificado</p>
                <p className="text-lg font-extrabold text-n-900">{fmtQ(tp)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-n-500 uppercase tracking-wider">Costo real</p>
                <p className="text-lg font-extrabold text-n-900">{fmtQ(ta)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-n-500 uppercase tracking-wider">Gastos registrados</p>
                <p className="text-lg font-extrabold text-n-900">{fmtQ(txExpense)}</p>
              </div>
            </div>

            {viewMode === "chart" ? (
              <div className="p-4 overflow-x-auto">
                <div className="relative" style={{ minWidth: `${Math.max(items.length * 60, 600)}px` } as React.CSSProperties}>
                  <div className="flex mb-1 text-[9px] font-bold text-n-400 uppercase tracking-wider">
                    <div className="w-48 shrink-0 pl-2">Renglón</div>
                    {Array.from({ length: Math.ceil(maxDays / 5) + 1 }, (_, i) => (
                      <div key={i} className="flex-1 text-center border-l border-border-light">{i * 5}d</div>
                    ))}
                  </div>
                  {items.map((item, idx) => {
                    const barLeft = (item.startDay / maxDays) * 100;
                    const barWidth = Math.max((item.duration / maxDays) * 100, 2);
                    const barPct = items.length > 1 ? `${Math.max(32 / items.length, 16)}px` : "32px";
                    return (
                      <div key={item.code} className="flex items-center h-8 group hover:bg-n-50 rounded transition-colors">
                        <div className="w-48 shrink-0 flex items-center gap-2 pl-2 truncate">
                          <span className="text-[10px] font-mono font-bold text-n-400">{item.code}</span>
                          <span className="text-xs text-n-700 truncate">{item.description}</span>
                        </div>
                        <div className="flex-1 relative h-7">
                          <div className="absolute inset-y-2 left-0 right-0 bg-n-100 rounded" />
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ duration: 0.6, delay: idx * 0.03, ease: "easeOut" }}
                            className="absolute inset-y-1.5 rounded flex items-center justify-end px-1"
                            style={{
                              left: `${barLeft}%`,
                              background: item.actualCost > item.plannedCost
                                ? "linear-gradient(90deg, #f43f5e, #ef4444)"
                                : "linear-gradient(90deg, #10b981, #059669)",
                              opacity: 0.85,
                            }}
                          >
                            <span className="text-[8px] font-bold text-white drop-shadow-sm">{fmtQ(item.plannedCost)}</span>
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th>Und</th>
                      <th>Cant.</th>
                      <th>Costo Plan.</th>
                      <th>Costo Real</th>
                      <th>Duración</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Avance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.code}>
                        <td className="font-mono font-bold text-n-500">{item.code}</td>
                        <td className="text-n-700">{item.description}</td>
                        <td className="text-n-500">{item.unit}</td>
                        <td className="font-mono">{item.quantity}</td>
                        <td className="font-mono font-bold text-n-800">{fmtQ(item.plannedCost)}</td>
                        <td className={cn("font-mono font-bold", item.actualCost > item.plannedCost ? "text-error" : "text-success")}>{fmtQ(item.actualCost)}</td>
                        <td className="font-mono">{item.duration}d</td>
                        <td className="font-mono">día {item.startDay}</td>
                        <td className="font-mono">día {item.endDay}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div                   className="w-16 h-1.5 bg-n-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-accent transition-all progress-fill-dynamic"
                                style={{ '--w': `${Math.min(item.progress, 100)}%` } as React.CSSProperties}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-n-500">{item.progress}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-n-50 font-bold">
                      <td colSpan={4} className="text-n-700 uppercase text-[10px]">Totales</td>
                      <td className="font-mono text-n-800">{fmtQ(tp)}</td>
                      <td className="font-mono text-n-800">{fmtQ(ta)}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
