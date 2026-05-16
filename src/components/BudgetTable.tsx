/**
 * BudgetTable v4 - Motor de Ingenieria de Costos Unificado
 * Refactorizado con Budget Engine v3:
 * - Usa calculateProject() como unica fuente de verdad
 * - Inline editing con precision ilimitada
 * - Visualizacion de acero de refuerzo
 * - Desviaciones en tiempo real
 * - Conexion directa a todos los modulos
 */

import React, { useState, useCallback, memo, useRef, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, Pencil, Trash2, Plus, Check, X, GitBranch, Zap, AlertTriangle } from 'lucide-react';
import { BudgetLine } from '../lib/budgetData';
import { toast } from 'sonner';
import { DimensionEditor } from './BudgetTable/DimensionEditor';
import {
  calculateProject,
  calculateTree,
  calcDynamicQty,
  calcSteelReinforcement,
  LineResult,
  BudgetTotals,
  ENGINEERING,
  fmtQ,
  fmtInput,
  fmtQty,
  fmtQtyScientific,
  parseQtyInput,
  validateQty,
  precise,
  PMath,
} from '../engine/budgetEngine';

interface BudgetTableProps {
  lines: BudgetLine[];
  projectQty: number;
  onUpdate: (lines: BudgetLine[]) => void;
  onAddCustom: () => void;
  editingAllowed?: boolean;
  marketMultipliers?: { material: number; labor: number } | null;
  wasteFactors?: { materials: number; labor: number } | null;
  showDeviations?: boolean;
}

// ─── Formateo para Guatemala ───────────────────────────────────────────────────
const fmtMoney = (v: number): string => v <= 0 ? '—' : fmtQ(v);
const fmtPct = (v: number): string => v <= 0 ? '—' : `${(v * 100).toFixed(0)}%`;
const fmtDev = (v: number): string => v === 0 ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

// ─── Componente de celda editable inline ──────────────────────────────────────
const InlineEdit = memo(function InlineEdit({
   value, display, type, onCommit, disabled, id, label,
}: {
   value: string | number;
   display: string;
   type?: 'text' | 'number' | 'percent';
   onCommit: (v: number) => void;
   disabled?: boolean;
   id?: string;
   label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select(); } }, [editing]);

    if (disabled) return <span className="text-[9px] text-[var(--color-neutral-400)]">{display}</span>;
if (editing) {
     return (
       <div className="inline-flex items-center gap-0.5">
         <label className="sr-only" htmlFor={`inline-input-${id}`}>{label || 'Editar valor'}</label>
         <input id={`inline-input-${id}`} ref={ref} type="text" inputMode="decimal" aria-label={label || 'Editar valor'}
           value={draft} onChange={e => setDraft(e.target.value)}
           onKeyDown={e => {
             if (e.key === 'Enter') { const n = parseQtyInput(draft); if (validateQty(n) || n === 0) onCommit(n); setEditing(false); }
             if (e.key === 'Escape') setEditing(false);
           }}
           onBlur={() => { const n = parseQtyInput(draft); if (validateQty(n) || n === 0) onCommit(n); setEditing(false); }}
           className="w-20 text-[9px] text-right px-1 py-0.5 border border-[color-mix(in_srgb,var(--color-info)_40%,transparent)] rounded bg-[var(--color-surface-solid)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)] font-mono tabular-nums"
         />
<button aria-label="Confirmar" onClick={() => { const n = parseQtyInput(draft); if (validateQty(n) || n === 0) onCommit(n); setEditing(false); }} className="p-0.5 text-[var(--color-success)] hover:text-[color-mix(in_srgb,var(--color-success)_80%,black)]"><Check size={10} /></button>
          <button aria-label="Cancelar" onClick={() => setEditing(false)} className="p-0.5 text-[var(--color-error)] hover:text-[color-mix(in_srgb,var(--color-error)_80%,black)]"><X size={10} /></button>
       </div>
     );
   }
  return (
     <span className="text-[9px] text-right cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] px-1 rounded text-[var(--color-neutral-600)] hover:text-[var(--color-neutral-900)] tabular-nums"
      onClick={() => {
        const raw = typeof value === 'number' ? String(value) : value;
        setDraft(type === 'percent' && typeof value === 'number' ? String(Math.round(value * 100)) : raw);
        setEditing(true);
      }}
      title="Click para editar">{display}</span>
  );
});

