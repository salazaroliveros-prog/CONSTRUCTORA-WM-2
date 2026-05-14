/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  FileText, 
  TrendingUp, 
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  AlertCircle,
  Trash2,
  Download,
  LayoutGrid,
  ListFilter,
  CheckCircle2,
  Calculator,
  Settings2,
  Calendar,
  Hammer,
  Box,
  Layers,
  Pencil,
  PlusCircle,
  ShoppingCart,
  X
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, Area, AreaChart, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Typology, Project, StaffMember, Client, Transaction } from '../constants';
import { calcRealDuration } from '../lib/ganttCPM';
import AdvancedProjectCreator from './AdvancedProjectCreator';
import Modal from './ui/Modal';
import { cn } from '../utils/cn';
import {subscribeToCollection, deleteDocument, updateDocument, parseError, generateProjectStock} from '../services/firestoreService';
import { uploadFile } from '../services/storageService';
import { usePagination } from '../hooks/usePagination';
import { useAutoPageSize } from '../hooks/useAutoPageSize';
import { toast } from 'sonner';
import { generatePDF, generateCSV, exportToExcel, generateProjectPDF, generateProjectCSV, calcProjectDuration, PDF_TEMPLATES, CSV_TEMPLATES, ExportStyle } from '../lib/exportUtils';
import Pagination from './ui/Pagination';
import { Users, MapPin, CalendarDays, DollarSign, TrendingDown } from 'lucide-react';
import { BudgetLine } from '../lib/budgetData';
import { itemsToBudgetTree } from '../utils/budgetConverter';

