import React from 'react';
import { Building2, AlertCircle, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../utils/cn';
import type { Project } from '../../constants';
import { fmtQ } from '../../utils/format';

interface ProjectCardProps {
  project: Project;
  bulkMode: boolean;
  selectedProjectIds: Set<string>;
  onSelect: (id: string) => void;
  onClick: (project: Project) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

export const ProjectCard = React.memo(({ project, bulkMode, selectedProjectIds, onSelect, onClick, onDelete }: ProjectCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={() => { if (bulkMode) { onSelect(project.id); } else { onClick(project); } }}
    className={`bg-[var(--color-surface-solid)] rounded-xl sm:rounded-2xl border border-[var(--color-neutral-200)] shadow-sm overflow-hidden hover:shadow-lg hover:border-secondary/50 transition-all cursor-pointer group flex flex-col h-full interactive-card shimmer-effect relative ${selectedProjectIds.has(project.id) ? "ring-2 ring-red-500" : ""}`}
  >
    {bulkMode && (
      <div className="absolute top-3 left-3 z-10" onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={selectedProjectIds.has(project.id)} onChange={() => onSelect(project.id)} title="Seleccionar proyecto"
          className="w-4 h-4 accent-[var(--color-error)] cursor-pointer" />
      </div>
    )}
    <div className="p-4 space-y-3 flex-1">
      <div className="flex justify-between items-start">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-neutral-900)] border border-slate-800 flex items-center justify-center text-[var(--color-secondary)] group-hover:scale-105 transition-transform duration-300 icon-box icon-gradient-blue">
          <Building2 size={20} />
        </div>
        <div className="flex flex-col items-end sm:items-end">
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest",
            project.status === 'EJECUCION' ? "bg-[var(--color-secondary)] text-[var(--color-primary)]" :
            project.status === 'COTIZACION' ? "bg-[var(--color-info)] text-[var(--color-neutral-50)]" :
            "bg-[var(--color-success)] text-[var(--color-neutral-50)]"
          )}>
            {project.status}
          </span>
          <span className="text-[7px] sm:text-[6px] font-bold text-[var(--color-neutral-400)] mt-1 uppercase tracking-tighter">Cód: {project.id.slice(-6).toUpperCase()}</span>
        </div>
      </div>

      <div className="space-y-0.5">
        <h3 className="text-[10px] sm:text-xs font-black text-[var(--color-primary)] uppercase tracking-tight line-clamp-1 group-hover:text-[var(--color-secondary)] transition-colors italic">{project.name}</h3>
        <p className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest truncate">{project.clientName}</p>
      </div>

      <div className="pt-2 space-y-1.5 border-t border-slate-50">
        <div className="flex justify-between items-end">
          <span className="text-[7px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Progreso</span>
          <div className="flex items-center gap-1">
            {project.status === 'EJECUCION' && (new Date().getTime() - new Date(project.startDate).getTime()) / (new Date(project.endDate || project.startDate).getTime() - new Date(project.startDate).getTime() || 1) > 0.1 && (project.progress || 0) < 10 && (
              <span title="Progreso atrasado respecto al tiempo transcurrido"><AlertCircle size={10} className="text-[var(--color-error)] animate-pulse" /></span>
            )}
            <span className="text-[9px] font-black text-[var(--color-primary)]">{project.progress || 0}%</span>
            <div className="w-1 h-1 rounded-full bg-[var(--color-secondary)] animate-pulse" />
          </div>
        </div>
        <div className="h-1.5 bg-[var(--color-neutral-100)] rounded-full overflow-hidden w-full relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${project.progress || 0}%` }}
            className={cn(
              "h-full rounded-full transition-all duration-1000 relative z-10",
              project.status === 'EJECUCION' ? "bg-[var(--color-secondary)]" : "bg-slate-400"
            )}
          />
        </div>
      </div>
    </div>

    <div className="px-4 py-3 bg-[var(--color-neutral-50)]/50 border-t border-slate-50 flex justify-between items-center mt-auto">
      <div className="flex flex-col">
        <span className="text-[6px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Presupuesto</span>
        <span className="text-[11px] font-black text-[var(--color-primary)] italic leading-none">{fmtQ(project.budget || 0)}</span>
      </div>
      <button
        onClick={(e) => onDelete(e, project.id)}
        aria-label="Eliminar proyecto"
        className="p-1.5 text-slate-300 hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] rounded-lg transition-all"
      >
        <Trash2 size={14} />
      </button>
    </div>
  </motion.div>
));