// ─── Fila individual de presupuesto ────────────────────────────────────────────
const BudgetRow = memo(function BudgetRow({
  line, depth, lineResult, isExpanded, onToggle, onEdit,
  onUpdateLine, onDeleteLine, editingAllowed, mm, onSteelClick,
}: {
  line: BudgetLine;
  depth: number;
  lineResult: LineResult | undefined;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onUpdateLine: (l: BudgetLine) => void;
  onDeleteLine: (id: string) => void;
  editingAllowed: boolean;
  mm?: { material: number; labor: number };
  onSteelClick?: (line: BudgetLine, steel: ReturnType<typeof calcSteelReinforcement>) => void;
}) {
  const hasChildren = line.children && line.children.length > 0;
  const r = lineResult;
const hasDeviation = line.actualCost !== undefined && line.actualCost > 0 && line.subtotal;

   const commit = useCallback((field: string, val: number) => {
     const updated = { ...line, [field]: precise(val) };
     onUpdateLine(updated);
   }, [line, onUpdateLine]);

   const deviationPct = hasDeviation
     ? ((line.actualCost! - (line.subtotal || 0)) / (line.subtotal || 1)) * 100
     : 0;

  return (
    <>
      <tr className={`group hover:bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)]/30 transition-colors ${hasDeviation ? 'bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]/20' : ''}`}>
        {/* Renglon */}
        <td className="[padding-left:var(--pl)]" style={{ '--pl': `${depth * 1.5 + 0.5}rem` } as React.CSSProperties}>
          <div className="flex items-center gap-1.5 py-1.5">
{hasChildren ? (
                <button onClick={() => onToggle(line.id)} aria-label={`Expandir renglón ${line.code}`} className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-neutral-200)] transition-colors">
                 {isExpanded ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
               </button>
             ) : <span className="w-5" />}

{line.computationType === 'dynamic' && (
                <span className="text-[8px] text-[var(--color-info)] font-bold" aria-label="Cálculo dinámico por dimensiones"><GitBranch size={9} /></span>
             )}
             {r?.computationType === 'steel' && (
                <span className="text-[8px] text-[var(--color-warning)] font-bold" aria-label="Acero de refuerzo"><Zap size={9} /></span>
             )}

             <span className="text-[9px] font-black text-[var(--color-neutral-700)] uppercase">{line.code}</span>
             <span className="text-[9px] font-bold text-[var(--color-neutral-600)] truncate max-w-[180px]" title={line.description}>{line.description}</span>

            {hasDeviation && (
              <span title={`Desviación: ${(((line.actualCost! - (line.subtotal || 0)) / (line.subtotal || 1)) * 100).toFixed(1)}%`}>
                 <AlertTriangle size={9} className="text-[var(--color-warning)] shrink-0" />
              </span>
            )}
          </div>
        </td>

        {/* Unidad */}
        <td className="text-[9px] text-[var(--color-neutral-500)] text-right font-mono">{line.unit}</td>

        {/* Cantidad */}
{line.computationType === 'dynamic' ? (
           <td className="text-right">
              <button onClick={() => onEdit(line.id)} className="text-[9px] text-[var(--color-info)] font-bold hover:bg-[color-mix(in_srgb,var(--color-info)_15%,transparent)] px-1 rounded" aria-label={`Editar dimensiones de ${line.description}`}>
               {fmtQtyScientific(r?.qty ?? line.qty)} (calc)
             </button>
           </td>
         ) : (
           <td className="text-right">
             {editingAllowed ? (
               <InlineEdit id={`qty-${line.id}`} label={`Cantidad ${line.code}`} value={r?.qty ?? line.qty} display={fmtQty(r?.qty ?? line.qty, 0, 6)} onCommit={v => commit('qty', v)} />
             ) : (
                <span className="text-[9px] text-[var(--color-neutral-600)] tabular-nums">{fmtQty(r?.qty ?? line.qty, 0, 6)}</span>
             )}
           </td>
         )}

        {/* Costo Unitario Material */}
        <td className="text-right">
{editingAllowed ? (
             <InlineEdit id={`mat-${line.id}`} label={`Costo material ${line.code}`} value={r?.materialCost ?? line.materialCost} display={fmtMoney(r?.materialCost ?? line.materialCost)} onCommit={v => commit('materialCost', v)} />
           ) : (
              <span className="text-[9px] text-[var(--color-neutral-500)] tabular-nums">{fmtMoney(r?.materialCost ?? line.materialCost)}</span>
           )}
        </td>

        {/* Costo Unitario Mano de Obra */}
        <td className="text-right">
{editingAllowed ? (
             <InlineEdit id={`lab-${line.id}`} label={`Costo mano de obra ${line.code}`} value={r?.laborCost ?? line.laborCost} display={fmtMoney(r?.laborCost ?? line.laborCost)} onCommit={v => commit('laborCost', v)} />
           ) : (
              <span className="text-[9px] text-[var(--color-neutral-500)] tabular-nums">{fmtMoney(r?.laborCost ?? line.laborCost)}</span>
           )}
        </td>

        {/* Costo Unitario Equipo */}
        <td className="text-right">
{editingAllowed ? (
             <InlineEdit id={`eq-${line.id}`} label={`Costo equipo ${line.code}`} value={line.equipmentCost ?? 0} display={fmtMoney((line.equipmentCost ?? 0))} onCommit={v => commit('equipmentCost', v)} />
           ) : (
              <span className="text-[9px] text-[var(--color-neutral-500)] tabular-nums">{fmtMoney((line.equipmentCost ?? 0))}</span>
           )}
        </td>

        {/* TOTAL MATERIAL */}
        <td className="text-[9px] font-bold text-right text-[var(--color-neutral-800)] bg-[var(--color-neutral-50)]/50 tabular-nums">
           {r ? fmtMoney(r.materialTotal) : '—'}
         </td>

         {/* TOTAL MANO OBRA */}
         <td className="text-[9px] font-bold text-right text-[var(--color-neutral-800)] bg-[var(--color-neutral-50)]/50 tabular-nums">
           {r ? fmtMoney(r.laborTotal) : '—'}
         </td>

         {/* TOTAL EQUIPO */}
         <td className="text-[9px] font-bold text-right text-[var(--color-neutral-800)] bg-[var(--color-neutral-50)]/50 tabular-nums">
           {r ? fmtMoney(r.equipmentTotal) : '—'}
         </td>

         {/* SUBTOTAL */}
         <td className="text-[10px] font-black text-right text-[var(--color-info)] bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)]/30 tabular-nums border-l border-[var(--color-neutral-200)]">
          {r ? fmtMoney(r.totalLine) : '—'}
        </td>

        {/* DÍAS */}
        <td className="text-right">
{editingAllowed ? (
             <InlineEdit id={`dur-${line.id}`} label={`Duración días ${line.code}`} value={line.durationDays ?? 0} display={line.durationDays ? `${line.durationDays}d` : '—'} onCommit={v => commit('durationDays', v)} />
           ) : (
              <span className="text-[9px] text-[var(--color-neutral-500)]">{line.durationDays ? `${line.durationDays}d` : '—'}</span>
           )}
        </td>

        {/* RENDIMIENTO */}
        <td className="text-right">
{editingAllowed ? (
             <InlineEdit id={`perf-${line.id}`} label={`Rendimiento ${line.code}`} value={line.laborPerf ?? 1} display={line.laborPerf && line.laborPerf !== 1 ? fmtPct(line.laborPerf) : '—'} type="percent" onCommit={v => commit('laborPerf', v / 100)} />
           ) : (
              <span className="text-[9px] text-[var(--color-neutral-500)]">{line.laborPerf && line.laborPerf !== 1 ? fmtPct(line.laborPerf) : '—'}</span>
           )}
        </td>

        {/* DESPERDICIO */}
        <td className="text-right">
{editingAllowed ? (
             <InlineEdit id={`waste-${line.id}`} label={`Desperdicio ${line.code}`} value={line.wasteFactor ?? 1} display={line.wasteFactor && line.wasteFactor !== 1 ? `${((line.wasteFactor - 1) * 100).toFixed(0)}%` : '—'} type="percent" onCommit={v => commit('wasteFactor', v / 100)} />
           ) : (
               <span className="text-[9px] text-[var(--color-neutral-500)]">{line.wasteFactor && line.wasteFactor !== 1 ? `${((line.wasteFactor - 1) * 100).toFixed(0)}%` : '—'}</span>
           )}
        </td>

        {/* ÍNDICE MERCADO */}
        <td className="text-right">
{editingAllowed ? (
             <InlineEdit id={`mkt-${line.id}`} label={`Índice mercado ${line.code}`} value={line.marketPriceIndex ?? 1} display={line.marketPriceIndex && line.marketPriceIndex !== 1 ? fmtPct(line.marketPriceIndex) : '—'} type="percent" onCommit={v => commit('marketPriceIndex', v / 100)} />
           ) : (
              <span className="text-[9px] text-[var(--color-neutral-500)]">{line.marketPriceIndex && line.marketPriceIndex !== 1 ? fmtPct(line.marketPriceIndex) : '—'}</span>
           )}
        </td>

        {/* ACERO */}
        <td className="text-center">
          {r?.steelInfo && (
             <span className="text-[8px] text-[var(--color-warning)] font-bold cursor-pointer" onClick={() => onSteelClick?.(line, r.steelInfo! as ReturnType<typeof calcSteelReinforcement>)}
              title={`Acero: Ø${r.steelInfo.diameter}mm, ${r.steelInfo.totalBars} var, ${r.steelInfo.weight.toFixed(1)}kg`}>
              Ø{r.steelInfo.diameter}
            </span>
          )}
        </td>

        {/* DESVIACIÓN */}
{hasDeviation && (
           <td className="text-[9px] text-right">
              <span className={`font-bold ${deviationPct > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]'}`} aria-label={`Desviación ${deviationPct.toFixed(1)}%`}>
               {fmtDev(deviationPct)}
             </span>
           </td>
         )}

        {/* ACCIONES */}
        {editingAllowed && (
          <td className="text-right">
{line.computationType === 'dynamic' && (
              <button onClick={() => onEdit(line.id)} aria-label={`Editar dimensiones de ${line.code}`} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-neutral-200)] transition-all" title="Editar dimensiones"><Pencil size={11} /></button>
           )}
           <button onClick={() => {
             const kids = line.children?.length ?? 0;
             toast(`¿Eliminar "${line.description}"${kids > 0 ? ` y sus ${kids} sub-renglones` : ''}?`, {
               action: { label: 'Eliminar', onClick: () => onDeleteLine(line.id) },
               cancel: { label: 'Cancelar', onClick: () => {} },
             });
            }} aria-label={`Eliminar ${line.description}`} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--color-error)_15%,transparent)] text-[var(--color-error)] transition-all" title="Eliminar"><Trash2 size={11} /></button>
          </td>
        )}
      </tr>

      {/* Editor de dimensiones */}
      {editingAllowed && line.computationType === 'dynamic' && (
         <tr key={`${line.id}_dim`} className="bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] border-t border-[color-mix(in_srgb,var(--color-info)_20%,transparent)]">
          <td colSpan={12 + (hasDeviation ? 1 : 0) + (editingAllowed ? 1 : 0)} className="p-0">
            <DimensionEditor line={line} onUpdate={onUpdateLine} onClose={() => onEdit(line.id)} />
          </td>
        </tr>
      )}

      {/* Hijos recursivos */}
      {hasChildren && isExpanded && line.children!.map(child => (
        <BudgetRow key={child.id} line={child} depth={depth + 1}
          lineResult={undefined} isExpanded={false}
          onToggle={onToggle} onEdit={onEdit} onUpdateLine={onUpdateLine} onDeleteLine={onDeleteLine}
          editingAllowed={editingAllowed} mm={mm} onSteelClick={onSteelClick} />
      ))}
    </>
  );
});