import { sanitizeString } from '../utils/sanitize';
import { trackCRUD, trackEvent } from '../utils/logger';

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-left min-w-[120px]">
      {label && <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-[10px] font-black text-white">Q{Number(entry.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}


// ── Editable sub-row for materials and labor ─────────────────────────────────
interface SubRowField { key: string; label: string; value: any; type: 'text' | 'number'; small?: boolean; }
function EditableSubRow({ fields, totalQty, totalPrice, onSave, onDelete }: {
  fields: SubRowField[];
  totalQty: number;
  totalPrice: number;
  onSave: (data: Record<string, any>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, any>>(() =>
    Object.fromEntries(fields.map(f => [f.key, f.value]))
  );
  const handleSave = () => {
    toast('Guardar cambios?', {
      description: String(form[fields[0].key] || ''),
      action: { label: 'Confirmar', onClick: () => { onSave(form); setEditing(false); } },
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };
  if (editing) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          {fields.map(f => (
            <div key={f.key} className={f.small ? '' : 'col-span-2'}>
              <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">{f.label}</label>
              <input type={f.type} value={form[f.key]} step={f.type === 'number' ? '0.01' : undefined}
                onChange={e => setForm({ ...form, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1 text-[9px] font-black uppercase focus:outline-none focus:border-amber-400" />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setEditing(false)} className="flex-1 py-1 bg-white border border-slate-200 rounded-lg text-[7px] font-black uppercase text-slate-500">Cancelar</button>
          <button onClick={handleSave} className="flex-1 py-1 bg-amber-500 text-white rounded-lg text-[7px] font-black uppercase">Guardar</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-100 shadow-sm group/sub">
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black text-primary uppercase truncate">{fields[0].value}</p>
        <p className="text-[7px] font-bold text-slate-400 uppercase">{totalQty.toLocaleString(undefined, {maximumFractionDigits:2})} {fields[1]?.value} · Q {fields[2]?.value}/u</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <div className="text-right mr-1">
          <p className="text-[9px] font-black text-slate-600">Q {totalPrice.toLocaleString(undefined, {maximumFractionDigits:2})}</p>
        </div>
        <button onClick={() => { setEditing(true); setForm(Object.fromEntries(fields.map(f => [f.key, f.value]))); }} className="btn-edit opacity-0 group-hover/sub:opacity-100"><Pencil size={10} /></button>
        <button onClick={onDelete} className="btn-delete opacity-0 group-hover/sub:opacity-100"><Trash2 size={10} /></button>
      </div>
    </div>
  );
}
export default function ProjectsModule() {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'kanban'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typologyFilter, setTypologyFilter] = useState('ALL');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null); // item.id being edited
  const [itemEditForm, setItemEditForm] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [exportPdfTemplate, setExportPdfTemplate] = useState('modern');
  const [exportCsvTemplate, setExportCsvTemplate] = useState('completo');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [budgetTree, setBudgetTree] = useState<BudgetLine[]>([]);

  const toggleSelectProject = (id: string) => {
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllProjects = () => {
    if (selectedProjectIds.size === paginatedProjects.length) {
      setSelectedProjectIds(new Set());
    } else {
      setSelectedProjectIds(new Set(paginatedProjects.map(p => p.id)));
    }
  };

  const handleBulkDeleteProjects = () => {
    if (selectedProjectIds.size === 0) return;
    toast('¿Eliminar proyectos seleccionados?', {
      description: `${selectedProjectIds.size} proyecto(s) serán eliminados.`,
      action: { label: 'Eliminar Todo', onClick: async () => {
        try {
          for (const id of selectedProjectIds) await deleteDocument('projects', id);
          toast.success(`${selectedProjectIds.size} proyecto(s) eliminados`);
          setSelectedProjectIds(new Set());
        } catch (e: any) { toast.error('Error', { description: parseError(e) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  // Auto page size based on view mode
  const cardPageSize = useAutoPageSize(180, 300, 4);
  const tablePageSize = useAutoPageSize(44, 260, 6);
  const pageSize = viewMode === 'table' ? tablePageSize : cardPageSize;
  const [editForm, setEditForm] = useState<Partial<Project>>({});
  const [addingItem, setAddingItem] = useState(false);
  const [newItemForm, setNewItemForm] = useState<{
    code: string; description: string; unit: string; projectQuantity: number;
    materials: { name: string; unit: string; quantity: number; price: number }[];
    labor: { role: string; unit: string; quantity: number; price: number }[];
  }>({ code: '', description: '', unit: 'M2', projectQuantity: 1, materials: [], labor: [] });

  useEffect(() => {
    const unsub = subscribeToCollection('staff', (data) => { setAllStaff(data as StaffMember[]); });
    const u2 = subscribeToCollection('clients', (data) => setAllClients(data as Client[]));
    const u3 = subscribeToCollection('transactions', (data) => setTransactions(data));
    return () => { unsub(); u2(); u3(); };
  }, []);

  // Inicializar árbol de presupuesto desde el proyecto seleccionado
  useEffect(() => {
    if (selectedProject) {
      if (selectedProject.budgetTree && selectedProject.budgetTree.length > 0) {
        setBudgetTree(selectedProject.budgetTree);
      } else {
        setBudgetTree(itemsToBudgetTree(selectedProject.items || []));
      }
    } else {
      setBudgetTree([]);
    }
  }, [selectedProject]);

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'EJECUCION' ? p.status === 'EJECUCION' && (p.progress || 0) < 100 : p.status === statusFilter);
    const matchesTypology = typologyFilter === 'ALL' || p.typology === typologyFilter;
    return matchesSearch && matchesStatus && matchesTypology;
  });

  const { 
    currentItems: paginatedProjects, 
    currentPage, 
    totalPages, 
    nextPage, 
    prevPage, 
    goToPage,
    startIndex,
    totalItems
  } = usePagination<Project>(filteredProjects, pageSize);

const handleSaveEdit = () => {
     if (!selectedProject || !Object.keys(editForm).length) return;
     toast('¿Guardar cambios del proyecto?', {
       description: sanitizeString(selectedProject.name),
       action: { label: 'Guardar', onClick: async () => {
         try { await updateDocument('projects', selectedProject.id, editForm); const updated = { ...selectedProject, ...editForm }; setSelectedProject(updated); setIsEditing(false); setEditForm({}); if (editForm.status === 'EJECUCION' && selectedProject.status !== 'EJECUCION') { const created = await generateProjectStock(updated); if (created > 0) toast.info(created + ' materiales agregados al inventario'); } toast.success('Proyecto actualizado', { description: 'Cambios guardados' }); trackCRUD('update', 'project', selectedProject.id); }
         catch (error) { toast.error('Error al guardar', { description: parseError(error) }); }
       }},
       cancel: { label: 'Cancelar', onClick: () => {} }
     });
   };

  const handleUpdateProject = async (updates: Partial<Project>) => {
    if (!selectedProject) return;
    try {
      await updateDocument('projects', selectedProject.id, updates);
      setSelectedProject(prev => prev ? { ...prev, ...updates } : null);
      toast.success("Proyecto actualizado");
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error("Error al guardar", { description: parseError(error) });
    }
  };

  const handleUpdateProgress = async (projectId: string, newProgress: number) => {
    setUpdatingProgress(true);
    try {
      await updateDocument('projects', projectId, { progress: newProgress });
      setSelectedProject(prev => prev ? { ...prev, progress: newProgress } : null);
      toast.success("Progreso actualizado", { description: `El avance es ahora del ${newProgress}%` });
    } catch (error) {
      console.error("Error updating progress:", error);
      toast.error("Error al actualizar", { description: parseError(error) });
    } finally {
      setUpdatingProgress(false);
    }
  };



  const saveItemEdit = () => {
    if (!selectedProject || !editingItem) return;
    const updatedItems = selectedProject.items.map(it =>
      it.id === editingItem ? { ...it, ...itemEditForm } : it
    );
    toast('Guardar cambios del renglon?', {
      description: itemEditForm.description || 'Renglon de presupuesto',
      action: { label: 'Confirmar', onClick: async () => {
        try {
          const { directCosts, budget } = calcBudget(updatedItems, selectedProject);
          await updateDocument('projects', selectedProject.id, { items: updatedItems, directCosts, budget });
          setSelectedProject(prev => prev ? { ...prev, items: updatedItems, directCosts, budget } : null);
          setEditingItem(null); setItemEditForm({});
          toast.success('Renglon actualizado');
        } catch (err) { toast.error('Error', { description: parseError(err) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

    const deleteItem = (itemId: string) => {
    if (!selectedProject) return;
    toast('Eliminar renglon?', {
      description: 'Esta accion no se puede deshacer.',
      action: { label: 'Eliminar', onClick: async () => {
        const updatedItems = selectedProject.items.filter(it => it.id !== itemId);
        try {
          const { directCosts, budget } = calcBudget(updatedItems, selectedProject);
          await updateDocument('projects', selectedProject.id, { items: updatedItems, directCosts, budget });
          setSelectedProject(prev => prev ? { ...prev, items: updatedItems, directCosts, budget } : null);
          toast.success('Renglon eliminado');
        } catch (err) { toast.error('Error', { description: parseError(err) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const saveMaterialEdit = async (itemId: string, matIdx: number, matData: any) => {
    if (!selectedProject) return;
    const updatedItems = selectedProject.items.map(it => {
      if (it.id !== itemId) return it;
      const mats = [...(it.materials || [])];
      mats[matIdx] = { ...mats[matIdx], ...matData };
      return { ...it, materials: mats };
    });
    const { directCosts, budget } = calcBudget(updatedItems, selectedProject);
    await updateDocument('projects', selectedProject.id, { items: updatedItems, directCosts, budget });
    setSelectedProject(prev => prev ? { ...prev, items: updatedItems, directCosts, budget } : null);
  };

  const deleteMaterial = (itemId: string, matIdx: number) => {
    if (!selectedProject) return;
    toast('Eliminar material?', {
      description: 'Esta accion no se puede deshacer.',
      action: { label: 'Eliminar', onClick: async () => {
        const updatedItems = selectedProject.items.map(it => {
          if (it.id !== itemId) return it;
          return { ...it, materials: (it.materials || []).filter((_: any, i: number) => i !== matIdx) };
        });
        const { directCosts, budget } = calcBudget(updatedItems, selectedProject);
        await updateDocument('projects', selectedProject.id, { items: updatedItems, directCosts, budget });
        setSelectedProject(prev => prev ? { ...prev, items: updatedItems, directCosts, budget } : null);
        toast.success('Material eliminado');
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const addMaterial = async (itemId: string) => {
    if (!selectedProject) return;
    const newMat = { name: 'Nuevo Material', unit: 'U', quantity: 1, price: 0 };
    const updatedItems = selectedProject.items.map(it =>
      it.id === itemId ? { ...it, materials: [...(it.materials || []), newMat] } : it
    );
    const { directCosts, budget } = calcBudget(updatedItems, selectedProject);
    await updateDocument('projects', selectedProject.id, { items: updatedItems, directCosts, budget });
    setSelectedProject(prev => prev ? { ...prev, items: updatedItems, directCosts, budget } : null);
  };

  const saveLaborEdit = async (itemId: string, labIdx: number, labData: any) => {
    if (!selectedProject) return;
    const updatedItems = selectedProject.items.map(it => {
      if (it.id !== itemId) return it;
      const labs = [...(it.labor || [])];
      labs[labIdx] = { ...labs[labIdx], ...labData };
      return { ...it, labor: labs };
    });
    const { directCosts, budget } = calcBudget(updatedItems, selectedProject);
    await updateDocument('projects', selectedProject.id, { items: updatedItems, directCosts, budget });
    setSelectedProject(prev => prev ? { ...prev, items: updatedItems, directCosts, budget } : null);
  };

  const deleteLabor = (itemId: string, labIdx: number) => {
    if (!selectedProject) return;
    toast('Eliminar mano de obra?', {
      description: 'Esta accion no se puede deshacer.',
      action: { label: 'Eliminar', onClick: async () => {
        const updatedItems = selectedProject.items.map(it => {
          if (it.id !== itemId) return it;
          return { ...it, labor: (it.labor || []).filter((_: any, i: number) => i !== labIdx) };
        });
        const { directCosts, budget } = calcBudget(updatedItems, selectedProject);
        await updateDocument('projects', selectedProject.id, { items: updatedItems, directCosts, budget });
        setSelectedProject(prev => prev ? { ...prev, items: updatedItems, directCosts, budget } : null);
        toast.success('Mano de obra eliminada');
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const addLabor = async (itemId: string) => {
    if (!selectedProject) return;
    const newLab = { role: 'Nuevo Rol', unit: 'dia', quantity: 1, price: 0 };
    const updatedItems = selectedProject.items.map(it =>
      it.id === itemId ? { ...it, labor: [...(it.labor || []), newLab] } : it
    );
    const { directCosts, budget } = calcBudget(updatedItems, selectedProject);
    await updateDocument('projects', selectedProject.id, { items: updatedItems, directCosts, budget });
    setSelectedProject(prev => prev ? { ...prev, items: updatedItems, directCosts, budget } : null);
  };

  // Recalculates directCosts and budget from items array
  const calcBudget = (items: any[], project: Project) => {
    const directCosts = items.reduce((acc, item) => {
      const matCost = (item.materials || []).reduce((a: number, m: any) => a + m.price * m.quantity * (item.projectQuantity || 1), 0);
      const labCost = (item.labor || []).reduce((a: number, l: any) => a + l.price * l.quantity * (item.projectQuantity || 1), 0);
      return acc + matCost + labCost;
    }, 0);
    const indirect = directCosts * (project.indirectCosts || 0) / 100;
    const admin = directCosts * (project.administrativeCosts || 0) / 100;
    const personal = directCosts * (project.personalCosts || 0) / 100;
    const budget = directCosts + indirect + admin + personal;
    return { directCosts, budget };
  };

const addItem = async () => {
     if (!selectedProject) return;
     if (!newItemForm.code || !newItemForm.description) {
       toast.error('Código y descripción son requeridos');
       return;
     }
     const newItem = {
       id: `item_${Date.now()}`,
       code: sanitizeString(newItemForm.code),
       description: sanitizeString(newItemForm.description),
       unit: newItemForm.unit,
       projectQuantity: newItemForm.projectQuantity,
       selected: true,
       typology: selectedProject.typology,
       durationDays: 1,
       category: 'PERSONALIZADO',
       materials: newItemForm.materials,
       labor: newItemForm.labor,
     };
     const updatedItems = [...selectedProject.items, newItem];
     const { directCosts, budget } = calcBudget(updatedItems, selectedProject);
     try {
       await updateDocument('projects', selectedProject.id, { items: updatedItems, directCosts, budget });
       setSelectedProject(prev => prev ? { ...prev, items: updatedItems, directCosts, budget } : null);
       setAddingItem(false);
       setNewItemForm({ code: '', description: '', unit: 'M2', projectQuantity: 1, materials: [], labor: [] });
       toast.success('Renglon agregado', { description: `Presupuesto actualizado: Q ${budget.toLocaleString()}` });
       trackCRUD('create', 'project-item', selectedProject.id);
     } catch (err) {
       toast.error('Error al agregar renglon', { description: parseError(err) });
     }
   };

  useEffect(() => {
    const unsub = subscribeToCollection('projects', (data) => {
      setProjects(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toast("¿Confirmar eliminación?", {
      description: "Esta acción no se puede deshacer.",
      action: {
        label: "Eliminar",
        onClick: async () => {
          try {
            await deleteDocument('projects', id);
            toast.success("Proyecto eliminado", { description: "Se ha eliminado del portafolio" });
          } catch (error) {
            console.error(error);
            toast.error("Error al eliminar", { description: parseError(error) });
          }
        }
      },
      cancel: { label: "Cancelar", onClick: () => {} }
    });
  };

  const handleExportCSV = () => {
    if (filteredProjects.length === 0) return;

    generateCSV({
      title: 'Reporte de Proyectos',
      projectName: 'Portafolio',
      clientName: 'General',
      headers: ['ID', 'Nombre', 'Cliente', 'Estado', 'Tipologia', 'Ubicacion', 'Fecha Inicio', 'Fecha Fin', 'Presupuesto', 'Progreso'],
      rows: filteredProjects.map(p => [
        p.id.slice(-6).toUpperCase(),
        p.name,
        p.clientName,
        p.status,
        p.typology,
        p.location || 'N/A',
        p.startDate,
        p.endDate || 'N/A',
        p.budget,
        `${p.progress}%`
      ])
    });
  };



const ProjectCard = React.memo(({ project }: { project: any; [key: string]: any }) => (
     <motion.div
       initial={{ opacity: 0, y: 10 }}
       animate={{ opacity: 1, y: 0 }}
       onClick={() => { if (bulkMode) { toggleSelectProject(project.id); } else { setSelectedProject(project); } }}
       className={`bg-white  rounded-xl sm:rounded-2xl border border-slate-200  shadow-sm  overflow-hidden hover:shadow-lg hover:border-secondary/50 transition-all cursor-pointer group flex flex-col h-full interactive-card shimmer-effect relative ${selectedProjectIds.has(project.id) ? "ring-2 ring-red-500" : ""}`}
     >
       {bulkMode && (
         <div className="absolute top-3 left-3 z-10" onClick={e => e.stopPropagation()}>
           <input type="checkbox" checked={selectedProjectIds.has(project.id)} onChange={() => toggleSelectProject(project.id)}
             className="w-4 h-4 accent-red-500 cursor-pointer" />
         </div>
       )}
       <div className="p-4 space-y-3 flex-1">
         <div className="flex justify-between items-start">
           <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-secondary group-hover:scale-105 transition-transform duration-300 icon-box icon-gradient-blue">
             <Building2 size={20} />
           </div>
           <div className="flex flex-col items-end sm:items-end">
             <span className={cn(
               "px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest",
               project.status === 'EJECUCION' ? "bg-secondary text-primary" :
               project.status === 'COTIZACION' ? "bg-blue-500 text-white" :
               "bg-green-500 text-white"
             )}>
               {project.status}
             </span>
             <span className="text-[7px] sm:text-[6px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Cód: {project.id.slice(-6).toUpperCase()}</span>
           </div>
         </div>

         <div className="space-y-0.5">
           <h3 className="text-[10px] sm:text-xs font-black text-primary uppercase tracking-tight line-clamp-1 group-hover:text-secondary transition-colors italic">{project.name}</h3>
           <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">{project.clientName}</p>
         </div>

         <div className="pt-2 space-y-1.5 border-t border-slate-50">
           <div className="flex justify-between items-end">
             <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Progreso</span>
             <div className="flex items-center gap-1">
               {project.status === 'EJECUCION' && (new Date().getTime() - new Date(project.startDate).getTime()) / (new Date(project.endDate || project.startDate).getTime() - new Date(project.startDate).getTime() || 1) > 0.1 && (project.progress || 0) < 10 && (
                  <span title="Progreso atrasado respecto al tiempo transcurrido"><AlertCircle size={10} className="text-red-500 animate-pulse" /></span>
               )}
               <span className="text-[9px] font-black text-primary">{project.progress || 0}%</span>
               <div className="w-1 h-1 rounded-full bg-secondary animate-pulse" />
             </div>
           </div>
           <div className="h-1.5 bg-slate-100  rounded-full overflow-hidden w-full relative">
             <motion.div
               initial={{ width: 0 }}
               animate={{ width: `${project.progress || 0}%` }}
               className={cn(
                 "h-full rounded-full transition-all duration-1000 relative z-10",
                 project.status === 'EJECUCION' ? "bg-secondary" : "bg-slate-400"
               )}
             />
           </div>
         </div>
       </div>

       <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-50 flex justify-between items-center mt-auto">
         <div className="flex flex-col">
           <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Presupuesto</span>
           <span className="text-[11px] font-black text-primary italic leading-none">Q {(project.budget || 0).toLocaleString()}</span>
         </div>
         <button
           onClick={(e) => handleDelete(e, project.id)}
           className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
         >
           <Trash2 size={14} />
         </button>
       </div>
     </motion.div>
   ));

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const stats = {
    total: projects.length,
    cotizaciones: projects.filter(p => p.status === 'COTIZACION').length,
    ejecucion: projects.filter(p => p.status === 'EJECUCION').length,
  };

  if (view === 'create') {
    return (
      <div className="space-y-12 pb-20">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setView('list')}
            className="flex items-center gap-3 text-slate-400 hover:text-slate-900 transition-all text-[10px] font-black uppercase tracking-[0.2em] group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
            Listado General de Obras
          </button>
          <div className="text-right">
            <h1 className="text-xl font-black text-primary uppercase tracking-tight italic">Asistente de Configuración</h1>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Configuración técnica de proyecto</p>
          </div>
        </div>
        
        <AdvancedProjectCreator onComplete={() => setView('list')} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div id="projects-dashboard" className="space-y-6 animate-in fade-in duration-500 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] scroll-mb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-primary uppercase">Proyectos</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Control de portafolio y presupuestos</p>
        </div>
          <div className="flex w-full md:w-auto gap-2">
            <button 
              onClick={handleExportCSV}
              className="flex-1 md:flex-none border border-slate-200 bg-white text-slate-600 px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download size={18} /> Exportar
            </button>
            <button 
              onClick={() => setView('create')}
              className="btn-primary-enhanced btn-liquid flex-[2] md:flex-none px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg"
            >
              <Plus size={18} /> Nueva Cotización
            </button>
          </div>
      </div>

      {/* ── KPIs financieros ── */}
      {(() => {
        const totalBudget   = projects.reduce((s, p) => s + (p.budget || 0), 0);
        const inExec        = projects.filter(p => p.status === 'EJECUCION');
        const inExecIds     = inExec.map(p => p.id);
        const execBudget    = inExec.reduce((s, p) => s + (p.budget || 0), 0);
        const totalExecuted = (() => {
          const fromTx = transactions
            .filter(t => t.type === 'GASTO' && t.projectId && inExecIds.includes(t.projectId))
            .reduce((s, t) => s + (t.amount || 0), 0);
          if (fromTx > 0) return fromTx;
          return inExec.reduce((s, p) => s + (p.budget || 0) * ((p.progress || 0) / 100), 0);
        })();
        const deviation     = execBudget > 0 ? ((totalExecuted - execBudget) / execBudget) * 100 : 0;
        // Proyectos con retraso real: tiempo transcurrido > avance físico + 10%
        const delayed = inExec.filter(p => {
          if (!p.startDate || !p.endDate) return false;
          const total = new Date(p.endDate).getTime() - new Date(p.startDate).getTime();
          const elapsed = Date.now() - new Date(p.startDate).getTime();
          const expectedProgress = Math.min(100, (elapsed / total) * 100);
          return (p.progress || 0) < expectedProgress - 10;
        });
return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
{[
                 { icon: <Building2 size={12} className="text-blue-500" />,    label: 'Total Proyectos',   value: projects.length,          sub: `${stats.ejecucion} en ejecución`, color: 'text-blue-700' },
                 { icon: <DollarSign size={12} className="text-amber-500" />,  label: 'Presupuesto Total', value: `Q ${Math.round(totalBudget/1000)}k`, sub: `Q ${Math.round(execBudget/1000)}k activo`, color: 'text-amber-700' },
{ icon: <TrendingUp size={12} className="text-green-500" />,  label: 'Ejecutado',         value: `Q ${Math.round(totalExecuted/1000)}k`, sub: deviation !== 0 ? `${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}% desv.` : 'Sin desviación', color: deviation > 5 ? 'text-red-600' : 'text-green-700' },
                 { icon: <AlertCircle size={12} className={delayed.length > 0 ? 'text-red-500' : 'text-green-500'} />, label: 'Con Retraso', value: delayed.length, sub: delayed.length > 0 ? delayed[0].name : 'Al día', color: delayed.length > 0 ? 'text-red-600' : 'text-green-700' },
              ].map(k => (
                <div key={k.label} className="bg-white  border border-slate-200  rounded-lg p-2 sm:p-3 shadow-sm ">
                  <div className="flex items-center gap-1 mb-1">{k.icon}<span className="text-[6px] sm:text-[7px] font-black text-slate-400  uppercase">{k.label}</span></div>
                  <p className={cn('text-base sm:text-lg font-black', k.color)}>{k.value}</p>
                  <p className="text-[6px] sm:text-[7px] font-bold text-slate-400  uppercase mt-0.5 truncate">{k.sub}</p>
                </div>
              ))}
           </div>
         );
      })()}

      <div className="bg-white  rounded-2xl border border-slate-200  shadow-sm  overflow-hidden">
<div className="p-3 md:p-4 border-b border-slate-100  flex flex-col md:flex-row justify-between items-center gap-3">
             <div className="relative flex-1 w-full max-w-md">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 " size={16} />
               <input
                type="text"
                placeholder="BUSCAR PROYECTO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50  border border-slate-200  rounded-lg pl-10 pr-3 py-2 text-[9px] font-black uppercase focus:outline-none focus:border-secondary :border-secondary transition-all placeholder:text-slate-400  text-slate-900 "
               />
             </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
               <div className="flex bg-slate-100  p-0.5 rounded-lg">
                 <button
                  onClick={() => setViewMode('table')}
                  title="Vista de Tabla"
                  className={cn("p-1.5 rounded-md transition-all", viewMode === 'table' ? "bg-white  text-slate-900  shadow-sm " : "text-slate-400  hover:text-slate-600 ")}
                 >
                   <ListFilter size={15} />
                 </button>
                 <button
                  onClick={() => setViewMode('grid')}
                  title="Vista de Cuadrícula"
                  className={cn("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-white  text-slate-900  shadow-sm " : "text-slate-400  hover:text-slate-600 ")}
                 >
                  <ListFilter size={15} />
                </button>
                <button
                 onClick={() => setViewMode('grid')}
                 title="Vista de Cuadrícula"
                 className={cn("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                >
                  <LayoutGrid size={15} />
                </button>
              </div>

                <button
                  onClick={() => setViewMode('kanban')}
                  title="Vista Kanban"
                  className={cn("p-1.5 rounded-md transition-all", viewMode === 'kanban' ? "bg-white  text-slate-900  shadow-sm " : "text-slate-400  hover:text-slate-600 ")}
                >
                  <Layers size={15} />
                </button>
                <button type="button" title="Selección múltiple" onClick={() => { setBulkMode(!bulkMode); if (bulkMode) setSelectedProjectIds(new Set()); }}
                  className={`px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest transition-all ${bulkMode ? 'bg-red-500 text-white shadow-sm ' : 'bg-slate-100  text-slate-500  hover:text-slate-800 '}`}>
                 {bulkMode ? 'Cancelar' : 'Seleccionar'}
               </button>
               <div className="flex flex-col gap-0.5 min-w-[120px]">
                <span className="text-[6px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                  <Clock size={7} /> Estado
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-[7px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary shadow-sm cursor-pointer w-full md:min-w-[120px]"
                >
                  <option value="ALL">TODOS</option>
                  <option value="COTIZACION">COTIZACIÓN</option>
                  <option value="EJECUCION">EJECUCIÓN</option>
                  <option value="FINALIZADO">FINALIZADO</option>
                </select>
              </div>

              <div className="flex flex-col gap-0.5 min-w-[120px]">
                <span className="text-[6px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                  <Building2 size={7} /> Tipología
                </span>
                <select
                  value={typologyFilter}
                  onChange={(e) => setTypologyFilter(e.target.value)}
                  className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-[7px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary shadow-sm cursor-pointer w-full md:min-w-[120px]"
                >
                 <option value="ALL">TODAS</option>
                 {Object.values(Typology).map(t => (
                   <option key={t} value={t}>{t}</option>
                 ))}
               </select>
             </div>
           </div>
        </div>

{viewMode === 'table' ? (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[480px] sm:min-w-[600px]">
               <thead>
                 <tr className="bg-slate-50/50 border-b border-slate-100">
                   {bulkMode && (
                     <th className="px-2 py-2 w-6">
                       <input type="checkbox" checked={paginatedProjects.length > 0 && selectedProjectIds.size === paginatedProjects.length}
                         onChange={toggleSelectAllProjects} className="w-3.5 h-3.5 accent-red-500 cursor-pointer" />
                     </th>
                   )}
                   <th className="px-4 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest">Proyecto</th>
                    <th className="hidden sm:table-cell px-2 sm:px-4 py-2 text-[6px] sm:text-[7px] font-black text-slate-400  uppercase tracking-widest">Cliente</th>
                   <th className="px-4 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                   <th className="px-4 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right">#</th>
                 </tr>
               </thead>
                <tbody className="divide-y divide-slate-50 ">
                  {paginatedProjects.map((project, i) => (
                    <motion.tr
                      key={project.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.05 }}
                      onClick={() => { if (bulkMode) { toggleSelectProject(project.id); } else { setSelectedProject(project); } }}
                      className={`group hover:bg-slate-50/50 /50 transition-colors cursor-pointer ${selectedProjectIds.has(project.id) ? "bg-red-50  border-l-2 border-red-500" : ""}`}
                    >
                     {bulkMode && (
                       <td className="px-2 py-2 w-6" onClick={e => e.stopPropagation()}>
                         <input type="checkbox" checked={selectedProjectIds.has(project.id)} onChange={() => toggleSelectProject(project.id)}
                           className="w-3.5 h-3.5 accent-red-500 cursor-pointer" />
                       </td>
                     )}
                     <td className="px-4 py-2">
                       <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100  flex items-center justify-center text-primary border border-slate-200  shrink-0 group-hover:bg-slate-900 :bg-slate-700 group-hover:text-secondary transition-all">
                           <Building2 size={14} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-[7px] sm:text-[8px] font-black text-primary uppercase tracking-tight truncate max-w-[80px] sm:max-w-[120px] md:max-w-none group-hover:text-secondary transition-colors">{project.name}</p>
                            <p className="text-[6px] text-slate-400  font-bold uppercase tracking-widest truncate">Cód: {project.id.slice(-6).toUpperCase()}</p>
                         </div>
                       </div>
                     </td>
                      <td className="hidden sm:table-cell px-2 sm:px-4 py-2">
                       <div className="flex flex-col">
                          <span className="text-[7px] font-black text-slate-900  uppercase truncate max-w-[120px]">{project.clientName}</span>
                          <span className="text-[6px] font-bold text-slate-400  uppercase tracking-widest">{project.typology}</span>
                       </div>
                     </td>
                     <td className="px-4 py-2">
                       <div className="flex flex-col gap-1 min-w-[70px]">
                         <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest">
                           <span className={cn(
                             project.status === 'EJECUCION' ? "text-secondary" :
                             project.status === 'COTIZACION' ? "text-blue-500" :
                             "text-green-500"
                           )}>{project.status}</span>
                           <span className="text-slate-400">{project.progress || 0}%</span>
                         </div>
                          <div className="h-1.5 bg-slate-100  rounded-full overflow-hidden w-full">
                           <motion.div
                             initial={{ width: 0 }}
                             animate={{ width: `${project.progress || 0}%` }}
                             className={cn(
                               "h-full rounded-full",
                               project.status === 'EJECUCION' ? "bg-slate-900" : "bg-slate-400"
                             )}
                           />
                         </div>
                       </div>
                     </td>
                     <td className="px-4 py-2 text-right">
                       <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => handleDelete(e, project.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-300  hover:text-red-500 hover:bg-red-50 :bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                          <button className="w-7 h-7 flex items-center justify-center rounded-md text-slate-300  group-hover:text-secondary group-hover:bg-slate-900 :bg-slate-700 transition-all">
                           <ChevronRight size={14} />
                         </button>
                       </div>
                     </td>
                   </motion.tr>
                 ))}
               </tbody>
             </table>
           </div>
         ) : (
            <div className="p-2 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {paginatedProjects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06, ease: 'easeOut' }}
              >
                <ProjectCard project={project} />
              </motion.div>
            ))}
        {viewMode === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
            {[
              { id: 'COTIZACION', label: 'Cotizacion', color: 'bg-slate-100  border-slate-200 ', dot: 'bg-slate-400 ' },
{ id: 'EJECUCION', label: 'Ejecucion', color: 'bg-blue-50  border-blue-200 ', dot: 'bg-blue-500' },
               { id: 'FINALIZADO', label: 'Finalizado', color: 'bg-green-50  border-green-200 ', dot: 'bg-green-500' },
            ].map(col => (
              <div key={col.id} className={`rounded-2xl border p-4 space-y-3 ${col.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 ">{col.label}</span>
                   <span className="ml-auto text-[8px] font-black bg-white  rounded-full px-2 py-0.5 text-slate-700 ">{filteredProjects.filter(p => p.status === col.id).length}</span>
                </div>
                {filteredProjects.filter(p => p.status === col.id).map((p, ki) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: ki * 0.07 }}
                    onClick={() => setSelectedProject(p)}
                    className="bg-white  rounded-xl p-3 shadow-sm  border border-white  hover:border-secondary cursor-pointer transition-all space-y-2"
                  >
                    <p className="text-[10px] font-black text-primary uppercase leading-tight">{p.name}</p>
                     <p className="text-[8px] text-slate-600  font-bold uppercase">{p.clientName}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black text-secondary">Q {(p.budget || 0).toLocaleString()}</span>
                      <div className="w-16 h-1.5 bg-slate-100  rounded-full overflow-hidden">
                        <div className="h-full bg-slate-900  rounded-full" style={{ width: `${p.progress || 0}%` }} />
                      </div>
                    </div>
                  </motion.div>
                ))}
                {filteredProjects.filter(p => p.status === col.id).length === 0 && (
                  <div className="text-center py-6 text-[8px] font-black text-slate-300  uppercase tracking-widest">Sin proyectos</div>
                )}
              </div>
            ))}
          </div>
        )}
          </div>
        )}
        
        <div className="px-6 pb-4">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onNext={nextPage}
            onPrev={prevPage}
            onPage={goToPage}
            totalItems={totalItems}
            startIndex={startIndex}
            itemsPerPage={pageSize}
            compact={true}
          />
        </div>
      </div>
        
      <Modal
        isOpen={!!selectedProject}
        onClose={() => {
          setSelectedProject(null);
          setExpandedItems([]);
          setAddingItem(false);
          setNewItemForm({ code: '', description: '', unit: 'M2', projectQuantity: 1, materials: [], labor: [] });
        }}
        title="Detalles del Proyecto"
      >
        {selectedProject && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8 text-left"
          >
            <div className="border-b border-slate-100  pb-6 space-y-3">
              {/* Fila 1: icono + titulo + boton editar */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-900  rounded-2xl flex items-center justify-center text-secondary shrink-0 shadow-lg shadow-slate-900/20 ">
                  <Building2 size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-black text-primary uppercase tracking-tight leading-none mb-1 truncate">{selectedProject.name}</h2>
                  <p className="text-[8px] sm:text-[9px] font-black text-secondary tracking-[0.2em] uppercase truncate">ID: {selectedProject.id?.toUpperCase()}</p>
                </div>
                {isEditing ? (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setIsEditing(false); setEditForm({}); }} className="px-3 py-1.5 bg-slate-100  text-slate-600  rounded-lg text-xs font-bold uppercase">Cancelar</button>
                    <button onClick={handleSaveEdit} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase">Guardar</button>
                  </div>
                ) : (
                  <button onClick={() => { setIsEditing(true); setEditForm({ name: selectedProject.name, clientName: selectedProject.clientName, status: selectedProject.status, startDate: selectedProject.startDate, endDate: selectedProject.endDate, location: selectedProject.location }); }} className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-slate-900  text-white rounded-lg text-xs font-bold uppercase">
                    <Settings2 size={14} /> Editar
                  </button>
                )}
              </div>
              {/* Fila 2: controles de exportacion */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[7px] font-black text-slate-400  uppercase tracking-widest">Plantilla PDF</span>
                  <select value={exportPdfTemplate} onChange={e => setExportPdfTemplate(e.target.value)} className="h-8 bg-white  border border-slate-200  rounded-lg px-2 text-[8px] font-black uppercase focus:outline-none focus:border-secondary cursor-pointer text-slate-900 ">
                    {PDF_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <button onClick={() => { setTimeout(async () => { await generateProjectPDF(selectedProject, exportPdfTemplate); }, 50); }} className="h-8 flex items-center gap-1 px-2 sm:px-3 bg-secondary text-primary rounded-lg text-[7px] sm:text-[8px] font-black uppercase hover:bg-secondary/90 transition-all">
                  <Download size={12} /> PDF
                </button>
                <button onClick={() => generateProjectCSV(selectedProject, exportCsvTemplate)} className="h-8 flex items-center gap-1.5 px-3 bg-slate-900  text-white rounded-lg text-[8px] font-black uppercase hover:bg-slate-700  transition-all">
                  <Download size={12} /> CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {isEditing && (
                <div className="col-span-2 md:col-span-4 bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                  <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Modo Edicion</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre</label><input value={editForm.name||""} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-amber-400" /></div>
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cliente</label>
                      <select value={editForm.clientName||""} onChange={e=>setEditForm(p=>({...p,clientName:e.target.value}))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-amber-400">
                        <option value="">— Seleccionar —</option>
                        {allClients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        {editForm.clientName && !allClients.find(c => c.name === editForm.clientName) && <option value={editForm.clientName}>{editForm.clientName}</option>}
                      </select>
                    </div>
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Estado</label><select value={editForm.status||""} onChange={e=>setEditForm(p=>({...p,status:e.target.value as any}))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-amber-400"><option value="COTIZACION">Cotizacion</option><option value="EJECUCION">Ejecucion</option><option value="FINALIZADO">Finalizado</option></select></div>
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ubicacion</label><input value={editForm.location||""} onChange={e=>setEditForm(p=>({...p,location:e.target.value}))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-amber-400" /></div>
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha Inicio</label><input type="date" value={editForm.startDate||""} onChange={e=>setEditForm(p=>({...p,startDate:e.target.value}))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-amber-400" /></div>
                    <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha Fin</label><input type="date" value={editForm.endDate||""} onChange={e=>setEditForm(p=>({...p,endDate:e.target.value}))} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-amber-400" /></div>
                  </div>
                </div>
              )}
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                <p className="text-xs font-black text-primary uppercase">{selectedProject.clientName}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Ubicación</p>
                <input 
                  value={selectedProject.location || ''}
                  onBlur={(e) => handleUpdateProject({ location: e.target.value })}
                  onChange={(e) => setSelectedProject({ ...selectedProject, location: e.target.value })}
                  className="w-full text-xs font-black text-primary uppercase border border-slate-200 rounded-lg p-1"
                />
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Inicio</p>
                <p className="text-xs font-black text-primary uppercase flex items-center gap-1">
                  <Calendar size={10} className="text-secondary" />
                  {selectedProject.startDate || 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Adjuntos</p>
                <input 
                  type="file"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const url = await uploadFile(file, `projects/${selectedProject.id}/${file.name}`);
                        handleUpdateProject({ attachments: [...(selectedProject.attachments || []), url] });
                        toast.success("Archivo adjunto exitosamente");
                      } catch (err) {
                        toast.error("Error al subir el archivo");
                      }
                    }
                  }}
                  className="text-[8px] text-primary"
                />
                {selectedProject.attachments && selectedProject.attachments.length > 0 && <span className="text-[8px]">{selectedProject.attachments.length} adjuntos</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Settings2 size={14} className="text-secondary" /> Breakdown de Costos
                  </h4>
                  {/* Curva S: avance físico vs tiempo transcurrido */}
                  {(() => {
                    if (!selectedProject.startDate) return null;
                    const start = new Date(selectedProject.startDate).getTime();
                    const end   = selectedProject.endDate ? new Date(selectedProject.endDate).getTime() : start + 90 * 86400000;
                    const total = end - start;
                    const today = Date.now();
                    const elapsed = Math.min(100, Math.max(0, ((today - start) / total) * 100));
                    // Generar puntos de curva S teórica (distribución normal acumulada aproximada)
                    const sCurve = Array.from({ length: 11 }, (_, i) => {
                      const t = i * 10;
                      // Curva S: distribución logística
                      const theoretical = Math.round(100 / (1 + Math.exp(-0.1 * (t - 50))));
                      const actual = t <= Math.round(elapsed) ? Math.round((selectedProject.progress || 0) * (t / Math.round(elapsed || 1))) : null;
                      return { t: `${t}%`, theoretical, actual };
                    });
                    return (
                      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase">Curva S — Avance Físico vs Tiempo</span>
                          <div className="flex items-center gap-3 text-[7px] font-bold text-slate-400 uppercase">
                            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block" /> Teórico</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Real</span>
                          </div>
                        </div>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sCurve}>
                              <XAxis dataKey="t" fontSize={8} />
                              <YAxis fontSize={8} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                              <Tooltip formatter={(v: any) => `${v}%`} />
                              <ReferenceLine x={`${Math.round(elapsed)}%`} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Hoy', fontSize: 8, fill: '#ef4444' }} />
                              <Line type="monotone" dataKey="theoretical" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                              <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[8px] font-bold">
                          <span className="text-slate-400">Tiempo transcurrido: <span className="text-slate-700">{Math.round(elapsed)}%</span></span>
                          <span className={cn('font-black', (selectedProject.progress || 0) < elapsed - 10 ? 'text-red-500' : 'text-green-600')}>
                            {(selectedProject.progress || 0) < elapsed - 10 ? `⚠ Retraso ${Math.round(elapsed - (selectedProject.progress || 0))}%` : '✓ Al día'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="h-48 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Materiales', value: selectedProject.items.reduce((acc, item) => acc + (item.materials?.reduce((a, m) => a + (m.price * m.quantity * (item.projectQuantity || 1)), 0) || 0), 0) },
                        { name: 'Mano de Obra', value: selectedProject.items.reduce((acc, item) => acc + (item.labor?.reduce((a, l) => a + (l.price * l.quantity * (item.projectQuantity || 1)), 0) || 0), 0) }
                      ]}>
                        <XAxis dataKey="name" fontSize={10} />
                        <YAxis fontSize={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill="#F15A24">
                          <Cell fill="#F15A24" />
                          <Cell fill="#1A1A1A" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm group">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Costo Directo</p>
                      <p className="text-sm font-black text-primary uppercase group-hover:text-secondary">Q {(selectedProject.directCosts || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Indirecto ({selectedProject.indirectCosts || 0}%)</p>
                      <p className="text-sm font-black text-slate-600 uppercase">Q {((selectedProject.directCosts || 0) * (selectedProject.indirectCosts || 0) / 100).toLocaleString()}</p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Admin ({selectedProject.administrativeCosts || 0}%)</p>
                      <p className="text-sm font-black text-slate-600 uppercase">Q {((selectedProject.directCosts || 0) * (selectedProject.administrativeCosts || 0) / 100).toLocaleString()}</p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Personal ({selectedProject.personalCosts || 0}%)</p>
                      <p className="text-sm font-black text-slate-600 uppercase">Q {((selectedProject.directCosts || 0) * (selectedProject.personalCosts || 0) / 100).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Users size={14} className="text-secondary" /> Equipo Asignado
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">
                        {selectedProject.teamIds?.length || 0} miembro{(selectedProject.teamIds?.length || 0) !== 1 ? 's' : ''}
                      </span>
                      <button 
                        onClick={() => toast.info('Gestión de equipo', { description: 'Ve al módulo de Personal para asignar/desasignar miembros del equipo a este proyecto.' })}
                        className="text-[8px] font-black text-secondary hover:text-primary bg-secondary/10 hover:bg-secondary/20 px-2 py-1 rounded-lg transition-all uppercase tracking-widest"
                      >
                        Gestionar
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    {selectedProject.teamIds && selectedProject.teamIds.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {allStaff.filter(s => selectedProject.teamIds?.includes(s.id)).map(member => (
                          <div key={member.id} className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                            <div className="w-8 h-8 rounded-lg bg-slate-900 text-secondary flex items-center justify-center font-black text-[10px] group-hover:bg-secondary group-hover:text-primary transition-all">
                              {member.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black text-primary uppercase truncate group-hover:text-secondary transition-colors">{member.name}</p>
                              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{member.role}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[8px] font-black text-slate-600">Q {Number(member.salary || 0).toLocaleString('es-GT')}</p>
                              <p className="text-[6px] font-bold text-slate-400 uppercase">Salario</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Users size={24} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-[9px] font-bold text-slate-400 uppercase italic mb-2">Sin personal asignado específicamente</p>
                        <button 
                          onClick={() => toast.info('Asignar personal', { description: 'Ve al módulo de Personal para asignar miembros del equipo a este proyecto.' })}
                          className="text-[8px] font-black text-secondary hover:text-primary bg-secondary/10 hover:bg-secondary/20 px-3 py-1.5 rounded-lg transition-all uppercase tracking-widest"
                        >
                          Asignar Personal
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Box size={14} className="text-secondary" /> Inventario del Proyecto
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold text-slate-400 uppercase">
                        {(() => {
                          const projectInventory = transactions.filter(t => t.projectId === selectedProject.id);
                          return projectInventory.length;
                        })()} items
                      </span>
                      <button 
                        onClick={() => toast.info('Gestión de inventario', { description: 'Ve al módulo de Inventario y filtra por este proyecto para gestionar materiales.' })}
                        className="text-[8px] font-black text-secondary hover:text-primary bg-secondary/10 hover:bg-secondary/20 px-2 py-1 rounded-lg transition-all uppercase tracking-widest"
                      >
                        Ver Inventario
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    {(() => {
                      // Calcular estadísticas de inventario del proyecto
                      const projectMaterials = selectedProject.items?.reduce((acc: any[], item) => {
                        (item.materials || []).forEach((m: any) => {
                          const existing = acc.find(x => x.name === m.name);
                          if (existing) {
                            existing.budgetedQty += m.quantity * (item.projectQuantity || 1);
                            existing.budgetedValue += m.price * m.quantity * (item.projectQuantity || 1);
                          } else {
                            acc.push({
                              name: m.name,
                              unit: m.unit || 'U',
                              budgetedQty: m.quantity * (item.projectQuantity || 1),
                              budgetedValue: m.price * m.quantity * (item.projectQuantity || 1),
                              currentStock: 0 // Se actualizaría con datos reales del inventario
                            });
                          }
                        });
                        return acc;
                      }, []) || [];
                      
                      const totalBudgetedValue = projectMaterials.reduce((acc, m) => acc + m.budgetedValue, 0);
                      const topMaterials = projectMaterials.sort((a, b) => b.budgetedValue - a.budgetedValue).slice(0, 5);
                      
                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Materiales</p>
                              <p className="text-lg font-black text-primary">{projectMaterials.length}</p>
                              <p className="text-[6px] font-bold text-slate-400 uppercase">tipos</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                              <p className="text-lg font-black text-primary">Q {Math.round(totalBudgetedValue/1000)}k</p>
                              <p className="text-[6px] font-bold text-slate-400 uppercase">presupuestado</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado</p>
                              <p className="text-lg font-black text-amber-600">Pendiente</p>
                              <p className="text-[6px] font-bold text-slate-400 uppercase">compras</p>
                            </div>
                          </div>
                          
                          {topMaterials.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1">Principales Materiales</p>
                              {topMaterials.map((material, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[9px] font-black text-primary uppercase truncate">{material.name}</p>
                                    <p className="text-[7px] font-bold text-slate-400 uppercase">{material.budgetedQty.toLocaleString()} {material.unit}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[8px] font-black text-slate-600">Q {material.budgetedValue.toLocaleString()}</p>
                                    <p className="text-[6px] font-bold text-slate-400 uppercase">presupuesto</p>
                                  </div>
                                </div>
                              ))}
                              {projectMaterials.length > 5 && (
                                <p className="text-[7px] font-bold text-slate-400 uppercase text-center pt-1">
                                  +{projectMaterials.length - 5} materiales más
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-6">
                              <Box size={24} className="mx-auto mb-2 text-slate-300" />
                              <p className="text-[9px] font-bold text-slate-400 uppercase italic mb-2">Sin materiales definidos en presupuesto</p>
                              <p className="text-[7px] text-slate-400">Agrega renglones con materiales para ver el inventario requerido</p>
                            </div>
                          )}
                          
                          <div className="flex gap-2 pt-2 border-t border-slate-100">
                            <button 
                              onClick={() => toast.info('Generar inventario', { description: 'Ve al módulo de Inventario y usa "Generar desde Presupuesto" para crear los materiales de este proyecto.' })}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all"
                            >
                              <Building2 size={10}/> Generar Stock
                            </button>
                            <button 
                              onClick={() => toast.info('Crear orden de compra', { description: 'Ve al módulo de Inventario para crear órdenes de compra para este proyecto.' })}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all"
                            >
                              <ShoppingCart size={10}/> Nueva OC
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <ListFilter size={14} className="text-secondary" /> Detalles del Presupuesto (Renglones)
                  </h4>
                  <div className="space-y-3">
                    {/* Add new item form */}
                    {addingItem ? (
                      <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-4 space-y-3">
                        <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Nuevo Renglon</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Código</label>
                            <input value={newItemForm.code} onChange={e => setNewItemForm(p => ({...p, code: e.target.value}))} placeholder="Ej: 01.01" className="w-full bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase focus:outline-none focus:border-emerald-400" />
                          </div>
                          <div>
                            <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Unidad</label>
                            <input value={newItemForm.unit} onChange={e => setNewItemForm(p => ({...p, unit: e.target.value}))} placeholder="M2, ML, U..." className="w-full bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase focus:outline-none focus:border-emerald-400" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Descripción</label>
                          <input value={newItemForm.description} onChange={e => setNewItemForm(p => ({...p, description: e.target.value}))} placeholder="Descripcion del renglon..." className="w-full bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase focus:outline-none focus:border-emerald-400" />
                        </div>
                        <div>
                          <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Cantidad en Proyecto</label>
                          <input type="number" min="0" step="0.01" value={newItemForm.projectQuantity} onChange={e => setNewItemForm(p => ({...p, projectQuantity: parseFloat(e.target.value)||0}))} className="w-full bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-[9px] font-black focus:outline-none focus:border-emerald-400" />
                        </div>

                        {/* Materials sub-section */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><Box size={10} className="text-secondary" /> Materiales</span>
                            <button onClick={() => setNewItemForm(p => ({...p, materials: [...p.materials, {name:'',unit:'U',quantity:1,price:0}]}))} className="text-[7px] font-black text-emerald-600 uppercase flex items-center gap-0.5"><PlusCircle size={10} /> Agregar</button>
                          </div>
                          {newItemForm.materials.map((m, idx) => (
                            <div key={idx} className="grid grid-cols-5 gap-1 items-center">
                              <input value={m.name} onChange={e => { const ms=[...newItemForm.materials]; ms[idx]={...ms[idx],name:e.target.value}; setNewItemForm(p=>({...p,materials:ms})); }} placeholder="Material" className="col-span-2 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-[8px] font-black uppercase focus:outline-none focus:border-emerald-300" />
                              <input value={m.unit} onChange={e => { const ms=[...newItemForm.materials]; ms[idx]={...ms[idx],unit:e.target.value}; setNewItemForm(p=>({...p,materials:ms})); }} placeholder="Und" className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-[8px] font-black uppercase focus:outline-none focus:border-emerald-300" />
                              <input type="number" min="0" step="0.01" value={m.quantity} onChange={e => { const ms=[...newItemForm.materials]; ms[idx]={...ms[idx],quantity:parseFloat(e.target.value)||0}; setNewItemForm(p=>({...p,materials:ms})); }} placeholder="Cant" className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-[8px] font-black focus:outline-none focus:border-emerald-300" />
                              <div className="flex gap-0.5">
                                <input type="number" min="0" step="0.01" value={m.price} onChange={e => { const ms=[...newItemForm.materials]; ms[idx]={...ms[idx],price:parseFloat(e.target.value)||0}; setNewItemForm(p=>({...p,materials:ms})); }} placeholder="Q/u" className="flex-1 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-[8px] font-black focus:outline-none focus:border-emerald-300" />
                                <button onClick={() => setNewItemForm(p=>({...p,materials:p.materials.filter((_,i)=>i!==idx)}))} className="text-red-400 hover:text-red-600"><Trash2 size={10} /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Labor sub-section */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><Hammer size={10} className="text-secondary" /> Mano de Obra</span>
                            <button onClick={() => setNewItemForm(p => ({...p, labor: [...p.labor, {role:'',unit:'dia',quantity:1,price:0}]}))} className="text-[7px] font-black text-emerald-600 uppercase flex items-center gap-0.5"><PlusCircle size={10} /> Agregar</button>
                          </div>
                          {newItemForm.labor.map((l, idx) => (
                            <div key={idx} className="grid grid-cols-5 gap-1 items-center">
                              <input value={l.role} onChange={e => { const ls=[...newItemForm.labor]; ls[idx]={...ls[idx],role:e.target.value}; setNewItemForm(p=>({...p,labor:ls})); }} placeholder="Rol" className="col-span-2 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-[8px] font-black uppercase focus:outline-none focus:border-emerald-300" />
                              <input value={l.unit} onChange={e => { const ls=[...newItemForm.labor]; ls[idx]={...ls[idx],unit:e.target.value}; setNewItemForm(p=>({...p,labor:ls})); }} placeholder="Und" className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-[8px] font-black uppercase focus:outline-none focus:border-emerald-300" />
                              <input type="number" min="0" step="0.01" value={l.quantity} onChange={e => { const ls=[...newItemForm.labor]; ls[idx]={...ls[idx],quantity:parseFloat(e.target.value)||0}; setNewItemForm(p=>({...p,labor:ls})); }} placeholder="Cant" className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-[8px] font-black focus:outline-none focus:border-emerald-300" />
                              <div className="flex gap-0.5">
                                <input type="number" min="0" step="0.01" value={l.price} onChange={e => { const ls=[...newItemForm.labor]; ls[idx]={...ls[idx],price:parseFloat(e.target.value)||0}; setNewItemForm(p=>({...p,labor:ls})); }} placeholder="Q/u" className="flex-1 bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-[8px] font-black focus:outline-none focus:border-emerald-300" />
                                <button onClick={() => setNewItemForm(p=>({...p,labor:p.labor.filter((_,i)=>i!==idx)}))} className="text-red-400 hover:text-red-600"><Trash2 size={10} /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Preview cost */}
                        {(newItemForm.materials.length > 0 || newItemForm.labor.length > 0) && (
                          <div className="bg-white border border-emerald-100 rounded-xl px-3 py-2 flex justify-between items-center">
                            <span className="text-[8px] font-black text-slate-400 uppercase">Costo estimado renglon</span>
                            <span className="text-[10px] font-black text-emerald-700">
                              Q {(
                                newItemForm.materials.reduce((a,m)=>a+m.price*m.quantity*newItemForm.projectQuantity,0) +
                                newItemForm.labor.reduce((a,l)=>a+l.price*l.quantity*newItemForm.projectQuantity,0)
                              ).toLocaleString(undefined,{maximumFractionDigits:2})}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <button onClick={() => { setAddingItem(false); setNewItemForm({code:'',description:'',unit:'M2',projectQuantity:1,materials:[],labor:[]}); }} className="flex-1 py-2 bg-white border border-slate-200 rounded-xl text-[8px] font-black uppercase text-slate-500">Cancelar</button>
                          <button onClick={addItem} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-[8px] font-black uppercase">Guardar Renglon</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingItem(true)} className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-emerald-300 rounded-2xl text-[9px] font-black text-emerald-600 uppercase hover:bg-emerald-50 transition-all">
                        <PlusCircle size={14} /> Agregar Renglon
                      </button>
                    )}
                    {selectedProject.items && selectedProject.items.length > 0 ? (
                      selectedProject.items.map((item) => (
                        <div key={item.id} className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                          {/* Item header */}
                          <div className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                            <button onClick={() => toggleItemExpansion(item.id)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500 shrink-0">{item.code}</div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black text-primary uppercase line-clamp-1">{item.description}</p>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">{item.projectQuantity} {item.unit}</span>
                              </div>
                              {expandedItems.includes(item.id) ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                            </button>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <button onClick={() => { setEditingItem(item.id); setItemEditForm({ code: item.code, description: item.description, projectQuantity: item.projectQuantity, unit: item.unit }); }} className="btn-edit"><Pencil size={12} /></button>
                              <button onClick={() => deleteItem(item.id)} className="btn-delete"><Trash2 size={12} /></button>
                            </div>
                          </div>

                          {/* Inline edit form for item header */}
                          {editingItem === item.id && (
                            <div className="px-4 pb-3 bg-blue-50 border-t border-blue-100 space-y-2">
                              <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest pt-2">Editar Renglon</p>
                              <div className="grid grid-cols-2 gap-2">
                                <input value={itemEditForm.code || ''} onChange={e => setItemEditForm({...itemEditForm, code: e.target.value})} placeholder="Codigo" className="bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase focus:outline-none focus:border-blue-400" />
                                <input type="number" value={itemEditForm.projectQuantity || 0} onChange={e => setItemEditForm({...itemEditForm, projectQuantity: parseFloat(e.target.value)||0})} placeholder="Cantidad" className="bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[9px] font-black focus:outline-none focus:border-blue-400" />
                              </div>
                              <input value={itemEditForm.description || ''} onChange={e => setItemEditForm({...itemEditForm, description: e.target.value})} placeholder="Descripcion" className="w-full bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase focus:outline-none focus:border-blue-400" />
                              <div className="flex gap-2">
                                <button onClick={() => setEditingItem(null)} className="flex-1 py-1.5 bg-white border border-slate-200 rounded-lg text-[8px] font-black uppercase text-slate-500">Cancelar</button>
                                <button onClick={saveItemEdit} className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-[8px] font-black uppercase">Guardar</button>
                              </div>
                            </div>
                          )}

                          <AnimatePresence>
                            {expandedItems.includes(item.id) && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-50 bg-slate-50/50">
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">

                                  {/* Materials */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                      <div className="flex items-center gap-2"><Box size={12} className="text-secondary" /><span className="text-[9px] font-black uppercase tracking-widest">Materiales</span></div>
                                      <button onClick={() => addMaterial(item.id)} className="flex items-center gap-1 text-[7px] font-black text-emerald-600 hover:text-emerald-700 uppercase"><PlusCircle size={11} /> Agregar</button>
                                    </div>
                                    <div className="space-y-1.5">
                                      {(item.materials || []).map((m: any, idx: number) => (
                                        <EditableSubRow key={idx}
                                          fields={[
                                            { key: 'name', label: 'Material', value: m.name, type: 'text' },
                                            { key: 'unit', label: 'Unidad', value: m.unit, type: 'text', small: true },
                                            { key: 'quantity', label: 'Cant.', value: m.quantity, type: 'number', small: true },
                                            { key: 'price', label: 'P.Unit Q', value: m.price, type: 'number', small: true },
                                          ]}
                                          totalQty={m.quantity * (item.projectQuantity || 1)}
                                          totalPrice={m.price * m.quantity * (item.projectQuantity || 1)}
                                          onSave={(data) => saveMaterialEdit(item.id, idx, data)}
                                          onDelete={() => deleteMaterial(item.id, idx)}
                                        />
                                      ))}
                                      {(!item.materials || item.materials.length === 0) && <p className="text-[8px] font-bold text-slate-400 uppercase italic pl-2 opacity-50">Sin materiales</p>}
                                    </div>
                                  </div>

                                  {/* Labor */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                      <div className="flex items-center gap-2"><Hammer size={12} className="text-secondary" /><span className="text-[9px] font-black uppercase tracking-widest">Mano de Obra</span></div>
                                      <button onClick={() => addLabor(item.id)} className="flex items-center gap-1 text-[7px] font-black text-emerald-600 hover:text-emerald-700 uppercase"><PlusCircle size={11} /> Agregar</button>
                                    </div>
                                    <div className="space-y-1.5">
                                      {(item.labor || []).map((l: any, idx: number) => (
                                        <EditableSubRow key={idx}
                                          fields={[
                                            { key: 'role', label: 'Rol', value: l.role, type: 'text' },
                                            { key: 'unit', label: 'Unidad', value: l.unit, type: 'text', small: true },
                                            { key: 'quantity', label: 'Cant.', value: l.quantity, type: 'number', small: true },
                                            { key: 'price', label: 'P.Unit Q', value: l.price, type: 'number', small: true },
                                          ]}
                                          totalQty={l.quantity * (item.projectQuantity || 1)}
                                          totalPrice={l.price * l.quantity * (item.projectQuantity || 1)}
                                          onSave={(data) => saveLaborEdit(item.id, idx, data)}
                                          onDelete={() => deleteLabor(item.id, idx)}
                                        />
                                      ))}
                                      {(!item.labor || item.labor.length === 0) && <p className="text-[8px] font-bold text-slate-400 uppercase italic pl-2 opacity-50">Sin mano de obra</p>}
                                    </div>
                                  </div>

                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-3xl opacity-50">
                        <p className="text-[9px] font-bold text-slate-400 uppercase italic tracking-widest">Sin renglones definidos</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                  <TrendingUp size={14} className="text-secondary" /> Estado y Avance
                </h4>
                <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-900/40 overflow-hidden">
                   <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Presupuesto Ejecutable</p>
                    <p className="text-lg sm:text-xl font-black text-secondary tracking-tighter mb-4 italic overflow-hidden text-ellipsis whitespace-nowrap w-full block">Q {(selectedProject.budget || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                   
                   <div className="space-y-8">
                     <div>
                       <div className="flex justify-between text-[8px] font-black uppercase tracking-widest mb-2 text-slate-400">
                         <span>Avance Físico Actual</span>
                         <span className="text-secondary">{selectedProject.progress || 0}%</span>
                       </div>
                       <div className="h-2 bg-slate-800 rounded-full overflow-hidden w-full mb-6 relative">
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${selectedProject.progress || 0}%` }}
                           className="h-full bg-secondary rounded-full relative z-10" 
                         />
                         <div className="absolute inset-0 bg-secondary/10 animate-pulse" style={{ width: `${selectedProject.progress || 0}%` }} />
                       </div>
                       
                       <div className="space-y-3">
                         <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Ajustar Nivel de Avance</label>
                         <input 
                           type="range"
                           min="0"
                           max="100"
                           step="1"
                           value={selectedProject.progress || 0}
                           disabled={updatingProgress}
                           onChange={(e) => handleUpdateProgress(selectedProject.id, parseInt(e.target.value))}
                           className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-secondary"
                         />
                         <div className="flex justify-between text-[7px] font-bold text-slate-600 uppercase">
                           <span>Inicio</span>
                           <span>Completado</span>
                         </div>
                       </div>
                     </div>

                     <div className="pt-6 border-t border-slate-800 space-y-4">
                       <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-slate-500 uppercase">Prioridad</span>
                         <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[7px] font-black">ALTA</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-slate-500 uppercase">Tipo Cobro</span>
                         <span className="text-[9px] font-black uppercase tracking-widest">Suma Alzada</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-slate-500 uppercase">Duración Real</span>
                         <span className="text-[9px] font-black text-secondary uppercase tracking-widest text-right max-w-[55%] truncate">
                           {(() => {
                             const days = (selectedProject.items || []).reduce((acc, item) => {
                               const { duration } = calcRealDuration(item);
                               return acc + duration;
                             }, 0);
                             if (days < 7) return `${days} días`;
                             if (days < 60) return `${Math.ceil(days/7)} semanas`;
                             return `${Math.ceil(days/30)} meses`;
                           })()}
                         </span>
                       </div>
                     </div>
                   </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setSelectedProject(null)}
              className="w-full bg-slate-100 text-primary py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all font-bold"
            >
              Cerrar Vista Detallada
            </button>
          </motion.div>
        )}
      </Modal>

      {bulkMode && selectedProjectIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4">
          <span className="text-[9px] font-black uppercase tracking-widest">{selectedProjectIds.size} seleccionado(s)</span>
          <button type="button" onClick={handleBulkDeleteProjects}
            className="px-4 py-1.5 bg-white text-red-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-red-50 transition-all">
            Eliminar
          </button>
          <button type="button" onClick={() => setSelectedProjectIds(new Set())}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-all">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}



