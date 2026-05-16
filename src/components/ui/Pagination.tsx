import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';

interface GridInfo {
  cols: number;
  rows: number;
  pageSize: number;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onNext: () => void;
  onPrev: () => void;
  onPage: (page: number) => void;
  totalItems: number;
  startIndex: number;
  itemsPerPage: number;
  className?: string;
  compact?: boolean;
  gridInfo?: GridInfo;
}

export default function Pagination({
  currentPage,
  totalPages,
  onNext,
  onPrev,
  onPage,
  totalItems,
  startIndex,
  itemsPerPage,
  className,
  compact = false,
  gridInfo
}: PaginationProps) {
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  if (totalPages <= 1) return null;

  // Grid-aware label: show "6×4" badge when gridInfo is provided
  const gridBadge = gridInfo && (
    <span className="text-[6px] font-black text-slate-400 bg-slate-100 px-1 py-0.5 rounded-full mr-1">
      {gridInfo.cols}×{gridInfo.rows}
    </span>
  );

  if (compact) {
    return (
      <div className={cn("flex items-center justify-between gap-2", className)}>
        <div className="text-[8px] font-black text-slate-600 uppercase tracking-tight">
          {gridBadge}
          {startIndex + 1}-{endIndex} / {totalItems}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            disabled={currentPage === 1}
            className="p-1 rounded-md border border-slate-100  bg-neutral-900/40 /80 text-slate-300 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={12} />
          </button>
          <span className="text-[9px] font-black text-primary px-1">{currentPage}</span>
          <button
            onClick={onNext}
            disabled={currentPage === totalPages}
            className="p-1 rounded-md border border-slate-100  bg-neutral-900/40 /80 text-slate-300 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 ", className)}>
      <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
        Mostrando <span className="text-secondary">{startIndex + 1}-{endIndex}</span> de <span className="text-primary">{totalItems}</span> registros
      </div>
      
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-200 bg-neutral-900/40 /80 text-slate-600 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        
        <div className="flex items-center gap-1 px-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPage(page)}
              className={cn(
                "w-7 h-7 rounded-lg text-[9px] font-black transition-all",
                 currentPage === page 
                   ? "bg-slate-900 text-white shadow-lg" 
                   : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          onClick={onNext}
          disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-slate-200 bg-neutral-900/40 /80 text-slate-600 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