// ─── Modal de acero de refuerzo ─────────────────────────────────────────────────
const SteelModal = memo(function SteelModal({
  line, steel, onClose,
}: { line: BudgetLine; steel: ReturnType<typeof calcSteelReinforcement>; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--color-surface-solid)] rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-black text-[var(--color-neutral-800)] uppercase mb-4">Acero de Refuerzo — {line.description}</h3>
        <div className="grid grid-cols-2 gap-3 text-[10px]">
          {[
            ['Ratio de acero', `${(steel.ratio * 100).toFixed(2)}%`],
            ['Diámetro varilla', `Ø ${steel.diameter} mm`],
            ['Largo varilla', `${steel.barLength.toFixed(2)} m`],
            ['Total varillas', `${steel.totalBars} uds`],
            ['Peso total acero', `${steel.weight.toFixed(2)} kg`],
            ['Costo acero', fmtQ(steel.cost)],
          ].map(([label, value]) => (
            <div key={label} className="bg-[var(--color-neutral-50)] rounded-lg p-2">
              <div className="text-[var(--color-neutral-500)] text-[8px] uppercase">{label}</div>
              <div className="text-[var(--color-neutral-800)] font-bold">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] rounded-lg p-3 border border-[color-mix(in_srgb,var(--color-warning)_20%,transparent)]">
          <div className="text-[9px] font-bold text-[var(--color-warning)] mb-1">Densidad del acero</div>
          <div className="text-[10px] text-[var(--color-neutral-600)]">{ENGINEERING.densities.steel} kg/m³ — Ratio aplicado según tipología</div>
        </div>
        <button onClick={onClose} className="mt-4 w-full px-4 py-2 text-[10px] font-bold uppercase bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] rounded-lg hover:bg-[var(--color-neutral-200)]">Cerrar</button>
      </div>
    </div>
  );
});

