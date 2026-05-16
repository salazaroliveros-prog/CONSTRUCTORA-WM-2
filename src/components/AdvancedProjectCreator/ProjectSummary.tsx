/**
 * ProjectSummary - Panel de resumen de costos profesional
 * Desglose completo: directos, indirectos, IVA, margen, contingencia
 * Panel de sensibilidad, alertas de desviación, BOM
 */

import React, { useState, useMemo } from 'react';
import {
  FileDown, Printer, TrendingUp, Package, Users, AlertTriangle,
  BarChart3, ShieldAlert, Box, Calculator, Percent, Receipt,
  TrendingDown, TrendingUp as TrendUp
} from 'lucide-react';
import { BudgetItem, SensitivityScenario } from '../../types/budget';
import { BudgetLine } from '../../lib/budgetData';
import { calculateSensitivity, checkDeviations, Deviation, precise, fmtQ } from '../../engine/budgetEngine';

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface ProfessionalTotals {
  totalDirect: number;
  materialsTotal: number;
  laborTotal: number;
  equipmentTotal: number;
  wasteMaterials: number;
  wasteLabor: number;
  indirectCost: number;
  adminCost: number;
  personalCost: number;
  baseBudget: number;
  totalBudget: number;
  costPerM2: number;
  taxTotal: number;
  profitTotal: number;
  contingencyTotal: number;
}

interface ProjectSummaryProps {
  items: BudgetItem[];
  totals: ProfessionalTotals;
  budgetLines?: BudgetLine[];
  estimatedDays: number;
  projectName: string;
  clientName: string;
  onExportPDF: (type: 'completo' | 'ejecutivo' | 'apu' | 'cliente') => void;
  onExportJSON: () => void;
  onSaveProject: () => void;
  isSaving: boolean;
  transactions?: any[];
}

function formatQ(value: number): string {
  return fmtQ(value);
}

