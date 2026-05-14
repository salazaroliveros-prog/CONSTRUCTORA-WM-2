/**
 * Componente reutilizable para editar dimensiones de una línea de presupuesto
 * Versión simplificada sin dependencias externas
 */

import React, { useState } from 'react';
import { X, Save, Calculator } from 'lucide-react';
import { BudgetLine } from '../../lib/budgetData';
import { cn } from '../../utils/cn';
import { calculateDynamicQuantity } from '../../utils/budgetCalc';

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
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {fields.map(field => (
          <div key={field}>
            <label className="text-[8px] font-bold text-slate-600 uppercase block mb-1">
              {getLabel(field)}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={dimensions[field] || ''}
              onChange={(e) => handleChange(field, e.target.value)}
              placeholder="0.00"
              className={cn(
                "w-full px-2 py-1.5 text-[9px] border rounded bg-white text-slate-900",
                "focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
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
        const previewQty = Object.keys(dims).length > 0 ? calculateDynamicQuantity(previewLine) : 0;
        const previewMat = previewQty * line.materialCost * (line.materialPerf ?? 1);
        const previewLab = previewQty * line.laborCost * (line.laborPerf ?? 1);
        const previewSub = previewMat + previewLab;
        const hasValidDims = Object.keys(dims).length > 0 && previewQty > 0;
        return hasValidDims ? (
          <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Calculator size={12} className="text-blue-600" />
              <span className="text-[8px] font-black text-blue-700 uppercase">Vista previa del cálculo</span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-[9px]">
              <div>
                <span className="text-slate-500">Cant. calculada:</span>
                <span className="ml-1 font-bold text-slate-800">{previewQty.toFixed(2)} {line.unit}</span>
              </div>
              <div>
                <span className="text-slate-500">Material:</span>
                <span className="ml-1 font-bold text-slate-800">Q {previewMat.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500">Mano Obra:</span>
                <span className="ml-1 font-bold text-slate-800">Q {previewLab.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500">Subtotal:</span>
                <span className="ml-1 font-bold text-blue-700">Q {previewSub.toFixed(2)}</span>
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
