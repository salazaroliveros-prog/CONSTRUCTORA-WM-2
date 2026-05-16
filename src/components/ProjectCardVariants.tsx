import React from 'react';
import { Building2, TrendingUp, Trash2, Calendar, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { Project } from '../constants';

export const MinimalCard = ({ project, onDelete }: { project: Project; onDelete: (e: any, id: string) => void }) => (
  <div className="p-4 border-b border-slate-100 hover:bg-slate-50 flex items-center justify-between group transition-all">
    <div className="flex items-center gap-4">
        <div className="font-black text-xs text-primary">{project.name}</div>
        <div className="text-[10px] text-slate-400 font-bold uppercase">{project.clientName}</div>
    </div>
    <div className="flex items-center gap-4">
        <div className="text-xs font-black italic">Q {project.budget.toLocaleString()}</div>
        <button title="Eliminar proyecto" onClick={(e) => onDelete(e, project.id)} className="opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
    </div>
  </div>
);

export const DashboardCard = ({ project, onDelete }: { project: Project; onDelete: (e: any, id: string) => void }) => (
  <motion.div 
    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-xl transition-all"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
     <div className="flex justify-between items-start mb-4">
        <div className="bg-slate-900 p-2 rounded-lg text-secondary"><Building2 size={20} /></div>
        <div className="text-right">
            <div className="text-[10px] font-black">{project.status}</div>
            <div className="text-[8px] text-slate-400">{project.progress}%</div>
        </div>
     </div>
     <div className="font-black text-sm uppercase mb-2">{project.name}</div>
     <div className="w-full bg-slate-100 h-2 rounded-full mb-4">
         <div className="bg-secondary h-2 rounded-full progress-fill-dynamic" style={{ '--w': `${project.progress}%` } as React.CSSProperties}></div>
     </div>
     <button onClick={(e) => onDelete(e, project.id)} className="w-full text-[10px] font-bold uppercase border p-2 rounded-lg hover:bg-red-50 hover:border-red-200 transition-all">ELIMINAR</button>
  </motion.div>
);

export const ActionableCard = ({ project, onDelete }: { project: Project; onDelete: (e: any, id: string) => void }) => (
  <div className="bg-white border-l-4 border-secondary rounded-xl shadow-sm p-4 flex justify-between items-center">
     <div>
        <div className="text-xs font-black uppercase tracking-widest">{project.name}</div>
        <div className="flex gap-2 text-[10px] text-slate-500 mt-1">
            <span className="flex items-center gap-1"><Calendar size={10} /> {project.startDate}</span>
            <span className="flex items-center gap-1"><FileText size={10} /> {project.items.length} items</span>
        </div>
     </div>
     <button title="Eliminar proyecto" onClick={(e) => onDelete(e, project.id)} className="p-2 border rounded-lg hover:bg-slate-100 text-red-500"><Trash2 size={16} /></button>
  </div>
);


