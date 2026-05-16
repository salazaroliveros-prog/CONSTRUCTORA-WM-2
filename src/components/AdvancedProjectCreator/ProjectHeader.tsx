/**
 * ProjectHeader - Encabezado del creador de proyectos
 * Selectores de tipología, nivel de mercado, tipología de losa
 */

import React from 'react';
import { Settings2, Package, HardHat, Gauge } from 'lucide-react';
import { MARKET_LEVELS, SLAB_TYPOLOGIES, MarketLevel, SlabTypology } from '../../lib/marketParams';
import { Typology } from '../../constants';
import { cn } from '../../utils/cn';

interface ProjectHeaderProps {
  selectedTypology: Typology;
  onTypologyChange: (t: Typology) => void;
  selectedMarketLevel: MarketLevel;
  onMarketLevelChange: (m: MarketLevel) => void;
  selectedSlabType: SlabTypology;
  onSlabTypeChange: (s: SlabTypology) => void;
  showAdvancedConfig: boolean;
  onToggleAdvanced: () => void;
  areaTotal: number;
  onAreaTotalChange: (value: number) => void;
  wasteFactors: { materials: number; labor: number };
  onWasteFactorsChange: (w: { materials: number; labor: number }) => void;
}

export function ProjectHeader({
  selectedTypology,
  onTypologyChange,
  selectedMarketLevel,
  onMarketLevelChange,
  selectedSlabType,
  onSlabTypeChange,
  showAdvancedConfig,
  onToggleAdvanced,
  areaTotal,
  onAreaTotalChange,
  wasteFactors,
  onWasteFactorsChange,
}: ProjectHeaderProps) {
  const typologies = Object.values(Typology);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings2 size={18} className="text-secondary" />
          <h2 className="text-sm font-black uppercase text-slate-800">Configuración del Proyecto</h2>
        </div>
        <button
          onClick={onToggleAdvanced}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-[8px] font-bold uppercase rounded-lg transition-colors",
            showAdvancedConfig
              ? "bg-amber-100 text-amber-800"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          <Gauge size={12} />
          {showAdvancedConfig ? 'Ocultar' : 'Mostrar'} Config. Avanzada
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tipología */}
        <div>
          <label className="text-[8px] font-bold text-slate-600 uppercase mb-1.5 block">
            <Package size={10} className="inline mr-1" />
            Tipología
          </label>
          <select
            value={selectedTypology}
            onChange={(e) => onTypologyChange(e.target.value as Typology)}
            className="w-full px-3 py-2 text-[9px] border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/20"
            title="Seleccionar tipología"
          >
            {typologies.map(t => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Nivel de Mercado */}
        <div>
          <label className="text-[8px] font-bold text-slate-600 uppercase mb-1.5 block">
            Nivel de Mercado
          </label>
          <select
            value={selectedMarketLevel.id}
            onChange={(e) => {
              const found = MARKET_LEVELS.find(m => m.id === e.target.value);
              if (found) onMarketLevelChange(found);
            }}
            title="Seleccionar nivel de mercado"
            className="w-full px-3 py-2 text-[9px] border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-secondary"
          >
            {MARKET_LEVELS.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tipología de Losa */}
        <div>
          <label className="text-[8px] font-bold text-slate-600 uppercase mb-1.5 block">
            <HardHat size={10} className="inline mr-1" />
            Sistema de Losa
          </label>
          <select
            value={selectedSlabType.id}
            onChange={(e) => {
              const found = SLAB_TYPOLOGIES.find(s => s.id === e.target.value);
              if (found) onSlabTypeChange(found);
            }}
            className="w-full px-3 py-2 text-[9px] border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-secondary"
            title="Seleccionar sistema de losa"
          >
            {SLAB_TYPOLOGIES.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Área Total */}
        <div>
          <label className="text-[8px] font-bold text-slate-600 uppercase mb-1.5 block">
            Área Total (m²)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={areaTotal}
            onChange={(e) => onAreaTotalChange(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="w-full px-3 py-2 text-[9px] border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-secondary"
          />
        </div>
      </div>

      {/* Configuración avanzada (colapsable) */}
      {showAdvancedConfig && (
        <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[8px] font-bold text-slate-600 uppercase mb-1.5 block">
                Factor Desperdicio Materiales (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={wasteFactors.materials}
                onChange={(e) => onWasteFactorsChange({ ...wasteFactors, materials: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-[9px] border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-secondary"
                title="Porcentaje de desperdicio de materiales"
              />
            </div>
            <div>
              <label className="text-[8px] font-bold text-slate-600 uppercase mb-1.5 block">
                Factor Desperdicio Mano de Obra (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={wasteFactors.labor}
                onChange={(e) => onWasteFactorsChange({ ...wasteFactors, labor: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-[9px] border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-secondary"
                title="Porcentaje de desperdicio de mano de obra"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


