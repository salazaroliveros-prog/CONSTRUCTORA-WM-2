/**
 * ProjectSummary - Panel de resumen de costos del proyecto
 * Muestra desglose de materiales, mano de obra, costos indirectos y total
 */

import React, { useMemo } from 'react';
import { FileDown, Printer, DollarSign, TrendingUp, Package, Users, AlertTriangle } from 'lucide-react';
import { generateBudgetPDF, generateBudgetCSV, generateBudgetPDFEjecutivo, generateBudgetPDFAPU, generateBudgetPDFCliente } from '../../lib/reports';
import { BudgetItem } from '../../types/budget';
import { cn } from '../../utils/cn';
import { toast } from 'sonner';
import { fmtQ } from '../../utils/format';

interface ProjectSummaryProps {
  items: BudgetItem[];
  totals: {
    totalDirect: number;
    materialsTotal: number;
    laborTotal: number;
    wasteMaterials: number;
    wasteLabor: number;
    indirectCost: number;
    adminCost: number;
    personalCost: number;
    baseBudget: number;
    totalBudget: number;
    costPerM2: number;
  };
  estimatedDays: number;
  projectName: string;
  clientName: string;
  onExportPDF: (type: 'completo' | 'ejecutivo' | 'apu' | 'cliente') => void;
  onSaveProject: () => void;
  isSaving: boolean;
}

function formatQ(value: number): string {
  return `Q ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function ProjectSummary({
  items,
  totals,
  estimatedDays,
  projectName,
  clientName,
  onExportPDF,
  onSaveProject,
  isSaving
}: ProjectSummaryProps) {
  const totalItems = items.length;
  const selectedItems = items.filter(i => i.selected).length;

  const {
    totalDirect,
    materialsTotal,
    laborTotal,
    wasteMaterials,
    wasteLabor,
    indirectCost,
    adminCost,
    personalCost,
    baseBudget,
    totalBudget,
    costPerM2
  } = totals;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-emerald-500" />
          <h2 className="text-sm font-black uppercase text-slate-800">Resumen de Costos</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExportPDF('completo')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-bold uppercase bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            <FileDown size={10} />
            PDF
          </button>
          <button
            onClick={() => onExportPDF('apu')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-bold uppercase bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
          >
            <Printer size={10} />
            APU
          </button>
          <button
            onClick={onSaveProject}
            disabled={isSaving || totalItems === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-bold uppercase bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Guardando...' : 'Guardar Proyecto'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Directo */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">Costo Directo</p>
          <p className="text-lg font-black text-slate-800">{formatQ(totalDirect)}</p>
        </div>

        {/* Costos Indirectos */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
<p className="text-[8px] font-bold text-slate-500 uppercase mb-1">
              Indirectos ({totals.indirectCost > 0 ? '15%' : '0%'})
            </p>
            <p className="text-lg font-black text-slate-600">{formatQ(totals.indirectCost)}</p>
        </div>

        {/* Costos Admin */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <p className="text-[8px] font-bold text-slate-500 uppercase mb-1">
            Administrativos ({totals.adminCost > 0 ? '5%' : '0%'})
          </p>
          <p className="text-lg font-black text-slate-600">{formatQ(totals.adminCost)}</p>
        </div>

        {/* Costo Total */}
        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
          <p className="text-[8px] font-bold text-emerald-600 uppercase mb-1">Presupuesto Total</p>
          <p className="text-xl font-black text-emerald-700">{formatQ(totalBudget)}</p>
          {costPerM2 > 0 && (
            <p className="text-[8px] text-emerald-600 mt-1">
              Q {costPerM2.toLocaleString(undefined, { maximumFractionDigits: 0 })}/m²
            </p>
          )}
        </div>
      </div>

      {/* Desglose adicional */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[8px]">
          <div className="flex items-center gap-2">
            <Package size={12} className="text-blue-500" />
            <span className="text-slate-600">Materiales:</span>
            <span className="font-bold text-slate-800">{formatQ(materialsTotal)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={12} className="text-purple-500" />
            <span className="text-slate-600">Mano Obra:</span>
            <span className="font-bold text-slate-800">{formatQ(laborTotal)}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-amber-500" />
            <span className="text-slate-600">Desp. Materiales:</span>
            <span className="font-bold text-slate-800">{formatQ(wasteMaterials)}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-amber-500" />
            <span className="text-slate-600">Desp. Mano Obra:</span>
            <span className="font-bold text-slate-800">{formatQ(wasteLabor)}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp size={12} className="text-green-500" />
            <span className="text-slate-600">Personal:</span>
            <span className="font-bold text-slate-800">{formatQ(personalCost)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
