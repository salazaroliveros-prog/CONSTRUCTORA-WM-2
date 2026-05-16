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
import { Modal } from './ui/Modal';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { cn } from '../utils/cn';
import { deleteDocument, updateDocument, parseError, generateProjectStock} from '../services/firestoreService';
import { useStore } from '../store/DataStore';
import { uploadFile } from '../services/storageService';
import { usePagination } from '../hooks/usePagination';
import { useAutoPageSize } from '../hooks/useAutoPageSize';
import { toast } from 'sonner';
import { generatePDF, generateCSV, exportToExcel, generateProjectPDF, generateProjectCSV, calcProjectDuration, PDF_TEMPLATES, CSV_TEMPLATES, ExportStyle } from '../lib/exportUtils';
import Pagination from './ui/Pagination';
import { Users, MapPin, CalendarDays, DollarSign, TrendingDown } from 'lucide-react';
import { BudgetLine } from '../lib/budgetData';
import { itemsToBudgetTree } from '../utils/budgetConverter';
import { PMath, precise, fmtQ } from '../engine/precision';
import { calculateFullProject } from '../engine/budgetEngine';

import { sanitizeString } from '../utils/sanitize';
import { trackCRUD, trackEvent } from '../utils/logger';
import { CustomTooltip, EditableSubRow } from './Projects/ProjectItemEditor';
import { ProjectCard } from './Projects/ProjectCard';

export default function ProjectsModule() {
  const [view, setView] = useState<'list' | 'create'>('list');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'kanban'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const store = useStore();
  const projects = store.projects.items as Project[];
  const loading = store.projects.isLoading;
  const allStaff = store.staff.items as StaffMember[];
  const allClients = store.clients.items as Client[];
  const transactions = store.transactions.items as Transaction[];
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typologyFilter, setTypologyFilter] = useState('ALL');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [updatingProgress, setUpdatingProgress] = useState(false);
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

// Recalculates directCosts and budget from items array using the unified Engine
   const calcBudget = (items: any[], project: Project) => {
     const budgetTree = itemsToBudgetTree(items);
     const result = calculateFullProject(budgetTree, {
       indirectCosts: project.indirectCosts,
       adminCosts: project.administrativeCosts,
       personalCosts: project.personalCosts,
     });
     return { directCosts: result.directCost, budget: result.totalBudget };
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
            className="flex items-center gap-3 text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-900)] transition-all text-[10px] font-black uppercase tracking-[0.2em] group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
            Listado General de Obras
          </button>
          <div className="text-right">
            <h1 className="text-xl font-black text-[var(--color-primary)] uppercase tracking-tight italic">Asistente de Configuración</h1>
            <p className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest leading-none mt-1">Configuración técnica de proyecto</p>
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
    <div id="projects-dashboard" className="space-y-6 animate-in fade-in duration-500 pb-[calc(4rem+env(safe-area-inset-bottom,0))] scroll-mb-[calc(4rem+env(safe-area-inset-bottom,0))]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-[var(--color-primary)] uppercase">Proyectos</h2>
          <p className="text-[10px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mt-1">Control de portafolio y presupuestos</p>
        </div>
          <div className="flex w-full md:w-auto gap-2">
            <button 
              onClick={handleExportCSV}
              className="flex-1 md:flex-none border border-[var(--color-neutral-200)] bg-[var(--color-surface-solid)] text-[var(--color-neutral-600)] px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[var(--color-neutral-50)] transition-all shadow-sm"
            >
              <Download size={18} /> Exportar
            </button>
            <button
              onClick={() => setView('create')}
              className="btn-primary-enhanced btn-liquid flex-2 md:flex-none px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg"
            >
              <Plus size={18} /> Nueva Cotización
            </button>
          </div>
      </div>

      {/* ── KPIs financieros ── */}
      {(() => {
const totalBudget   = PMath.sum(projects.map(p => p.budget || 0));
         const inExec        = projects.filter(p => p.status === 'EJECUCION');
         const inExecIds     = inExec.map(p => p.id);
         const execBudget    = PMath.sum(inExec.map(p => p.budget || 0));
         const totalExecuted = (() => {
           const fromTx = transactions
             .filter(t => t.type === 'GASTO' && t.projectId && inExecIds.includes(t.projectId))
             .reduce((s, t) => PMath.add(s, t.amount || 0), 0);
           if (fromTx > 0) return fromTx;
           return inExec.reduce((s, p) => PMath.add(s, PMath.div(PMath.mul(p.budget || 0, p.progress || 0), 100)), 0);
         })();
         const deviation     = execBudget > 0 ? PMath.div(PMath.mul(PMath.sub(totalExecuted, execBudget), 100), execBudget) : 0;
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
                 { icon: <Building2 size={12} className="text-[var(--color-info)]" />,    label: 'Total Proyectos',   value: projects.length,          sub: `${stats.ejecucion} en ejecución`, color: 'text-[var(--color-info)]' },
{ icon: <DollarSign size={12} className="text-[var(--color-accent)]" />,  label: 'Presupuesto Total', value: `Q ${fmtQ(totalBudget/1000)}k`, sub: `Q ${fmtQ(execBudget/1000)}k activo`, color: 'text-[var(--color-warning)]' },
                  { icon: <TrendingUp size={12} className="text-[var(--color-success)]" />,  label: 'Ejecutado',         value: `Q ${fmtQ(totalExecuted/1000)}k`, sub: deviation !== 0 ? `${deviation > 0 ? '+' : ''}${precise(deviation, 1)}% desv.` : 'Sin desviación', color: deviation > 5 ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]' },
                 { icon: <AlertCircle size={12} className={delayed.length > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]'} />, label: 'Con Retraso', value: delayed.length, sub: delayed.length > 0 ? delayed[0].name : 'Al día', color: delayed.length > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]' },
              ].map(k => (
                <div key={k.label} className="bg-[var(--color-surface-solid)]  border border-[var(--color-neutral-200)]  rounded-lg p-2 sm:p-3 shadow-sm ">
                  <div className="flex items-center gap-1 mb-1">{k.icon}<span className="text-[6px] sm:text-[7px] font-black text-[var(--color-neutral-400)]  uppercase">{k.label}</span></div>
                  <p className={cn('text-base sm:text-lg font-black', k.color)}>{k.value}</p>
                  <p className="text-[6px] sm:text-[7px] font-bold text-[var(--color-neutral-400)]  uppercase mt-0.5 truncate">{k.sub}</p>
                </div>
              ))}
           </div>
         );
      })()}

      <div className="bg-[var(--color-surface-solid)]  rounded-2xl border border-[var(--color-neutral-200)]  shadow-sm  overflow-hidden">
