/**
 * BudgetTable - Tabla jerárquica de presupuestos
 * Refactorizado: componentes extraídos, hooks personalizados, reducción de duplicación
 */

import React, { useState, useCallback, memo } from 'react';
import { ChevronRight, ChevronDown, Pencil, Trash2, Plus } from 'lucide-react';
import { BudgetLine } from '../lib/budgetData';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { DimensionEditor } from './BudgetTable/DimensionEditor';
import { calculateDynamicQuantity } from '../utils/budgetCalc';

interface BudgetTableProps {
  lines: BudgetLine[];
  projectQty: number;
  onUpdate: (lines: BudgetLine[]) => void;
  onAddCustom: () => void;
  editingAllowed?: boolean;
}

/**
 * Componente de fila individual (memoizado)
 */
const BudgetTableRow = memo(function BudgetTableRow({
  line,
  depth,
  isExpanded,
  isEditing,
  onToggleExpand,
  onEdit,
  onUpdateLine,
  editingAllowed
}: {
  line: BudgetLine;
  depth: number;
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (id: string) => void;
  onUpdateLine: (line: BudgetLine) => void;
  editingAllowed: boolean;
}) {
  const hasChildren = line.children && line.children.length > 0;

  return (
    <>
      {/* Fila principal */}
      <tr className="group hover:bg-slate-50/50 transition-colors">
        <td style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}>
          <div className="flex items-center gap-2 py-2">
            {hasChildren ? (
              <button
                onClick={() => onToggleExpand(line.id)}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 transition-colors"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : (
              <span className="w-5 inline-block" />
            )}
            <span className="text-[9px] font-black text-slate-700 uppercase truncate">
              {line.code}
            </span>
            <span
              className="text-[9px] font-bold text-slate-600 truncate max-w-[200px]"
              title={line.description}
            >
              {line.description}
            </span>
          </div>
        </td>
        <td className="text-[9px] text-slate-600 text-right">{line.unit}</td>
        <td className="text-[9px] text-slate-600 text-right">
          {line.computationType === 'dynamic' ? (
            <span className="text-blue-600 font-medium">
              {line.qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} (calc)
            </span>
          ) : (
            line.qty.toLocaleString(undefined, { maximumFractionDigits: 2 })
          )}
        </td>
        <td className="text-[9px] text-slate-600 text-right">
          Q {line.materialCost.toLocaleString()}
        </td>
        <td className="text-[9px] text-slate-600 text-right">
          Q {line.laborCost.toLocaleString()}
        </td>
        <td className="text-[9px] font-bold text-slate-800 text-right">
          Q {(line.subtotal ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </td>
        {editingAllowed && (
          <td className="text-right">
            <button
              onClick={() => onEdit(line.id)}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition-all"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => toast.info('Eliminar línea no implementado aún')}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-600 transition-all"
            >
              <Trash2 size={12} />
            </button>
          </td>
        )}
      </tr>

      {/* Fila de edición de dimensiones */}
      {editingAllowed && isEditing && (
        <tr key={`${line.id}_edit`} className="bg-blue-50 border-t border-blue-200">
          <td colSpan={editingAllowed ? 7 : 6} className="p-0">
            <DimensionEditor
              line={line}
              onUpdate={onUpdateLine}
              onClose={() => onEdit(line.id)}
            />
          </td>
        </tr>
      )}

      {/* Filas hijas (recursivas) */}
      {hasChildren && isExpanded && line.children!.map(child => (
        <BudgetTableRow
          key={child.id}
          line={child}
          depth={depth + 1}
          isExpanded={false}
          isEditing={false}
          onToggleExpand={onToggleExpand}
          onEdit={onEdit}
          onUpdateLine={onUpdateLine}
          editingAllowed={editingAllowed}
        />
      ))}
    </>
  );
});

BudgetTableRow.displayName = 'BudgetTableRow';

/**
 * Componente principal BudgetTable
 */
export default function BudgetTable({
  lines,
  projectQty,
  onUpdate,
  onAddCustom,
  editingAllowed = true
}: BudgetTableProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  /**
   * Alterna expansión de línea
   */
  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /**
   * Alterna modo edición
   */
  const [editingId, setEditingId] = useState<string | null>(null);
  const handleEdit = useCallback((id: string) => {
    setEditingId(prev => prev === id ? null : id);
  }, []);

  /**
   * Actualiza una línea en el árbol (recursivo)
   * Recalcula cantidad si la línea es dinámica y tiene dimensiones
   */
  const updateLineRecursive = useCallback((
    list: BudgetLine[],
    updatedLine: BudgetLine
  ): BudgetLine[] => {
    return list.map(l => {
      if (l.id === updatedLine.id) {
        let line = { ...updatedLine };
        // Si es línea dinámica con dimensiones, recalcular cantidad
        if (line.computationType === 'dynamic' && line.dimensions) {
          const newQty = calculateDynamicQuantity(line);
          line = { ...line, qty: newQty };
        }
        return line;
      }
      if (l.children && l.children.length > 0) {
        return {
          ...l,
          children: updateLineRecursive(l.children, updatedLine)
        };
      }
      return l;
    });
  }, []);

  /**
   * Handler para actualización de línea desde editor
   */
  const handleUpdateLine = useCallback((updatedLine: BudgetLine) => {
    onUpdate(updateLineRecursive(lines, updatedLine));
  }, [lines, onUpdate, updateLineRecursive]);

  /**
   * Renderiza líneas recursivamente
   */
  const renderLines = useCallback((linesToRender: BudgetLine[], depth: number): React.ReactNode[] => {
    return linesToRender.map(line => (
      <BudgetTableRow
        key={line.id}
        line={line}
        depth={depth}
        isExpanded={expanded[line.id] || false}
        isEditing={editingId === line.id}
        onToggleExpand={toggleExpand}
        onEdit={handleEdit}
        onUpdateLine={handleUpdateLine}
        editingAllowed={editingAllowed}
      />
    ));
  }, [expanded, toggleExpand, handleEdit, handleUpdateLine, editingAllowed, editingId]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            <th className="px-4 py-2 text-[9px] font-black text-slate-700 uppercase tracking-wider">
              Renglón
            </th>
            <th className="px-4 py-2 text-[9px] font-black text-slate-700 uppercase tracking-wider text-right">
              Unidad
            </th>
            <th className="px-4 py-2 text-[9px] font-black text-slate-700 uppercase tracking-wider text-right">
              Cantidad
            </th>
            <th className="px-4 py-2 text-[9px] font-black text-slate-700 uppercase tracking-wider text-right">
              Material Q
            </th>
            <th className="px-4 py-2 text-[9px] font-black text-slate-700 uppercase tracking-wider text-right">
              Mano Obra Q
            </th>
            <th className="px-4 py-2 text-[9px] font-black text-slate-700 uppercase tracking-wider text-right">
              Subtotal Q
            </th>
            {editingAllowed && (
              <th className="px-4 py-2 text-[9px] font-black text-slate-700 uppercase tracking-wider text-right w-16">
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {renderLines(lines, 0)}
        </tbody>
      </table>

      {/* Botón para agregar renglón personalizado */}
      {editingAllowed && (
        <div className="p-4 border-t border-slate-200">
          <button
            onClick={onAddCustom}
            className="flex items-center gap-2 px-4 py-2 text-[9px] font-bold uppercase bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <Plus size={14} />
            Agregar Renglón Personalizado
          </button>
        </div>
      )}
    </div>
  );
}
