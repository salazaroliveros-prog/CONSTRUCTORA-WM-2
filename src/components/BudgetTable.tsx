/**
 * BudgetTable - Tabla jerárquica de presupuestos
 * Refactorizado con CRUD completo, edición inline y eliminación con confirmación
 */

import React, { useState, useCallback, memo, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { BudgetLine } from '../lib/budgetData';
import { toast } from 'sonner';
import { DimensionEditor } from './BudgetTable/DimensionEditor';
import { calculateDynamicQuantity, calculateBudget } from '../utils/budgetCalc';

interface BudgetTableProps {
  lines: BudgetLine[];
  projectQty: number;
  onUpdate: (lines: BudgetLine[]) => void;
  onAddCustom: () => void;
  editingAllowed?: boolean;
}

/**
 * Computa subtotal en tiempo real para una línea (incluye hijos)
 */
function calcLineMaterial(line: BudgetLine): number {
  return line.qty * line.materialCost * (line.materialPerf ?? 1);
}
function calcLineLabor(line: BudgetLine): number {
  return line.qty * line.laborCost * (line.laborPerf ?? 1);
}
function calcLineSelf(line: BudgetLine): number {
  return calcLineMaterial(line) + calcLineLabor(line);
}
function calcLineTotal(line: BudgetLine): number {
  const self = calcLineSelf(line);
  const children = line.children?.reduce((s, c) => s + calcLineTotal(c), 0) ?? 0;
  return self + children;
}

/**
 * Muestra valor formateado o vacío si es cero
 */
function fmtQVal(v: number): string {
  return v > 0 ? `Q ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '';
}

/**
 * Componente de fila individual (memoizado) con CRUD completo
 * y cálculo automático en tiempo real
 */
const BudgetTableRow = memo(function BudgetTableRow({
  line,
  depth,
  isExpanded,
  isEditing,
  onToggleExpand,
  onEdit,
  onUpdateLine,
  onDeleteLine,
  editingAllowed
}: {
  line: BudgetLine;
  depth: number;
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (id: string) => void;
  onUpdateLine: (line: BudgetLine) => void;
  onDeleteLine: (id: string) => void;
  editingAllowed: boolean;
}) {
  const hasChildren = line.children && line.children.length > 0;
  const [editingField, setEditingField] = useState<'qty' | 'materialCost' | 'laborCost' | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Cálculos en tiempo real
  const rtMaterial = calcLineMaterial(line);
  const rtLabor = calcLineLabor(line);
  const rtSelf = rtMaterial + rtLabor;
  const rtChildrenTotal = line.children?.reduce((s, c) => s + calcLineTotal(c), 0) ?? 0;
  const rtSubtotal = rtSelf + rtChildrenTotal;
  const showSubtotal = rtSubtotal > 0 || hasChildren;

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const startInlineEdit = (field: 'qty' | 'materialCost' | 'laborCost') => {
    if (field === 'qty' && line.computationType === 'dynamic') return;
    setEditValue(String(line[field]));
    setEditingField(field);
  };

  const commitInlineEdit = () => {
    if (!editingField) return;
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) {
      onUpdateLine({ ...line, [editingField]: val });
    }
    setEditingField(null);
  };

  const cancelInlineEdit = () => setEditingField(null);

  const EditableCell = ({ field, value, prefix = '' }: { field: 'qty' | 'materialCost' | 'laborCost'; value: number; prefix?: string }) => {
    if (editingField === field) {
      return (
        <td className="text-right p-0">
          <div className="inline-flex items-center gap-0.5">
            <input
              ref={inputRef}
              type="number"
              step="any"
              min="0"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitInlineEdit(); if (e.key === 'Escape') cancelInlineEdit(); }}
              onBlur={commitInlineEdit}
              className="w-20 text-[9px] text-right px-1 py-0.5 border border-blue-400 rounded bg-white focus:outline-none"
            />
            <button onClick={commitInlineEdit} className="p-0.5 text-green-600 hover:text-green-800"><Check size={10} /></button>
            <button onClick={cancelInlineEdit} className="p-0.5 text-red-600 hover:text-red-800"><X size={10} /></button>
          </div>
        </td>
      );
    }
    // No mostrar "0.00" — mostrar vacío si es cero
    if (value === 0 && field !== 'qty') {
      return (
        <td
          className="text-[9px] text-right text-slate-300 cursor-pointer hover:bg-yellow-50"
          onClick={() => editingAllowed && startInlineEdit(field)}
          title="Click para editar"
        >
          —
        </td>
      );
    }
    return (
      <td
        className={`text-[9px] text-right ${editingAllowed ? 'cursor-pointer hover:bg-yellow-50' : ''}`}
        onClick={() => editingAllowed && startInlineEdit(field)}
        title={editingAllowed ? 'Click para editar' : undefined}
      >
        {prefix}{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </td>
    );
  };

  const handleDelete = () => {
    const childCount = line.children?.length || 0;
    const msg = childCount > 0
      ? `¿Eliminar "${line.description}" y sus ${childCount} sub-renglones?`
      : `¿Eliminar "${line.description}"?`;
    toast(msg, {
      description: 'Esta acción no se puede deshacer.',
      action: {
        label: 'Eliminar',
        onClick: () => onDeleteLine(line.id)
      },
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

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
        {line.computationType === 'dynamic' ? (
          <td className="text-[9px] text-right">
            <span className="text-blue-600 font-medium cursor-pointer hover:bg-blue-50" onClick={() => onEdit(line.id)}>
              {line.qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} (calc)
            </span>
          </td>
        ) : (
          <EditableCell field="qty" value={line.qty} />
        )}
        <EditableCell field="materialCost" value={line.materialCost} prefix="Q " />
        <EditableCell field="laborCost" value={line.laborCost} prefix="Q " />
        <td className={`text-[9px] font-bold text-right ${showSubtotal ? 'text-slate-800' : 'text-slate-300'}`}>
          {showSubtotal ? fmtQVal(rtSubtotal) : '—'}
        </td>
        {editingAllowed && (
          <td className="text-right">
            <button
              onClick={() => onEdit(line.id)}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200 transition-all"
              title="Editar dimensiones"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-600 transition-all"
              title="Eliminar renglón"
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

      {/* Filas hijas (recursivas) — despliegue automático con sus propios cálculos */}
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
          onDeleteLine={onDeleteLine}
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
  const [editingId, setEditingId] = useState<string | null>(null);

  /**
   * Alterna expansión de línea
   */
  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /**
   * Alterna modo edición de dimensiones
   */
  const handleEdit = useCallback((id: string) => {
    setEditingId(prev => prev === id ? null : id);
  }, []);

  /**
   * Elimina una línea del árbol (recursivo)
   */
  const deleteLineRecursive = useCallback((
    list: BudgetLine[],
    idToDelete: string
  ): BudgetLine[] => {
    return list
      .filter(l => l.id !== idToDelete)
      .map(l => ({
        ...l,
        children: l.children ? deleteLineRecursive(l.children, idToDelete) : []
      }));
  }, []);

  const handleDeleteLine = useCallback((id: string) => {
    const newLines = deleteLineRecursive(lines, id);
    if (newLines.length !== lines.length || JSON.stringify(newLines) !== JSON.stringify(lines)) {
      onUpdate(calculateBudget(newLines));
      toast.success('Renglón eliminado');
    }
  }, [lines, onUpdate, deleteLineRecursive]);

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
    const updated = updateLineRecursive(lines, updatedLine);
    onUpdate(calculateBudget(updated));
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
        onDeleteLine={handleDeleteLine}
        editingAllowed={editingAllowed}
      />
    ));
  }, [expanded, toggleExpand, handleEdit, handleUpdateLine, handleDeleteLine, editingAllowed, editingId]);

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