<div className="p-3 md:p-4 border-b border-[var(--color-neutral-100)]  flex flex-col md:flex-row justify-between items-center gap-3">
             <div className="relative flex-1 w-full max-w-md">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral-400)] " size={16} />
               <input
                type="text"
                placeholder="BUSCAR PROYECTO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
               />
             </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
               <div className="flex bg-[var(--color-neutral-100)]  p-0.5 rounded-lg">
                 <button
                  onClick={() => setViewMode('table')}
                  title="Vista de Tabla"
                  className={cn("p-1.5 rounded-md transition-all", viewMode === 'table' ? "bg-[var(--color-surface-solid)]  text-[var(--color-neutral-900)]  shadow-sm " : "text-[var(--color-neutral-400)]  hover:text-[var(--color-neutral-600)] ")}
                 >
                   <ListFilter size={15} />
                 </button>
                 <button
                  onClick={() => setViewMode('grid')}
                  title="Vista de Cuadrícula"
                  className={cn("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-[var(--color-surface-solid)] text-[var(--color-neutral-900)] shadow-sm" : "text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-600)]")}
                 >
                   <LayoutGrid size={15} />
                 </button>
              </div>

                <button
                  onClick={() => setViewMode('kanban')}
                  title="Vista Kanban"
                  className={cn("p-1.5 rounded-md transition-all", viewMode === 'kanban' ? "bg-[var(--color-surface-solid)]  text-[var(--color-neutral-900)]  shadow-sm " : "text-[var(--color-neutral-400)]  hover:text-[var(--color-neutral-600)] ")}
                >
                  <Layers size={15} />
                </button>
                <button type="button" title="Selección múltiple" onClick={() => { setBulkMode(!bulkMode); if (bulkMode) setSelectedProjectIds(new Set()); }}
                  className={`px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest transition-all ${bulkMode ? 'bg-[var(--color-error)] text-[var(--color-neutral-50)] shadow-sm ' : 'bg-[var(--color-neutral-100)]  text-[var(--color-neutral-500)]  hover:text-slate-800 '}`}>
                 {bulkMode ? 'Cancelar' : 'Seleccionar'}
               </button>
                <div className="flex flex-col gap-0.5 min-w-30">
                 <span className="text-[6px] font-black text-[var(--color-neutral-400)] uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                   <Clock size={7} /> Estado
                 </span>
                 <select
                   title="Filtrar por estado"
                   value={statusFilter}
                   onChange={(e) => setStatusFilter(e.target.value)}
                className="select"
                 >
                   <option value="ALL">TODOS</option>
                   <option value="COTIZACION">COTIZACIÓN</option>
                   <option value="EJECUCION">EJECUCIÓN</option>
                   <option value="FINALIZADO">FINALIZADO</option>
                </select>
              </div>

              <div className="flex flex-col gap-0.5 min-w-30">
                 <span className="text-[6px] font-black text-[var(--color-neutral-400)] uppercase tracking-[0.2em] ml-1 flex items-center gap-1">
                   <Building2 size={7} /> Tipología
                 </span>
                 <select
                   title="Filtrar por tipología"
                   value={typologyFilter}
                   onChange={(e) => setTypologyFilter(e.target.value)}
                 className="select"
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
              <table className="w-full text-left min-w-120 sm:min-w-150">
               <thead>
                 <tr className="bg-[var(--color-neutral-50)]/50 border-b border-[var(--color-neutral-100)]">
                   {bulkMode && (
                     <th className="px-2 py-2 w-6">
                        <input type="checkbox" checked={paginatedProjects.length > 0 && selectedProjectIds.size === paginatedProjects.length}
                          onChange={toggleSelectAllProjects} title="Seleccionar todo" className="w-3.5 h-3.5 accent-[var(--color-error)] cursor-pointer" />
                     </th>
                   )}
                   <th className="px-4 py-2 text-[7px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Proyecto</th>
                    <th className="hidden sm:table-cell px-2 sm:px-4 py-2 text-[6px] sm:text-[7px] font-black text-[var(--color-neutral-400)]  uppercase tracking-widest">Cliente</th>
                   <th className="px-4 py-2 text-[7px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest">Estado</th>
                   <th className="px-4 py-2 text-[7px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest text-right">#</th>
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
                      className={`group hover:bg-[var(--color-neutral-50)]/50 /50 transition-colors cursor-pointer ${selectedProjectIds.has(project.id) ? "bg-red-50  border-l-2 border-[var(--color-error)]" : ""}`}
                    >
                     {bulkMode && (
                       <td className="px-2 py-2 w-6" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedProjectIds.has(project.id)} onChange={() => toggleSelectProject(project.id)} title="Seleccionar proyecto"
                            className="w-3.5 h-3.5 accent-[var(--color-error)] cursor-pointer" />
                       </td>
                     )}
                     <td className="px-4 py-2">
                       <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[var(--color-neutral-100)]  flex items-center justify-center text-[var(--color-primary)] border border-[var(--color-neutral-200)]  shrink-0 group-hover:bg-[var(--color-neutral-900)] :bg-[var(--color-neutral-700)] group-hover:text-[var(--color-secondary)] transition-all">
                           <Building2 size={14} />
                         </div>
                         <div className="min-w-0">
                             <p className="text-[7px] sm:text-[8px] font-black text-[var(--color-primary)] uppercase tracking-tight truncate max-w-20 sm:max-w-30 md:max-w-none group-hover:text-[var(--color-secondary)] transition-colors">{project.name}</p>
                            <p className="text-[6px] text-[var(--color-neutral-400)]  font-bold uppercase tracking-widest truncate">Cód: {project.id.slice(-6).toUpperCase()}</p>
                         </div>
                       </div>
                     </td>
                      <td className="hidden sm:table-cell px-2 sm:px-4 py-2">
                       <div className="flex flex-col">
                           <span className="text-[7px] font-black text-[var(--color-neutral-900)]  uppercase truncate max-w-30">{project.clientName}</span>
                          <span className="text-[6px] font-bold text-[var(--color-neutral-400)]  uppercase tracking-widest">{project.typology}</span>
                       </div>
                     </td>
                     <td className="px-4 py-2">
                          <div className="flex flex-col gap-1 min-w-17.5">
                         <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest">
                           <span className={cn(
                             project.status === 'EJECUCION' ? "text-[var(--color-secondary)]" :
                             project.status === 'COTIZACION' ? "text-[var(--color-info)]" :
                             "text-[var(--color-success)]"
                           )}>{project.status}</span>
                           <span className="text-[var(--color-neutral-400)]">{project.progress || 0}%</span>
                         </div>
                          <div className="h-1.5 bg-[var(--color-neutral-100)]  rounded-full overflow-hidden w-full">
                           <motion.div
                             initial={{ width: 0 }}
                             animate={{ width: `${project.progress || 0}%` }}
                             className={cn(
                               "h-full rounded-full",
                               project.status === 'EJECUCION' ? "bg-[var(--color-neutral-900)]" : "bg-slate-400"
                             )}
                           />
                         </div>
                       </div>
                     </td>
                     <td className="px-4 py-2 text-right">
                       <div className="flex items-center justify-end gap-1">
                           <button
                             onClick={(e) => handleDelete(e, project.id)}
                             aria-label="Eliminar proyecto"
                             className="w-7 h-7 flex items-center justify-center rounded-md text-slate-300  hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] :bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                           >
                             <Trash2 size={12} />
                           </button>
                           <button aria-label="Ver detalles" className="w-7 h-7 flex items-center justify-center rounded-md text-slate-300  group-hover:text-[var(--color-secondary)] group-hover:bg-[var(--color-neutral-900)] :bg-[var(--color-neutral-700)] transition-all">
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
                <ProjectCard
                  project={project}
                  bulkMode={bulkMode}
                  selectedProjectIds={selectedProjectIds}
                  onSelect={toggleSelectProject}
                  onClick={(p) => setSelectedProject(p)}
                  onDelete={handleDelete}
                />
              </motion.div>
            ))}
        {viewMode === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
            {[
              { id: 'COTIZACION', label: 'Cotizacion', color: 'bg-[var(--color-neutral-100)]  border-[var(--color-neutral-200)] ', dot: 'bg-slate-400 ' },
{ id: 'EJECUCION', label: 'Ejecucion', color: 'bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)]  border-[color-mix(in_srgb,var(--color-info)_20%,transparent)] ', dot: 'bg-[var(--color-info)]' },
               { id: 'FINALIZADO', label: 'Finalizado', color: 'bg-[var(--color-success-bg)]  border-[var(--color-green-border)] ', dot: 'bg-[var(--color-success)]' },
            ].map(col => (
              <div key={col.id} className={`rounded-2xl border p-4 space-y-3 ${col.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-neutral-600)] ">{col.label}</span>
                   <span className="ml-auto text-[8px] font-black bg-[var(--color-surface-solid)]  rounded-full px-2 py-0.5 text-[var(--color-neutral-700)] ">{filteredProjects.filter(p => p.status === col.id).length}</span>
                </div>
                {filteredProjects.filter(p => p.status === col.id).map((p, ki) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: ki * 0.07 }}
                    onClick={() => setSelectedProject(p)}
                    className="bg-[var(--color-surface-solid)]  rounded-xl p-3 shadow-sm  border border-[var(--color-surface-solid)]  hover:border-secondary cursor-pointer transition-all space-y-2"
                  >
                    <p className="text-[10px] font-black text-[var(--color-primary)] uppercase leading-tight">{p.name}</p>
                     <p className="text-[8px] text-[var(--color-neutral-600)]  font-bold uppercase">{p.clientName}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black text-[var(--color-secondary)]">Q {(p.budget || 0).toLocaleString()}</span>
                      <div className="w-16 h-1.5 bg-[var(--color-neutral-100)]  rounded-full overflow-hidden" style={{ '--pw': `${p.progress || 0}%` } as React.CSSProperties}>
                        <div className="h-full bg-[var(--color-neutral-900)]  rounded-full w-[var(--pw)]" />
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
            <div className="border-b border-[var(--color-neutral-100)]  pb-6 space-y-3">
              {/* Fila 1: icono + titulo + boton editar */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[var(--color-neutral-900)]  rounded-2xl flex items-center justify-center text-[var(--color-secondary)] shrink-0 shadow-lg shadow-[rgba(15,23,42,0.2)] ">
                  <Building2 size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-black text-[var(--color-primary)] uppercase tracking-tight leading-none mb-1 truncate">{selectedProject.name}</h2>
                  <p className="text-[8px] sm:text-[9px] font-black text-[var(--color-secondary)] tracking-[0.2em] uppercase truncate">ID: {selectedProject.id?.toUpperCase()}</p>
                </div>
                {isEditing ? (
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setEditForm({}); }}>Cancelar</Button>
                    <Button variant="default" size="sm" onClick={handleSaveEdit}>Guardar</Button>
                  </div>
                ) : (
                  <button onClick={() => { setIsEditing(true); setEditForm({ name: selectedProject.name, clientName: selectedProject.clientName, status: selectedProject.status, startDate: selectedProject.startDate, endDate: selectedProject.endDate, location: selectedProject.location }); }} className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-[var(--color-neutral-900)]  text-[var(--color-neutral-50)] rounded-lg text-xs font-bold uppercase">
                    <Settings2 size={14} /> Editar
                  </button>
                )}
              </div>
              {/* Fila 2: controles de exportacion */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[7px] font-black text-[var(--color-neutral-400)]  uppercase tracking-widest">Plantilla PDF</span>
                    <select title="Plantilla PDF" value={exportPdfTemplate} onChange={e => setExportPdfTemplate(e.target.value)} className="select">
                    {PDF_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <button onClick={() => { setTimeout(async () => { await generateProjectPDF(selectedProject, exportPdfTemplate); }, 50); }} className="h-8 flex items-center gap-1 px-2 sm:px-3 bg-[var(--color-secondary)] text-[var(--color-primary)] rounded-lg text-[7px] sm:text-[8px] font-black uppercase hover:bg-[var(--color-secondary)]/90 transition-all">
                  <Download size={12} /> PDF
                </button>
                <button onClick={() => generateProjectCSV(selectedProject, exportCsvTemplate)} className="h-8 flex items-center gap-1.5 px-3 bg-[var(--color-neutral-900)]  text-[var(--color-neutral-50)] rounded-lg text-[8px] font-black uppercase hover:bg-[var(--color-neutral-700)]  transition-all">
                  <Download size={12} /> CSV
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {isEditing && (
                <div className="col-span-2 md:col-span-4 bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-warning)_20%,transparent)] rounded-2xl p-5 space-y-4">
                  <p className="text-[9px] font-black text-[var(--color-warning)] uppercase tracking-widest">Modo Edicion</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="label">Nombre</label><input value={editForm.name||""} onChange={e=>setEditForm(p=>({...p,name:e.target.value}))} placeholder="Nombre del proyecto" className="input" /></div>
                    <div><label className="label">Cliente</label>
                      <select title="Seleccionar cliente" value={editForm.clientName||""} onChange={e=>setEditForm(p=>({...p,clientName:e.target.value}))} className="select">
                        <option value="">— Seleccionar —</option>
                        {allClients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        {editForm.clientName && !allClients.find(c => c.name === editForm.clientName) && <option value={editForm.clientName}>{editForm.clientName}</option>}
                      </select>
                    </div>
                    <div><label className="label">Estado</label><select title="Seleccionar estado" value={editForm.status||""} onChange={e=>setEditForm(p=>({...p,status:e.target.value as any}))} className="select"><option value="COTIZACION">Cotizacion</option><option value="EJECUCION">Ejecucion</option><option value="FINALIZADO">Finalizado</option></select></div>
                    <div><label className="label">Ubicacion</label><input value={editForm.location||""} onChange={e=>setEditForm(p=>({...p,location:e.target.value}))} placeholder="Ubicación del proyecto" className="input" /></div>
                    <div><label className="label">Fecha Inicio</label><input type="date" title="Fecha de inicio" value={editForm.startDate||""} onChange={e=>setEditForm(p=>({...p,startDate:e.target.value}))} className="input" /></div>
                    <div><label className="label">Fecha Fin</label><input type="date" title="Fecha de fin" value={editForm.endDate||""} onChange={e=>setEditForm(p=>({...p,endDate:e.target.value}))} className="input" /></div>
                  </div>
                </div>
              )}
              <div className="p-4 bg-[var(--color-neutral-50)] rounded-2xl">
                <p className="text-[8px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest mb-1">Cliente</p>
                <p className="text-xs font-black text-[var(--color-primary)] uppercase">{selectedProject.clientName}</p>
              </div>
              <div className="p-4 bg-[var(--color-neutral-50)] rounded-2xl">
                <p className="text-[8px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest mb-1">Ubicación</p>
                <input 
                  value={selectedProject.location || ''}
                  onBlur={(e) => handleUpdateProject({ location: e.target.value })}
                  onChange={(e) => setSelectedProject({ ...selectedProject, location: e.target.value })}
                  placeholder="Ubicación"
                  className="input"
                />
              </div>
              <div className="p-4 bg-[var(--color-neutral-50)] rounded-2xl">
                <p className="text-[8px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest mb-1">Fecha Inicio</p>
                <p className="text-xs font-black text-[var(--color-primary)] uppercase flex items-center gap-1">
                  <Calendar size={10} className="text-[var(--color-secondary)]" />
                  {selectedProject.startDate || 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-[var(--color-neutral-50)] rounded-2xl">
                <p className="text-[8px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest mb-1">Adjuntos</p>
                <input 
                  type="file"
                  title="Subir archivo adjunto"
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
                  className="text-[8px] text-[var(--color-primary)]"
                />
                {selectedProject.attachments && selectedProject.attachments.length > 0 && <span className="text-[8px]">{selectedProject.attachments.length} adjuntos</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-[var(--color-neutral-900)] uppercase tracking-[0.2em] flex items-center gap-2">
                    <Settings2 size={14} className="text-[var(--color-secondary)]" /> Breakdown de Costos
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
                      <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-100)] rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[8px] font-black text-[var(--color-neutral-400)] uppercase">Curva S — Avance Físico vs Tiempo</span>
                          <div className="flex items-center gap-3 text-[7px] font-bold text-[var(--color-neutral-400)] uppercase">
                            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[var(--color-accent)] inline-block" /> Teórico</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[var(--color-info)] inline-block" /> Real</span>
                          </div>
                        </div>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sCurve}>
                              <XAxis dataKey="t" fontSize={8} />
                              <YAxis fontSize={8} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                              <Tooltip formatter={(v: any) => `${v}%`} />
                              <ReferenceLine x={`${Math.round(elapsed)}%`} stroke="var(--color-error)" strokeDasharray="3 3" label={{ value: 'Hoy', fontSize: 8, fill: 'var(--color-error)' }} />
                              <Line type="monotone" dataKey="theoretical" stroke="var(--color-secondary)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                              <Line type="monotone" dataKey="actual" stroke="var(--color-info)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[8px] font-bold">
                          <span className="text-[var(--color-neutral-400)]">Tiempo transcurrido: <span className="text-[var(--color-neutral-700)]">{Math.round(elapsed)}%</span></span>
                          <span className={cn('font-black', (selectedProject.progress || 0) < elapsed - 10 ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]')}>
                            {(selectedProject.progress || 0) < elapsed - 10 ? `⚠ Retraso ${Math.round(elapsed - (selectedProject.progress || 0))}%` : '✓ Al día'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="h-48 bg-[var(--color-surface-solid)] border border-[var(--color-neutral-100)] rounded-2xl p-4 shadow-sm">
                    <ResponsiveContainer width="100%" height="100%">
<BarChart data={[
                         { name: 'Materiales', value: selectedProject.items.reduce((acc, item) => PMath.add(acc, (item.materials || []).reduce((a, m) => PMath.add(a, PMath.mul(PMath.mul(m.price, m.quantity), item.projectQuantity || 1)), 0)), 0) },
                         { name: 'Mano de Obra', value: selectedProject.items.reduce((acc, item) => PMath.add(acc, (item.labor || []).reduce((a, l) => PMath.add(a, PMath.mul(PMath.mul(l.price, l.quantity), item.projectQuantity || 1)), 0)), 0) }
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
                    <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-100)] rounded-2xl p-4 shadow-sm group">
                      <p className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mb-1">Costo Directo</p>
                      <p className="text-sm font-black text-[var(--color-primary)] uppercase group-hover:text-[var(--color-secondary)]">Q {(selectedProject.directCosts || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-100)] rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mb-1">Indirecto ({selectedProject.indirectCosts || 0}%)</p>
                      <p className="text-sm font-black text-[var(--color-neutral-600)] uppercase">Q {fmtQ(PMath.mul(selectedProject.directCosts || 0, PMath.div(selectedProject.indirectCosts || 0, 100)))}</p>
                    </div>
                    <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-100)] rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mb-1">Admin ({selectedProject.administrativeCosts || 0}%)</p>
                      <p className="text-sm font-black text-[var(--color-neutral-600)] uppercase">Q {fmtQ(PMath.mul(selectedProject.directCosts || 0, PMath.div(selectedProject.administrativeCosts || 0, 100)))}</p>
                    </div>
                    <div className="bg-[var(--color-surface-solid)] border border-[var(--color-neutral-100)] rounded-2xl p-4 shadow-sm">
                      <p className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest mb-1">Personal ({selectedProject.personalCosts || 0}%)</p>
                      <p className="text-sm font-black text-[var(--color-neutral-600)] uppercase">Q {fmtQ(PMath.mul(selectedProject.directCosts || 0, PMath.div(selectedProject.personalCosts || 0, 100)))}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-[var(--color-neutral-900)] uppercase tracking-[0.2em] flex items-center gap-2">
                      <Users size={14} className="text-[var(--color-secondary)]" /> Equipo Asignado
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase">
                        {selectedProject.teamIds?.length || 0} miembro{(selectedProject.teamIds?.length || 0) !== 1 ? 's' : ''}
                      </span>
                      <button 
                        onClick={() => toast.info('Gestión de equipo', { description: 'Ve al módulo de Personal para asignar/desasignar miembros del equipo a este proyecto.' })}
                        className="text-[8px] font-black text-[var(--color-secondary)] hover:text-[var(--color-primary)] bg-[var(--color-secondary)]/10 hover:bg-[var(--color-secondary)]/20 px-2 py-1 rounded-lg transition-all uppercase tracking-widest"
                      >
                        Gestionar
                      </button>
                    </div>
                  </div>
                  <div className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-100)] rounded-2xl p-4">
                    {selectedProject.teamIds && selectedProject.teamIds.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {allStaff.filter(s => selectedProject.teamIds?.includes(s.id)).map(member => (
                          <div key={member.id} className="flex items-center gap-3 bg-[var(--color-surface-solid)] p-2 rounded-xl border border-[var(--color-neutral-100)] shadow-sm hover:shadow-md transition-all group">
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-neutral-900)] text-[var(--color-secondary)] flex items-center justify-center font-black text-[10px] group-hover:bg-[var(--color-secondary)] group-hover:text-[var(--color-primary)] transition-all">
                              {member.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black text-[var(--color-primary)] uppercase truncate group-hover:text-[var(--color-secondary)] transition-colors">{member.name}</p>
                              <p className="text-[7px] font-bold text-[var(--color-neutral-400)] uppercase tracking-widest">{member.role}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[8px] font-black text-[var(--color-neutral-600)]">Q {Number(member.salary || 0).toLocaleString('es-GT')}</p>
                              <p className="text-[6px] font-bold text-[var(--color-neutral-400)] uppercase">Salario</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Users size={24} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase italic mb-2">Sin personal asignado específicamente</p>
                        <button 
                          onClick={() => toast.info('Asignar personal', { description: 'Ve al módulo de Personal para asignar miembros del equipo a este proyecto.' })}
                          className="text-[8px] font-black text-[var(--color-secondary)] hover:text-[var(--color-primary)] bg-[var(--color-secondary)]/10 hover:bg-[var(--color-secondary)]/20 px-3 py-1.5 rounded-lg transition-all uppercase tracking-widest"
                        >
                          Asignar Personal
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-[var(--color-neutral-900)] uppercase tracking-[0.2em] flex items-center gap-2">
                      <Box size={14} className="text-[var(--color-secondary)]" /> Inventario del Proyecto
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase">
                        {(() => {
                          const projectInventory = transactions.filter(t => t.projectId === selectedProject.id);
                          return projectInventory.length;
                        })()} items
                      </span>
                      <button 
                        onClick={() => toast.info('Gestión de inventario', { description: 'Ve al módulo de Inventario y filtra por este proyecto para gestionar materiales.' })}
                        className="text-[8px] font-black text-[var(--color-secondary)] hover:text-[var(--color-primary)] bg-[var(--color-secondary)]/10 hover:bg-[var(--color-secondary)]/20 px-2 py-1 rounded-lg transition-all uppercase tracking-widest"
                      >
                        Ver Inventario
                      </button>
                    </div>
                  </div>
                  <div className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-100)] rounded-2xl p-4">
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
                            <div className="bg-[var(--color-surface-solid)] p-3 rounded-xl border border-[var(--color-neutral-100)] text-center">
                              <p className="text-[7px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest mb-1">Materiales</p>
                              <p className="text-lg font-black text-[var(--color-primary)]">{projectMaterials.length}</p>
                              <p className="text-[6px] font-bold text-[var(--color-neutral-400)] uppercase">tipos</p>
                            </div>
                            <div className="bg-[var(--color-surface-solid)] p-3 rounded-xl border border-[var(--color-neutral-100)] text-center">
                              <p className="text-[7px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest mb-1">Valor Total</p>
                              <p className="text-lg font-black text-[var(--color-primary)]">Q {Math.round(totalBudgetedValue/1000)}k</p>
                              <p className="text-[6px] font-bold text-[var(--color-neutral-400)] uppercase">presupuestado</p>
                            </div>
                            <div className="bg-[var(--color-surface-solid)] p-3 rounded-xl border border-[var(--color-neutral-100)] text-center">
                              <p className="text-[7px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest mb-1">Estado</p>
                              <p className="text-lg font-black text-[var(--color-warning)]">Pendiente</p>
                              <p className="text-[6px] font-bold text-[var(--color-neutral-400)] uppercase">compras</p>
                            </div>
                          </div>
                          
                          {topMaterials.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-[8px] font-black text-[var(--color-neutral-400)] uppercase tracking-widest border-b border-[var(--color-neutral-200)] pb-1">Principales Materiales</p>
                              {topMaterials.map((material, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-[var(--color-surface-solid)] p-2 rounded-lg border border-[var(--color-neutral-100)]">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[9px] font-black text-[var(--color-primary)] uppercase truncate">{material.name}</p>
                                    <p className="text-[7px] font-bold text-[var(--color-neutral-400)] uppercase">{material.budgetedQty.toLocaleString()} {material.unit}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[8px] font-black text-[var(--color-neutral-600)]">Q {material.budgetedValue.toLocaleString()}</p>
                                    <p className="text-[6px] font-bold text-[var(--color-neutral-400)] uppercase">presupuesto</p>
                                  </div>
                                </div>
                              ))}
                              {projectMaterials.length > 5 && (
                                <p className="text-[7px] font-bold text-[var(--color-neutral-400)] uppercase text-center pt-1">
                                  +{projectMaterials.length - 5} materiales más
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-6">
                              <Box size={24} className="mx-auto mb-2 text-slate-300" />
                              <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase italic mb-2">Sin materiales definidos en presupuesto</p>
                              <p className="text-[7px] text-[var(--color-neutral-400)]">Agrega renglones con materiales para ver el inventario requerido</p>
                            </div>
                          )}
                          
                          <div className="flex gap-2 pt-2 border-t border-[var(--color-neutral-100)]">
                            <button 
                              onClick={() => toast.info('Generar inventario', { description: 'Ve al módulo de Inventario y usa "Generar desde Presupuesto" para crear los materiales de este proyecto.' })}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-[var(--color-success)] text-[var(--color-neutral-50)] rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-[var(--color-success)] transition-all"
                            >
                              <Building2 size={10}/> Generar Stock
                            </button>
                            <button 
                              onClick={() => toast.info('Crear orden de compra', { description: 'Ve al módulo de Inventario para crear órdenes de compra para este proyecto.' })}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-[var(--color-info)] text-[var(--color-neutral-50)] rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-[var(--color-info)] transition-all"
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
                  <h4 className="text-[10px] font-black text-[var(--color-neutral-900)] uppercase tracking-[0.2em] flex items-center gap-2">
                    <ListFilter size={14} className="text-[var(--color-secondary)]" /> Detalles del Presupuesto (Renglones)
                  </h4>
                  <div className="space-y-3">
                    {/* Add new item form */}
                    {addingItem ? (
                      <div className="border border-[var(--color-green-border)] bg-[var(--color-success-bg)] rounded-2xl p-4 space-y-3">
                        <p className="text-[9px] font-black text-[var(--color-success)] uppercase tracking-widest">Nuevo Renglon</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="label">Código</label>
                            <input value={newItemForm.code} onChange={e => setNewItemForm(p => ({...p, code: e.target.value}))} placeholder="Ej: 01.01" className="input" />
                          </div>
                          <div>
                            <label className="label">Unidad</label>
                            <input value={newItemForm.unit} onChange={e => setNewItemForm(p => ({...p, unit: e.target.value}))} placeholder="M2, ML, U..." className="input" />
                          </div>
                        </div>
                        <div>
                          <label className="label">Descripción</label>
                          <input value={newItemForm.description} onChange={e => setNewItemForm(p => ({...p, description: e.target.value}))} placeholder="Descripcion del renglon..." className="input" />
                        </div>
                        <div>
                          <label className="label">Cantidad en Proyecto</label>
                          <input type="number" min="0" step="0.01" value={newItemForm.projectQuantity} onChange={e => setNewItemForm(p => ({...p, projectQuantity: parseFloat(e.target.value)||0}))} placeholder="0.00" className="input" />
                        </div>

                        {/* Materials sub-section */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black text-[var(--color-neutral-500)] uppercase tracking-widest flex items-center gap-1"><Box size={10} className="text-[var(--color-secondary)]" /> Materiales</span>
                            <button onClick={() => setNewItemForm(p => ({...p, materials: [...p.materials, {name:'',unit:'U',quantity:1,price:0}]}))} className="text-[7px] font-black text-[var(--color-success)] uppercase flex items-center gap-0.5"><PlusCircle size={10} /> Agregar</button>
                          </div>
                          {newItemForm.materials.map((m, idx) => (
                            <div key={idx} className="grid grid-cols-5 gap-1 items-center">
                              <input value={m.name} onChange={e => { const ms=[...newItemForm.materials]; ms[idx]={...ms[idx],name:e.target.value}; setNewItemForm(p=>({...p,materials:ms})); }} placeholder="Material" className="input col-span-2" />
                              <input value={m.unit} onChange={e => { const ms=[...newItemForm.materials]; ms[idx]={...ms[idx],unit:e.target.value}; setNewItemForm(p=>({...p,materials:ms})); }} placeholder="Und" className="input" />
                              <input type="number" min="0" step="0.01" value={m.quantity} onChange={e => { const ms=[...newItemForm.materials]; ms[idx]={...ms[idx],quantity:parseFloat(e.target.value)||0}; setNewItemForm(p=>({...p,materials:ms})); }} placeholder="Cant" className="input" />
                              <div className="flex gap-0.5">
                                <input type="number" min="0" step="0.01" value={m.price} onChange={e => { const ms=[...newItemForm.materials]; ms[idx]={...ms[idx],price:parseFloat(e.target.value)||0}; setNewItemForm(p=>({...p,materials:ms})); }} placeholder="Q/u" className="input flex-1" />
                                <button onClick={() => setNewItemForm(p=>({...p,materials:p.materials.filter((_,i)=>i!==idx)}))} aria-label="Eliminar material" className="text-[var(--color-error)] hover:text-[var(--color-error)]"><Trash2 size={10} /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Labor sub-section */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black text-[var(--color-neutral-500)] uppercase tracking-widest flex items-center gap-1"><Hammer size={10} className="text-[var(--color-secondary)]" /> Mano de Obra</span>
                            <button onClick={() => setNewItemForm(p => ({...p, labor: [...p.labor, {role:'',unit:'dia',quantity:1,price:0}]}))} className="text-[7px] font-black text-[var(--color-success)] uppercase flex items-center gap-0.5"><PlusCircle size={10} /> Agregar</button>
                          </div>
                          {newItemForm.labor.map((l, idx) => (
                            <div key={idx} className="grid grid-cols-5 gap-1 items-center">
                              <input value={l.role} onChange={e => { const ls=[...newItemForm.labor]; ls[idx]={...ls[idx],role:e.target.value}; setNewItemForm(p=>({...p,labor:ls})); }} placeholder="Rol" className="input col-span-2" />
                              <input value={l.unit} onChange={e => { const ls=[...newItemForm.labor]; ls[idx]={...ls[idx],unit:e.target.value}; setNewItemForm(p=>({...p,labor:ls})); }} placeholder="Und" className="input" />
                              <input type="number" min="0" step="0.01" value={l.quantity} onChange={e => { const ls=[...newItemForm.labor]; ls[idx]={...ls[idx],quantity:parseFloat(e.target.value)||0}; setNewItemForm(p=>({...p,labor:ls})); }} placeholder="Cant" className="input" />
                              <div className="flex gap-0.5">
                                <input type="number" min="0" step="0.01" value={l.price} onChange={e => { const ls=[...newItemForm.labor]; ls[idx]={...ls[idx],price:parseFloat(e.target.value)||0}; setNewItemForm(p=>({...p,labor:ls})); }} placeholder="Q/u" className="input flex-1" />
                                <button onClick={() => setNewItemForm(p=>({...p,labor:p.labor.filter((_,i)=>i!==idx)}))} aria-label="Eliminar mano de obra" className="text-[var(--color-error)] hover:text-[var(--color-error)]"><Trash2 size={10} /></button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Preview cost */}
                        {(newItemForm.materials.length > 0 || newItemForm.labor.length > 0) && (
                          <div className="bg-[var(--color-surface-solid)] border border-[var(--color-green-border)] rounded-xl px-3 py-2 flex justify-between items-center">
                            <span className="text-[8px] font-black text-[var(--color-neutral-400)] uppercase">Costo estimado renglon</span>
                            <span className="text-[10px] font-black text-[var(--color-success)]">
Q {PMath.fmtQ(
                                 PMath.add(
                                   newItemForm.materials.reduce((a,m) => PMath.add(a, PMath.mul(PMath.mul(m.price, m.quantity), newItemForm.projectQuantity)), 0),
                                   newItemForm.labor.reduce((a,l) => PMath.add(a, PMath.mul(PMath.mul(l.price, l.quantity), newItemForm.projectQuantity)), 0)
                                 )
                               )}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <Button variant="outline" onClick={() => { setAddingItem(false); setNewItemForm({code:'',description:'',unit:'M2',projectQuantity:1,materials:[],labor:[]}); }} className="flex-1">Cancelar</Button>
                          <Button variant="default" onClick={addItem} className="flex-1">Guardar Renglon</Button>
                        </div>
                      </div>
                    ) : (
                      <Button onClick={() => setAddingItem(true)} className="w-full" variant="outline">
                        <PlusCircle size={14} /> Agregar Renglon
                      </Button>
                    )}
                    {selectedProject.items && selectedProject.items.length > 0 ? (
                      selectedProject.items.map((item) => (
                        <div key={item.id} className="border border-[var(--color-neutral-100)] rounded-2xl overflow-hidden bg-[var(--color-surface-solid)] shadow-sm">
                          {/* Item header */}
                          <div className="flex items-center justify-between p-3 hover:bg-[var(--color-neutral-50)] transition-colors">
                            <button onClick={() => toggleItemExpansion(item.id)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                              <div className="w-7 h-7 rounded-lg bg-[var(--color-neutral-100)] flex items-center justify-center text-[8px] font-black text-[var(--color-neutral-500)] shrink-0">{item.code}</div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black text-[var(--color-primary)] uppercase line-clamp-1">{item.description}</p>
                                <span className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase">{item.projectQuantity} {item.unit}</span>
                              </div>
                              {expandedItems.includes(item.id) ? <ChevronUp size={14} className="text-[var(--color-neutral-400)] shrink-0" /> : <ChevronDown size={14} className="text-[var(--color-neutral-400)] shrink-0" />}
                            </button>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <button aria-label="Editar renglón" onClick={() => { setEditingItem(item.id); setItemEditForm({ code: item.code, description: item.description, projectQuantity: item.projectQuantity, unit: item.unit }); }} className="btn-edit"><Pencil size={12} /></button>
                              <button aria-label="Eliminar renglón" onClick={() => deleteItem(item.id)} className="btn-delete"><Trash2 size={12} /></button>
                            </div>
                          </div>

                          {/* Inline edit form for item header */}
                          {editingItem === item.id && (
                            <div className="px-4 pb-3 bg-[color-mix(in_srgb,var(--color-info)_10%,transparent)] border-t border-[var(--color-blue-border)] space-y-2">
                              <p className="text-[8px] font-black text-[var(--color-info)] uppercase tracking-widest pt-2">Editar Renglon</p>
                              <div className="grid grid-cols-2 gap-2">
                                <input value={itemEditForm.code || ''} onChange={e => setItemEditForm({...itemEditForm, code: e.target.value})} placeholder="Codigo" className="input" />
                                <input type="number" value={itemEditForm.projectQuantity || 0} onChange={e => setItemEditForm({...itemEditForm, projectQuantity: parseFloat(e.target.value)||0})} placeholder="Cantidad" className="input" />
                              </div>
                              <input value={itemEditForm.description || ''} onChange={e => setItemEditForm({...itemEditForm, description: e.target.value})} placeholder="Descripcion" className="input" />
                              <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setEditingItem(null)} className="flex-1">Cancelar</Button>
                                <Button variant="default" onClick={saveItemEdit} className="flex-1">Guardar</Button>
                              </div>
                            </div>
                          )}

                          <AnimatePresence>
                            {expandedItems.includes(item.id) && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-50 bg-[var(--color-neutral-50)]/50">
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">

                                  {/* Materials */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between border-b border-[var(--color-neutral-100)] pb-1">
                                      <div className="flex items-center gap-2"><Box size={12} className="text-[var(--color-secondary)]" /><span className="text-[9px] font-black uppercase tracking-widest">Materiales</span></div>
                                      <button onClick={() => addMaterial(item.id)} className="flex items-center gap-1 text-[7px] font-black text-[var(--color-success)] hover:text-[var(--color-success)] uppercase"><PlusCircle size={11} /> Agregar</button>
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
                                      {(!item.materials || item.materials.length === 0) && <p className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase italic pl-2 opacity-50">Sin materiales</p>}
                                    </div>
                                  </div>

                                  {/* Labor */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between border-b border-[var(--color-neutral-100)] pb-1">
                                      <div className="flex items-center gap-2"><Hammer size={12} className="text-[var(--color-secondary)]" /><span className="text-[9px] font-black uppercase tracking-widest">Mano de Obra</span></div>
                                      <button onClick={() => addLabor(item.id)} className="flex items-center gap-1 text-[7px] font-black text-[var(--color-success)] hover:text-[var(--color-success)] uppercase"><PlusCircle size={11} /> Agregar</button>
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
                                      {(!item.labor || item.labor.length === 0) && <p className="text-[8px] font-bold text-[var(--color-neutral-400)] uppercase italic pl-2 opacity-50">Sin mano de obra</p>}
                                    </div>
                                  </div>

                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 bg-[var(--color-neutral-50)] border border-dashed border-[var(--color-neutral-200)] rounded-3xl opacity-50">
                        <p className="text-[9px] font-bold text-[var(--color-neutral-400)] uppercase italic tracking-widest">Sin renglones definidos</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-[var(--color-neutral-900)] uppercase tracking-[0.2em] flex items-center gap-2">
                  <TrendingUp size={14} className="text-[var(--color-secondary)]" /> Estado y Avance
                </h4>
                <div className="bg-[var(--color-neutral-900)] rounded-3xl p-6 text-[var(--color-neutral-50)] shadow-xl shadow-[rgba(15,23,42,0.4)] overflow-hidden">
                   <p className="text-[8px] font-black text-[var(--color-neutral-500)] uppercase tracking-widest mb-1">Presupuesto Ejecutable</p>
                    <p className="text-lg sm:text-xl font-black text-[var(--color-secondary)] tracking-tighter mb-4 italic overflow-hidden text-ellipsis whitespace-nowrap w-full block">Q {(selectedProject.budget || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                   
                   <div className="space-y-8">
                     <div>
                       <div className="flex justify-between text-[8px] font-black uppercase tracking-widest mb-2 text-[var(--color-neutral-400)]">
                         <span>Avance Físico Actual</span>
                         <span className="text-[var(--color-secondary)]">{selectedProject.progress || 0}%</span>
                       </div>
                       <div className="h-2 bg-[var(--color-neutral-800)] rounded-full overflow-hidden w-full mb-6 relative">
                         <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${selectedProject.progress || 0}%` }}
                           className="h-full bg-[var(--color-secondary)] rounded-full relative z-10" 
                         />
                          <div className="absolute inset-0 bg-[var(--color-secondary)]/10 animate-pulse w-[var(--pw)]" style={{ '--pw': `${selectedProject.progress || 0}%` } as React.CSSProperties} />
                       </div>
                       
                       <div className="space-y-3">
                         <label className="text-[8px] font-black text-[var(--color-neutral-500)] uppercase tracking-widest">Ajustar Nivel de Avance</label>
                          <input 
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={selectedProject.progress || 0}
                            disabled={updatingProgress}
                            onChange={(e) => handleUpdateProgress(selectedProject.id, parseInt(e.target.value))}
                            title="Ajustar nivel de avance"
                            className="w-full h-2 bg-[var(--color-neutral-800)] rounded-lg appearance-none cursor-pointer accent-secondary"
                          />
                         <div className="flex justify-between text-[7px] font-bold text-[var(--color-neutral-600)] uppercase">
                           <span>Inicio</span>
                           <span>Completado</span>
                         </div>
                       </div>
                     </div>

                     <div className="pt-6 border-t border-slate-800 space-y-4">
                       <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-[var(--color-neutral-500)] uppercase">Prioridad</span>
                         <span className="px-2 py-0.5 bg-[var(--color-error)]/10 text-[var(--color-error)] rounded text-[7px] font-black">ALTA</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-[var(--color-neutral-500)] uppercase">Tipo Cobro</span>
                         <span className="text-[9px] font-black uppercase tracking-widest">Suma Alzada</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-[8px] font-black text-[var(--color-neutral-500)] uppercase">Duración Real</span>
                         <span className="text-[9px] font-black text-[var(--color-secondary)] uppercase tracking-widest text-right max-w-[55%] truncate">
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

            <Button
              variant="ghost"
              onClick={() => setSelectedProject(null)}
              className="w-full py-4 text-[10px]"
            >
              Cerrar Vista Detallada
            </Button>
          </motion.div>
        )}
      </Modal>

      {bulkMode && selectedProjectIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-error)] text-[var(--color-neutral-50)] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4">
          <span className="text-[9px] font-black uppercase tracking-widest">{selectedProjectIds.size} seleccionado(s)</span>
          <button type="button" onClick={handleBulkDeleteProjects}
            className="px-4 py-1.5 bg-[var(--color-surface-solid)] text-[var(--color-error)] rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-[var(--color-error-bg)] transition-all">
            Eliminar
          </button>
          <button type="button" onClick={() => setSelectedProjectIds(new Set())} aria-label="Cancelar selección"
            className="p-1.5 hover:bg-[var(--color-surface-solid)]/20 rounded-lg transition-all">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}