function fmtPct(value: number): string {
  return new Intl.NumberFormat('es-GT', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

// ─── Componente principal ───────────────────────────────────────────────────
export function ProjectSummary({
  items,
  totals,
  budgetLines,
  estimatedDays,
  projectName,
  clientName,
  onExportPDF,
  onExportJSON,
  onSaveProject,
  isSaving,
  transactions
}: ProjectSummaryProps) {
  const totalItems = items.length;
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  const {
    totalDirect, materialsTotal, laborTotal, equipmentTotal,
    wasteMaterials, wasteLabor, indirectCost, adminCost, personalCost,
    baseBudget, totalBudget, costPerM2, taxTotal, profitTotal, contingencyTotal,
  } = totals;

  // ── Escenarios de sensibilidad predefinidos ──────────────────────────────
  const sensitivityScenarios = useMemo<SensitivityScenario[]>(() => {
    if (!budgetLines?.length) return [];
    const scenarios = [
      { name: 'Base', materialVar: 0, laborVar: 0 },
      { name: 'Material +10%', materialVar: 10, laborVar: 0 },
      { name: 'Material +20%', materialVar: 20, laborVar: 0 },
      { name: 'MO +10%', materialVar: 0, laborVar: 10 },
      { name: 'MO -5%', materialVar: 0, laborVar: -5 },
      { name: 'Mat +15% / MO +8%', materialVar: 15, laborVar: 8 },
    ];
    return calculateSensitivity(budgetLines, scenarios);
  }, [budgetLines]);

  // ── Alertas de desviación ────────────────────────────────────────────────
const deviations = useMemo<ReturnType<typeof checkDeviations>>(() => {
     if (!budgetLines?.length) return [];
     return checkDeviations(budgetLines as BudgetLine[], {}, 5);
  }, [budgetLines]);

  // ── Gastos reales desde transacciones (Budget vs Actual) ─────────────────
  const actualExpenses = useMemo(() => {
    if (!transactions?.length) return 0;
    return transactions
      .filter((t: any) => t.type === 'GASTO')
      .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
  }, [transactions]);

  const budgetVsActual = totalBudget > 0
    ? ((actualExpenses - totalBudget) / totalBudget) * 100
    : 0;

  return (
    <div className="space-y-4 mb-6">
      {/* ── Panel principal de costos ──────────────────────────────────────── */}
      <div className="bg-neutral-900/40 rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-emerald-500" />
            <h2 className="text-sm font-black uppercase text-slate-800">Resumen de Costos</h2>
          </div>
          <div className="flex items-center gap-2">
<button onClick={() => setShowSensitivity(v => !v)}
               aria-label={`${showSensitivity ? 'Ocultar' : 'Mostrar'} análisis de sensibilidad`}
               className={`flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-bold uppercase rounded transition-colors ${showSensitivity ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
               <BarChart3 size={10} aria-hidden="true" /> Sensibilidad
             </button>
             <button onClick={() => setShowAlerts(v => !v)}
               aria-label={`${showAlerts ? 'Ocultar' : 'Mostrar'} alertas de desviación`}
               className={`flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-bold uppercase rounded transition-colors ${showAlerts ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
               <ShieldAlert size={10} aria-hidden="true" /> Alertas ({deviations.length})
             </button>
            <button onClick={() => onExportPDF('completo')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-bold uppercase bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors">
              <FileDown size={10} /> PDF
            </button>
            <button onClick={() => onExportPDF('apu')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-bold uppercase bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors">
              <Printer size={10} /> APU
            </button>
            <button onClick={onExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-bold uppercase bg-cyan-100 text-cyan-700 rounded hover:bg-cyan-200 transition-colors">
              <FileDown size={10} /> JSON
            </button>
            <button onClick={onSaveProject} disabled={isSaving || totalItems === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-bold uppercase bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* ── KPIs financieros principales ────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-900 rounded-xl p-3 text-white">
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Presupuesto Total</p>
            <p className="text-xl font-black">{formatQ(totalBudget)}</p>
            {costPerM2 > 0 && (
              <p className="text-[8px] text-slate-400 mt-1">Q {costPerM2.toFixed(0)}/m²</p>
            )}
          </div>
          <div className="bg-black/20 rounded-xl p-3 border border-slate-200">
            <p className="text-[7px] font-bold text-slate-500 uppercase mb-1">Costo Directo</p>
            <p className="text-lg font-black text-slate-800">{formatQ(totalDirect)}</p>
            <p className="text-[7px] text-slate-400 mt-0.5">{Math.round((totalDirect / (totalBudget || 1)) * 100)}% del total</p>
          </div>
          <div className="bg-black/20 rounded-xl p-3 border border-slate-200">
            <p className="text-[7px] font-bold text-slate-500 uppercase mb-1">Duración</p>
            <p className="text-lg font-black text-slate-800">{Math.ceil(estimatedDays)} días</p>
            <p className="text-[7px] text-slate-400 mt-0.5">{Math.ceil(estimatedDays / 6)} semanas</p>
          </div>
          <div className="bg-black/20 rounded-xl p-3 border border-slate-200">
            <p className="text-[7px] font-bold text-slate-500 uppercase mb-1">Renglones</p>
            <p className="text-lg font-black text-slate-800">{totalItems}</p>
            <p className="text-[7px] text-slate-400 mt-0.5">{items.filter(i => i.materials?.length).length} con materiales</p>
          </div>
        </div>

        {/* ── Desglose detallado de costos ────────────────────────────────── */}
        <div className="bg-black/20 rounded-xl p-3 border border-slate-200">
          <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-3">ESTRUCTURA DE COSTOS</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-4 text-[9px]">
            <CostRow icon={<Package size={10} className="text-blue-500" />} label="Materiales" value={materialsTotal} pct={totalDirect} />
            <CostRow icon={<Users size={10} className="text-purple-500" />} label="Mano de Obra" value={laborTotal} pct={totalDirect} />
            <CostRow icon={<Box size={10} className="text-amber-500" />} label="Equipo" value={equipmentTotal} pct={totalDirect} />
            <CostRow icon={<AlertTriangle size={10} className="text-red-400" />} label="Desperdicios" value={wasteMaterials + wasteLabor} pct={totalDirect} />
            <CostRow icon={<Receipt size={10} className="text-orange-500" />} label="IVA (12%)" value={taxTotal} pct={totalBudget} />
            <CostRow icon={<TrendUp size={10} className="text-green-600" />} label="Margen (15%)" value={profitTotal} pct={totalBudget} />
            <CostRow icon={<ShieldAlert size={10} className="text-amber-600" />} label="Contingencia (5%)" value={contingencyTotal} pct={totalBudget} />
            <CostRow icon={<Percent size={10} className="text-indigo-500" />} label="Indirectos" value={indirectCost + adminCost + personalCost} pct={totalBudget} />
          </div>
        </div>

        {/* ── Presupuesto vs Real ────────────────────────────────────────── */}
        {actualExpenses > 0 && (
          <div className={`mt-3 p-3 rounded-xl border ${budgetVsActual > 10 ? 'bg-red-50 border-red-200' : budgetVsActual < -10 ? 'bg-green-50 border-green-200' : 'bg-black/20 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {budgetVsActual > 10 ? <TrendingUp size={14} className="text-red-500" /> : <TrendingDown size={14} className="text-green-500" />}
                <span className="text-[8px] font-bold text-slate-600 uppercase">Ejecutado vs Presupuesto</span>
              </div>
              <span className={`text-[10px] font-black ${budgetVsActual > 10 ? 'text-red-600' : 'text-green-600'}`}>
                {fmtPct(budgetVsActual)}
              </span>
            </div>
            <div className="flex gap-4 mt-1 text-[9px]">
              <span className="text-slate-500">Presupuestado: <strong>{formatQ(totalBudget)}</strong></span>
              <span className="text-slate-500">Ejecutado: <strong>{formatQ(actualExpenses)}</strong></span>
              <span className="text-slate-500">Diferencia: <strong className={budgetVsActual > 0 ? 'text-red-600' : 'text-green-600'}>{formatQ(actualExpenses - totalBudget)}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* ── Panel de Análisis de Sensibilidad ─────────────────────────────── */}
      {showSensitivity && sensitivityScenarios.length > 0 && (
        <div className="bg-neutral-900/40 rounded-xl shadow-sm border border-amber-200 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-amber-500" />
            <h3 className="text-[10px] font-black text-slate-800 uppercase">Análisis de Sensibilidad</h3>
            <span className="text-[7px] text-slate-400">¿Qué pasa si los precios cambian?</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {sensitivityScenarios.map((s, i) => {
              const isBase = i === 0;
              const isUp = s.difference > 0;
              return (
                <div key={i} className={`rounded-xl p-3 border ${isBase ? 'bg-slate-900 text-white border-slate-900' : isUp ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <p className={`text-[7px] font-bold uppercase mb-1 ${isBase ? 'text-slate-400' : 'text-slate-500'}`}>{s.name}</p>
                  <p className={`text-sm font-black ${isBase ? 'text-white' : isUp ? 'text-red-600' : 'text-green-600'}`}>{formatQ(s.total)}</p>
                  {!isBase && (
                    <p className={`text-[8px] font-bold mt-0.5 ${isUp ? 'text-red-500' : 'text-green-500'}`}>
                      {isUp ? '▲' : '▼'} {fmtPct(s.diffPercent)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Panel de Alertas de Desviación ────────────────────────────────── */}
      {showAlerts && deviations.length > 0 && (
        <div className="bg-neutral-900/40 rounded-xl shadow-sm border border-red-200 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={16} className="text-red-500" />
            <h3 className="text-[10px] font-black text-slate-800 uppercase">Alertas de Desviación</h3>
            <span className="text-[7px] text-slate-400">{deviations.length} renglón(es) fuera de rango</span>
          </div>
          <div className="space-y-1.5">
            {deviations.map((d, i) => (
              <div key={i} className={`flex items-center justify-between p-2 rounded-lg text-[9px] ${
                d.severity === 'critical' ? 'bg-red-100 text-red-700' :
                d.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                d.severity === 'medium' ? 'bg-amber-50 text-amber-700' :
                'bg-yellow-50 text-yellow-700'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{d.code}</span>
                  <span className="text-slate-600">{d.description}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Presup: {fmtQ(d.budgeted)}</span>
                  <span>Real: {fmtQ(d.actual)}</span>
                  <span className={`font-black ${d.deviationPct > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {d.deviationPct.toFixed(1)}%
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[7px] font-bold uppercase ${
                    d.severity === 'critical' ? 'bg-red-600 text-white' :
                    d.severity === 'high' ? 'bg-orange-600 text-white' :
                    d.severity === 'medium' ? 'bg-amber-500 text-white' :
                    'bg-yellow-500 text-white'
                  }`}>{d.severity}</span>
                </div>
              </div>
            ))}
          </div>
          {deviations.length === 0 && (
            <p className="text-[9px] text-green-600 font-bold">✓ Todos los renglones dentro del rango esperado</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente auxiliar de fila de costo ────────────────────────────────────
function CostRow({ icon, label, value, pct }: { icon: React.ReactNode; label: string; value: number; pct: number }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-slate-600 font-medium">{label}</span>
      </div>
      <div className="text-right">
        <span className="font-bold text-slate-800">{formatQ(value)}</span>
        {pct > 0 && (
          <span className="text-slate-400 ml-1">({Math.round((value / pct) * 100)}%)</span>
        )}
      </div>
    </div>
  );
}

