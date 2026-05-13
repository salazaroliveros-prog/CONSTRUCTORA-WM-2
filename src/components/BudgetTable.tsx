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
        <tr key={line.id} className="group hover:bg-slate-50/50 /50 transition-colors">
          <td style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}>
            <div className="flex items-center gap-2 py-2">
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(line.id)}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 "
                >
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              ) : (
                <span className="w-5 inline-block" />
              )}
              <span className="text-[9px] font-black text-slate-700  uppercase">{line.code}</span>
              <span className="text-[9px] font-bold text-slate-600  truncate max-w-[200px]">{line.description}</span>
            </div>
          </td>
          <td className="text-[9px] text-slate-600  text-right">{line.unit}</td>
          <td className="text-[9px] text-slate-600  text-right">
            {line.computationType === 'dynamic' ? (
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {line.qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} (calc)
              </span>
            ) : (
              line.qty.toLocaleString(undefined, { maximumFractionDigits: 2 })
            )}
          </td>
          <td className="text-[9px] text-slate-600  text-right">Q {line.materialCost.toLocaleString()}</td>
          <td className="text-[9px] text-slate-600  text-right">Q {line.laborCost.toLocaleString()}</td>
          <td className="text-[9px] font-bold text-slate-800  text-right">
            Q {(line.subtotal ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </td>
          {editingAllowed && (
            <td className="text-right">
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [line.id + '_edit']: !prev[line.id + '_edit'] }))}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-200 "
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => toast.info('Eliminar línea no implementado aún')}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </td>
          )}
        </tr>
      );

      // Edit row for dynamic computations
      if (editingAllowed && expanded[line.id + '_edit']) {
        result.push(
          <tr key={line.id + '_edit'} className="bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-700">
            <td colSpan={editingAllowed ? 7 : 6} style={{ paddingLeft: `${depth * 1.5 + 2}rem` }}>
              <div className="py-3 space-y-3">
                <h4 className="text-[10px] font-black text-blue-800 dark:text-blue-200 uppercase tracking-widest">
                  Dimensiones para {line.description}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {line.description.toLowerCase().includes('cimentación') && (
                    <>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Largo (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.length || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.length = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Ancho (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.width || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.width = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Profundidad (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.height || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.height = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                    </>
                  )}
                  {line.description.toLowerCase().includes('columna') && (
                    <>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Base (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.width || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.width = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Altura (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.length || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.length = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                    </>
                  )}
                  {line.description.toLowerCase().includes('solera') && (
                    <>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Ancho (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.width || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.width = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Alto (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.height || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.height = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Longitud (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.length || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.length = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                    </>
                  )}
                  {line.description.toLowerCase().includes('zapata') && (
                    <>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Largo (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.length || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.length = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Ancho (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.width || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.width = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Profundidad (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.height || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.height = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                    </>
                  )}
                  {line.description.toLowerCase().includes('carretera') && (
                    <>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Largo (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.length || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.length = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Ancho (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.width || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.width = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Espesor (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.thickness || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.thickness = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                    </>
                  )}
                  {line.description.toLowerCase().includes('puente') && (
                    <>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Sección Base (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.width || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.width = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Sección Alto (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.height || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.height = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Altura (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.length || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.length = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                    </>
                  )}
                  {line.description.toLowerCase().includes('fachada') && (
                    <>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Largo (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.length || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.length = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Alto (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.height || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.height = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                    </>
                  )}
                  {line.description.toLowerCase().includes('cerramientos') && (
                    <>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Longitud (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.length || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.length = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-bold text-slate-600  uppercase">Altura (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.dimensions?.height || ''}
                          onChange={(e) => {
                            const updated = { ...line };
                            if (!updated.dimensions) updated.dimensions = {};
                            updated.dimensions.height = parseFloat(e.target.value) || 0;
                            onUpdate(lines.map(l => l.id === line.id ? updated : l));
                          }}
                          className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-[8px] font-bold text-slate-600  uppercase">Factor Desperdicio</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max="2"
                      value={line.wasteFactor || 1.0}
                      onChange={(e) => {
                        const updated = { ...line };
                        updated.wasteFactor = parseFloat(e.target.value) || 1.0;
                        onUpdate(lines.map(l => l.id === line.id ? updated : l));
                      }}
                      className="w-full mt-1 px-2 py-1 text-[9px] border border-slate-300  rounded bg-white  text-slate-900 "
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [line.id + '_edit']: false }))}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[8px] font-black uppercase rounded"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        );
      }

      // If expanded and has children, render children recursively
      if (isExpanded && hasChildren) {
        const childRows = renderRows(line.children, depth + 1);
        result = result.concat(childRows);
      }
    });

    return result;
  };

  return (
    <div className="bg-white  rounded-xl border border-slate-200  overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-slate-50/50 /50">
          <tr>
            <th className="px-4 py-2 text-[7px] font-black text-slate-400  uppercase tracking-widest">Descripción / Código</th>
            <th className="px-4 py-2 text-[7px] font-black text-slate-400  uppercase tracking-widest text-right">Unidad</th>
            <th className="px-4 py-2 text-[7px] font-black text-slate-400  uppercase tracking-widest text-right">Cant.</th>
            <th className="px-4 py-2 text-[7px] font-black text-slate-400  uppercase tracking-widest text-right">Costo Mat. (Q.)</th>
            <th className="px-4 py-2 text-[7px] font-black text-slate-400  uppercase tracking-widest text-right">Costo Mano Obra (Q.)</th>
            <th className="px-4 py-2 text-[7px] font-black text-slate-400  uppercase tracking-widest text-right">Subtotal (Q.)</th>
            {editingAllowed && (
              <th className="px-4 py-2 text-[7px] font-black text-slate-400  uppercase tracking-widest text-right">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody>{renderRows(lines, 0)}</tbody>
      </table>
      {editingAllowed && (
        <div className="p-2 border-t border-slate-100  flex justify-end">
          <button
            onClick={onAddCustom}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900  text-white text-[8px] font-black uppercase rounded-lg hover:bg-slate-800  transition-all"
          >
            <Plus size={12} /> Agregar Renglón Personalizado
          </button>
        </div>
      )}
    </div>
  );
}
