// src/components/BudgetTable.tsx
/**
 * @license SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Pencil, Trash2, Plus } from 'lucide-react';
import { BudgetLine } from '../lib/budgetData';
import { toast } from 'sonner';

interface BudgetTableProps {
  lines: BudgetLine[];
  projectQty: number;
  onUpdate: (lines: BudgetLine[]) => void;
  onAddCustom: () => void;
  editingAllowed?: boolean;
}

export default function BudgetTable({ lines, projectQty, onUpdate, onAddCustom, editingAllowed = true }: BudgetTableProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderRows = (linesToRender: BudgetLine[], depth: number): React.ReactNode[] => {
    let result: React.ReactNode[] = [];

    linesToRender.forEach(line => {
      const isExpanded = expanded[line.id];
      const hasChildren = line.children && line.children.length > 0;

      // Row for this line
      result.push(
        <tr key={line.id} className="group hover:bg-slate-50/50 transition-colors">
          <td style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}>
            <div className="flex items-center gap-2 py-2">
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(line.id)}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200"
                >
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              ) : (
                <span className="w-5 inline-block" />
              )}
              <span className="text-[9px] font-black text-slate-700 uppercase">{line.code}</span>
              <span className="text-[9px] font-bold text-slate-600 truncate max-w-[200px]">{line.description}</span>
            </div>
          </td>
          <td className="text-[9px] text-slate-600 text-right">{line.unit}</td>
          <td className="text-[9px] text-slate-600 text-right">
            {line.qty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </td>
          <td className="text-[9xs] text-slate-600 text-right">Q {line.materialCost.toLocaleString()}</td>
          <td className="text-[9px] text-slate-600 text-right">Q {line.laborCost.toLocaleString()}</td>
          <td className="text-[9px] font-bold text-slate-800 text-right">
            Q {(line.subtotal ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </td>
          {editingAllowed && (
            <td className="text-right">
              <button
                onClick={() => toast.info('Editar línea no implementado aún')}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => toast.info('Eliminar línea no implementado aún')}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </td>
          )}
        </tr>
      );

      // If expanded and has children, render children recursively
      if (isExpanded && hasChildren) {
        const childRows = renderRows(line.children, depth + 1);
        result = result.concat(childRows);
      }
    });

    return result;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-slate-50/50">
          <tr>
            <th className="px-4 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest">Descripción / Código</th>
            <th className="px-4 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right">Unidad</th>
            <th className="px-4 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right">Cant.</th>
            <th className="px-4 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right">Costo Mat. (Q.)</th>
            <th className="px-4 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right">Costo Mano Obra (Q.)</th>
            <th className="px-4 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right">Subtotal (Q.)</th>
            {editingAllowed && (
              <th className="px-4 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody>{renderRows(lines, 0)}</tbody>
      </table>
      {editingAllowed && (
        <div className="p-2 border-t border-slate-100 flex justify-end">
          <button
            onClick={onAddCustom}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[8px] font-black uppercase rounded-lg hover:bg-slate-800 transition-all"
          >
            <Plus size={12} /> Agregar Renglón Personalizado
          </button>
        </div>
      )}
    </div>
  );
}