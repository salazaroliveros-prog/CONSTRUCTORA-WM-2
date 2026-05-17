/**
 * ProjectItemsList - Panel de selección de ítems de presupuesto
 * Muestra la biblioteca de work items, búsqueda y paginación
 */

import React, { useMemo } from 'react';
import { Search, Plus, Package } from 'lucide-react';
import { usePagination } from '../../hooks/usePagination';
import { DEFAULT_WORK_ITEMS, WorkItem } from '../../constants';
import { BudgetItem } from '../../types/budget';
import { cn } from '../../utils/cn';
import { toast } from 'sonner';

interface ProjectItemsListProps {
  selectedTypology: string;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onAddItem: (item: Omit<BudgetItem, 'projectQuantity' | 'selected'>) => boolean;
}

export function ProjectItemsList({
  selectedTypology,
  searchTerm,
  onSearchChange,
  onAddItem
}: ProjectItemsListProps) {
  // Filtrar ítems por tipología y búsqueda
  const availableItems = useMemo<WorkItem[]>(() => {
    return DEFAULT_WORK_ITEMS.filter(item =>
      item.typology === selectedTypology &&
      (item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
       item.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [selectedTypology, searchTerm]);

  const {
    currentItems: paginatedItems,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    startIndex,
    totalItems: totalCount
  } = usePagination<WorkItem>(availableItems, 8);

  return (
    <div className="bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl shadow-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package size={18} className="text-secondary" />
          <h2 className="text-sm font-black uppercase text-slate-800">
            Biblioteca de Renglones
            <span className="ml-2 text-[9px] font-normal text-slate-500">
              ({totalCount} disponibles)
            </span>
          </h2>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar renglón por código o descripción..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-[9px] border border-white/30 rounded-xl bg-white/60 backdrop-blur-sm focus:outline-none focus:border-secondary"
        />
      </div>

      {/* Grid de ítems */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {paginatedItems.map(item => (
          <div
            key={item.id}
            className="group border border-white/30 rounded-xl bg-white/60 backdrop-blur-sm p-3 hover:border-secondary hover:shadow-md transition-all cursor-pointer"
            onClick={() => {
              const added = onAddItem({
                id: item.id,
                code: item.code,
                description: item.description,
                unit: item.unit,
                typology: item.typology,
                category: item.category,
                durationDays: item.durationDays,
                materials: item.materials,
                labor: item.labor
              });
              if (!added) {
                toast.info('Este renglón ya está en el presupuesto');
              }
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-[8px] font-black text-slate-500 uppercase">{item.code}</span>
              <button className="opacity-0 group-hover:opacity-100 bg-secondary text-white rounded-full p-1 transition-all" title="Agregar item">
                <Plus size={10} />
              </button>
            </div>
            <p className="text-[9px] font-bold text-slate-800 line-clamp-2 min-h-[2em]">
              {item.description}
            </p>
            <p className="text-[8px] text-slate-500 mt-1">{item.unit}</p>
          </div>
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={prevPage}
            disabled={currentPage === 1}
            className="px-3 py-1 text-[8px] font-bold uppercase bg-white/60 backdrop-blur-sm border border-white/30 text-slate-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/90"
          >
            Anterior
          </button>
          <span className="text-[8px] text-slate-600">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-[8px] font-bold uppercase bg-white/60 backdrop-blur-sm border border-white/30 text-slate-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/90"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}


