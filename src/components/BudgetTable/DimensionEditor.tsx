/**
 * Componente reutilizable para editar dimensiones de una línea de presupuesto
 * Versión simplificada sin dependencias externas
 */

import React, { useState } from 'react';
import { X, Save, Calculator } from 'lucide-react';
import { BudgetLine } from '../../lib/budgetData';
import { cn } from '../../utils/cn';
import { calcDynamicQty, ENGINEERING, fmtQ } from '../../engine/budgetEngine';

interface DimensionEditorProps {
  line: BudgetLine;
  onUpdate: (updatedLine: BudgetLine) => void;
  onClose: () => void;
}

type DimensionKey = 'length' | 'width' | 'height' | 'thickness' | 'diameter';

export function DimensionEditor({ line, onUpdate, onClose }: DimensionEditorProps) {
  const [dimensions, setDimensions] = useState<Record<string, string>>(() => {
    const dims: Record<string, string> = {};
    if (line.dimensions) {
      Object.entries(line.dimensions).forEach(([key, value]) => {
        dims[key] = value.toString();
      });
    }
    return dims;
  });

  /**
   * Obtiene los campos de dimensión aplicables basados en la descripción
   */
  const getApplicableFields = (): DimensionKey[] => {
    const desc = line.description.toLowerCase();

    if (desc.includes('cimentación') || desc.includes('zapata')) {
      return ['length', 'width', 'height'];
    }
    if (desc.includes('columna')) {
      return ['width', 'height', 'length'];
    }
    if (desc.includes('solera')) {
      return ['width', 'height', 'length'];
    }
    if (desc.includes('losa')) {
      return ['length', 'width', 'thickness'];
    }
    if (desc.includes('carretera') || desc.includes('sub-base') || desc.includes('base asfáltica')) {
      return ['length', 'width', 'thickness'];
    }
    if (desc.includes('puente') || desc.includes('pilas')) {
      return ['width', 'height', 'length'];
    }
    if (desc.includes('fachada') || desc.includes('vidrio')) {
      return ['length', 'height'];
    }
    if (desc.includes('cerramientos') || desc.includes('perimetrales')) {
      return ['length', 'height'];
    }

    // Default: todos los campos
    return ['length', 'width', 'height', 'thickness', 'diameter'];
  };

  const fields = getApplicableFields();

  /**
   * Etiqueta para campo de dimensión
   */
  const getLabel = (field: DimensionKey): string => {
    const labels: Record<DimensionKey, string> = {
      length: 'Largo (m)',
      width: 'Ancho (m)',
      height: 'Alto/Profundidad (m)',
      thickness: 'Espesor (m)',
      diameter: 'Diámetro (m)'
    };
    return labels[field];
  };

  /**
   * Maneja cambio en input
   */
  const handleChange = (field: string, value: string) => {
    setDimensions(prev => ({
      ...prev,
      [field]: value
    }));
  };

  /**
   * Guarda los cambios
   */
  const handleSave = () => {
    const newDims: Record<string, number> = {};
    Object.entries(dimensions).forEach(([key, val]) => {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0) {
        newDims[key] = num;
      }
    });

    const hasDimensions = Object.keys(newDims).length > 0;
    const updatedLine: BudgetLine = {
      ...line,
      dimensions: hasDimensions ? newDims : undefined,
      computationType: hasDimensions ? 'dynamic' : 'fixed',
    };

    onUpdate(updatedLine);
    onClose();
  };

  /**
   * Cancela la edición
   */
  const handleCancel = () => {
    setDimensions(() => {
      const dims: Record<string, string> = {};
      if (line.dimensions) {
        Object.entries(line.dimensions).forEach(([key, value]) => {
          dims[key] = value.toString();
        });
      }
      return dims;
    });
    onClose();
  };

  return (
    <div className="bg-blue-50 border-t border-blue-200 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest">
          Dimensiones para {line.description}
        </h4>
        <button
          onClick={handleCancel}
          className="p-1 hover:bg-blue-100 rounded transition-colors text-slate-600"
          aria-label="Cerrar editor de dimensiones"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {fields.map(field => (
          <div key={field}>
<label className="text-[8px] font-bold text-slate-600 uppercase block mb-1" htmlFor={`dim-${field}`}>
               {getLabel(field)}
             </label>
             <input
               id={`dim-${field}`}
               type="number"
               step="0.01"
               min="0"
               name={field}
               inputMode="decimal"
               autoComplete="off"
               value={dimensions[field] || ''}
               onChange={(e) => handleChange(field, e.target.value)}
               placeholder="0.00"
               className={cn(
                 "w-full px-2 py-1.5 text-[9px] border rounded bg-neutral-900/40 text-slate-900",
                 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                 "border-slate-300 placeholder:text-slate-400"
               )}
             />
          </div>
        ))}
      </div>

      {/* Vista previa de cálculo en tiempo real */}
      {(() => {
        const dims: Record<string, number> = {};
        Object.entries(dimensions).forEach(([key, val]) => {
          const num = parseFloat(val);
          if (!isNaN(num) && num > 0) dims[key] = num;
        });
const previewLine = { ...line, dimensions: Object.keys(dims).length > 0 ? dims : undefined, computationType: 'dynamic' as const };
const previewQtyRaw = calcDynamicQty(previewLine);
         const hasValidDims = Object.keys(dims).length > 0 && previewQtyRaw.qty > 0;
         const previewQty = hasValidDims ? previewQtyRaw.qty : 0;

         // Per-unit material cost con desperdicio por material, con fallback a legacy
         const perUnitMat = line.materials.length > 0
           ? line.materials.reduce((s, m) => {
               const wf = m.wasteFactor ?? 1.03;
               return s + m.unitPrice * m.quantity * wf;
             }, 0)
           : (line.materialCost || 0) * (line.wasteFactor ?? 1.03);
         const perUnitLab = line.labor.length > 0
           ? line.labor.reduce((s, l) => s + l.dailyWage * l.quantity, 0)
           : (line.laborCost || 0);
         const perUnitEq = line.equipment.length > 0
           ? line.equipment.reduce((s, e) => s + e.hourlyRate * e.quantity, 0)
           : (line.equipmentCost || 0);

         const matCost = previewQty * perUnitMat;
         const labCost = previewQty * perUnitLab;
         const eqCost = previewQty * perUnitEq;
         const subtotal = matCost + labCost + eqCost;
         const taxAmt = subtotal * (line.taxRate ?? ENGINEERING.taxRate);
         const profitAmt = subtotal * (line.profitMargin ?? ENGINEERING.profitMargin);
         const contingAmt = subtotal * (line.contingency ?? ENGINEERING.contingency);
         const total = subtotal + taxAmt + profitAmt + contingAmt;
         return hasValidDims ? (
          <div className="mt-4 p-3 bg-neutral-900/40 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Calculator size={12} className="text-blue-600" />
              <span className="text-[8px] font-black text-blue-700 uppercase">Vista previa del cálculo</span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-[9px]">
              <div>
                <span className="text-slate-500">Cant. calculada:</span>
                <span className="ml-1 font-bold text-slate-800">{previewQty.toFixed(4)} {line.unit}</span>
              </div>
              <div>
                <span className="text-slate-500">Material:</span>
                <span className="ml-1 font-bold text-slate-800">{fmtQ(matCost)}</span>
              </div>
              <div>
                <span className="text-slate-500">Mano Obra:</span>
                <span className="ml-1 font-bold text-slate-800">{fmtQ(labCost)}</span>
              </div>
              <div>
                <span className="text-slate-500">Subtotal:</span>
                <span className="ml-1 font-bold text-blue-700">{fmtQ(total)}</span>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-bold uppercase bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Save size={10} />
          Guardar
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 text-[8px] font-bold uppercase bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