// ─── Componente principal ───────────────────────────────────────────────────────
export default function BudgetTable({
  lines, projectQty, onUpdate, onAddCustom, editingAllowed = true,
  marketMultipliers, wasteFactors, showDeviations = false,
}: BudgetTableProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [steelModal, setSteelModal] = useState<{ line: BudgetLine; steel: ReturnType<typeof calcSteelReinforcement> } | null>(null);

  const mm = marketMultipliers;

  // ─── Motor de calculo centralizado ────────────────────────────────────────────
  const calculation = useMemo(() => {
    const result = calculateProject(lines, { marketMultipliers: mm });
    const byId = new Map<string, LineResult>();
    result.lines.forEach(r => byId.set(r.id, r));
    return { result, byId };
  }, [lines, mm]);

  const { result, byId } = calculation;

  // ─── Helper de actualización recursiva ───────────────────────────────────────
  const updateLineRecursive = useCallback((list: BudgetLine[], updated: BudgetLine, propagate = false): BudgetLine[] => {
    return list.map(l => {
      if (l.id === updated.id) return updated;
      if (l.children?.length) {
        let kids = updateLineRecursive(l.children, updated, true);
        if (propagate && updated.qty !== l.qty && updated.qty > 0 && kids.length > 0) {
          const prop = updated.qty / l.qty;
          kids = kids.map(c => ({ ...c, qty: precise(c.qty * prop) }));
        }
        return { ...l, children: kids };
      }
      return l;
    });
  }, []);

  const handleUpdateLine = useCallback((updated: BudgetLine) => {
    const next = updateLineRecursive(lines, updated, true);
    onUpdate(next);
  }, [lines, onUpdate, updateLineRecursive]);

  const handleDeleteLine = useCallback((id: string) => {
    const next = (list: BudgetLine[]): BudgetLine[] =>
      list.filter(l => l.id !== id).map(l => l.children?.length ? { ...l, children: next(l.children) } : l);
    const deleted = lines.some(l => l.id === id || (l.children?.some(c => c.id === id)));
    if (deleted) { onUpdate(next(lines)); toast.success('Renglón eliminado'); }
  }, [lines, onUpdate]);

  const toggleExpand = useCallback((id: string) =>
    setExpanded(p => ({ ...p, [id]: !p[id] })), []);

  // ─── Totales consolidados ─────────────────────────────────────────────────────
  const t = result;

  return (
    <div className="overflow-x-auto">
      {/* Resumen de totales */}
      <div className="grid grid-cols-6 gap-2 mb-4 p-3 bg-[var(--color-neutral-50)] rounded-lg">
        {[
          ['Materiales', t.materialTotal, 'text-[var(--color-info)]'],
          ['Mano Obra', t.laborTotal, 'text-[var(--color-success)]'],
          ['Equipo', t.equipmentTotal, 'text-[var(--color-neutral-700)]'],
          ['Desperdicio', t.wasteTotal, 'text-[var(--color-warning)]'],
          ['IVA + Margen + Imprev.', PMath.sum([t.taxTotal, t.profitTotal, t.contingencyTotal]), 'text-[var(--color-secondary-dark)]'],
          ['TOTAL PRESUPUESTO', t.totalBudget, 'text-[color-mix(in_srgb,var(--color-info)_80%,black)] font-black'],
        ].map(([label, value, color]) => (
          <div key={label} className="text-center">
            <div className="text-[8px] text-[var(--color-neutral-500)] uppercase">{label}</div>
            <div className={`text-[11px] font-bold ${color} tabular-nums`}>{fmtQ(value as number)}</div>
          </div>
        ))}
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[var(--color-neutral-300)] bg-[var(--color-neutral-100)]">
            {['Renglón', 'Un', 'Cant', 'CMat', 'CMO', 'CEq', 'TotMat', 'TotMO', 'TotEq', 'Subtotal', 'Días', 'Rend%', 'Desp%', 'Mdo%', 'Acero'].concat(showDeviations ? ['Desv'] : []).concat(editingAllowed ? ['Acc'] : []).map((h, i) => (
              <th key={i} className="px-2 py-1.5 text-[8px] font-black text-[var(--color-neutral-600)] uppercase tracking-wider text-right first:text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map(line => (
            <BudgetRow key={line.id} line={line} depth={0} lineResult={byId.get(line.id)}
              isExpanded={expanded[line.id] || false}
              onToggle={toggleExpand} onEdit={id => setEditingId(prev => prev === id ? null : id)}
              onUpdateLine={handleUpdateLine} onDeleteLine={handleDeleteLine}
              editingAllowed={editingAllowed} mm={mm}
              onSteelClick={(l, s) => setSteelModal({ line: l, steel: s })} />
          ))}

          {/* Fila de totales generales */}
          <tr className="border-t-2 border-[var(--color-neutral-400)] bg-[var(--color-neutral-100)] font-black">
            <td className="px-4 py-2 text-[10px] text-[var(--color-neutral-800)] uppercase tracking-wider" colSpan={3}>
              TOTALES GENERALES
            </td>
            <td colSpan={3} />
            <td className="px-4 py-2 text-[10px] text-right text-[var(--color-neutral-800)]">{fmtQ(t.materialTotal)}</td>
            <td className="px-4 py-2 text-[10px] text-right text-[var(--color-neutral-800)]">{fmtQ(t.laborTotal)}</td>
            <td className="px-4 py-2 text-[10px] text-right text-[var(--color-neutral-800)]">{fmtQ(t.equipmentTotal)}</td>
            <td className="px-4 py-2 text-[10px] text-right text-[color-mix(in_srgb,var(--color-info)_80%,black)]">{fmtQ(t.directCost)}</td>
            <td colSpan={5} />
          </tr>
        </tbody>
      </table>

      {editingAllowed && (
        <div className="p-4 border-t border-[var(--color-neutral-200)]">
          <button onClick={onAddCustom}
            className="flex items-center gap-2 px-4 py-2 text-[9px] font-bold uppercase bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] rounded-lg hover:bg-[var(--color-neutral-200)] transition-colors">
            <Plus size={14} />Agregar Renglón Personalizado
          </button>
        </div>
      )}

      {steelModal && <SteelModal line={steelModal.line} steel={steelModal.steel} onClose={() => setSteelModal(null)} />}
    </div>
  );
}

