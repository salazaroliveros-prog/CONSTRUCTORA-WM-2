/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Calendar, 
  MapPin, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Plus, 
  Package, 
  HardHat, 
  Search, 
  Trash2, 
  Settings2,
  DollarSign,
  TrendingUp,
  Save,
  Briefcase,
  AlertCircle,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import { 
  Typology, 
  DEFAULT_WORK_ITEMS, 
  Project, 
  ProjectItem, 
  WorkItem,
  StaffMember
} from '../constants';
import { addDocument, subscribeToCollection, parseError, generateProjectStock } from '../services/firestoreService';
import { uploadFile } from '../services/storageService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ item, onRemove, onUpdateQuantity }: { key?: string, item: ProjectItem, onRemove: (id: string) => void, onUpdateQuantity: (id: string, qty: number) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group"
    >
      <div {...attributes} {...listeners} className="cursor-grab text-slate-400">
        <GripVertical size={20} />
      </div>
      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shrink-0">
        <Briefcase size={16} className="text-secondary" />
      </div>
      <div className="flex-1 min-w-0">
        <h6 className="text-[11px] font-black text-primary uppercase truncate">{item.description}</h6>
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{item.code} • {item.unit}</p>
      </div>
      <div className="w-24">
        <input 
          type="number"
          min="0.1"
          value={item.projectQuantity} 
          onChange={(e) => onUpdateQuantity(item.id, parseFloat(e.target.value))}
          className="w-full bg-white border border-slate-100 rounded-lg px-2 py-1 text-xs font-black text-center"
        />
      </div>
      <button 
        onClick={() => onRemove(item.id)}
        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STEPS = [
  { id: 'info', title: 'Fundamentos', icon: <Building2 size={20} /> },
  { id: 'team', title: 'Equipo', icon: <HardHat size={20} /> },
  { id: 'selection', title: 'Catálogo', icon: <Plus size={20} /> },
  { id: 'budget', title: 'Presupuesto', icon: <Package size={20} /> },
  { id: 'costs', title: 'Estructura', icon: <Settings2 size={20} /> },
  { id: 'review', title: 'Revisión', icon: <CheckCircle2 size={20} /> },
];

import { toast } from 'sonner';

import ProjectMap from './ProjectMap';

export default function ProjectWizard({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectItemSearchTerm, setProjectItemSearchTerm] = useState('');
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);

  React.useEffect(() => {
    const unsub = subscribeToCollection('staff', (data) => {
      setAllStaff(data as StaffMember[]);
    });
    return () => unsub();
  }, []);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setProject((prev) => {
        const oldIndex = prev.items.findIndex(item => item.id === active.id);
        const newIndex = prev.items.findIndex(item => item.id === over.id);
        return {
          ...prev,
          items: arrayMove(prev.items, oldIndex, newIndex),
        };
      });
    }
  };

  const [project, setProject] = useState<Project>({
    id: 'temp-' + Date.now(),
    name: '',
    clientName: '',
    typology: Typology.RESIDENCIAL,
    status: 'COTIZACION',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    location: '',
    teamIds: [],
    items: [],
    directCosts: 0,
    indirectCosts: 15,
    administrativeCosts: 5,
    personalCosts: 10,
    progress: 0,
    budget: 0,
    attachments: []
  });


  const availableItems = useMemo(() => {
    return DEFAULT_WORK_ITEMS.filter(item => 
      item.typology === project.typology && 
      (item.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
       item.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [project.typology, searchTerm]);

  const { 
    currentItems: paginatedAvailableItems, 
    currentPage: catalogPage, 
    totalPages: catalogTotalPages, 
    nextPage: nextCatalogPage, 
    prevPage: prevCatalogPage, 
    goToPage: goToCatalogPage,
    startIndex: catalogStartIndex
  } = usePagination<WorkItem>(availableItems, 10);

  const calculateItemTotal = (item: ProjectItem) => {
    const matTotal = (item.materials || []).reduce((acc, m) => acc + (m.price * m.quantity), 0);
    const labTotal = (item.labor || []).reduce((acc, l) => acc + (l.price * l.quantity), 0);
    return (matTotal + labTotal) * (item.projectQuantity || 1);
  };

  const totalDirect = useMemo(() => {
    return project.items.reduce((acc, item) => acc + calculateItemTotal(item), 0);
  }, [project.items]);

  const totalBudget = totalDirect * (1 + (project.indirectCosts + project.administrativeCosts + project.personalCosts) / 100);
  const directsExceedBudget = totalDirect > (project.budget || 0) * 1.15;

  useEffect(() => {
    if (directsExceedBudget) {
      toast.error("Alerta de Presupuesto", {
        description: "El costo directo excede el presupuesto total estimado en más del 15%."
      });
    }
  }, [directsExceedBudget]);

  const addItem = (item: WorkItem) => {
    if (project.items.find(i => i.id === item.id)) return;
    const newItem: ProjectItem = {
      ...item,
      projectQuantity: 1,
      selected: true
    };
    setProject(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const removeItem = (id: string) => {
    setProject(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id)
    }));
  };

  const toggleTeamMember = (id: string) => {
    setProject(prev => {
      const teamIds = prev.teamIds || [];
      if (teamIds.includes(id)) {
        return { ...prev, teamIds: teamIds.filter(tid => tid !== id) };
      } else {
        return { ...prev, teamIds: [...teamIds, id] };
      }
    });
  };

  const updateItemQuantity = (id: string, qty: number) => {
    setProject(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, projectQuantity: Math.max(0.1, qty) } : i)
    }));
  };

  const isStep01Valid = project.name.trim().length >= 3 && project.clientName.trim().length >= 3 && !!project.startDate;

  const [validationErrors, setValidationErrors] = useState<{name?: string, client?: string, date?: string, location?: string, endDate?: string}>({});

  const validateStep01 = () => {
    const errors: {name?: string, client?: string, date?: string, location?: string, endDate?: string} = {};
    if (project.name.trim().length === 0) errors.name = "EL NOMBRE ES REQUERIDO";
    else if (project.name.trim().length < 3) errors.name = "MÍNIMO 3 CARACTERES";
    
    if (project.clientName.trim().length === 0) errors.client = "EL CLIENTE ES REQUERIDO";
    else if (project.clientName.trim().length < 3) errors.client = "MÍNIMO 3 CARACTERES";

    if (!project.startDate) errors.date = "LA FECHA ES REQUERIDA";

    if (project.startDate && project.endDate && new Date(project.startDate) > new Date(project.endDate)) {
        errors.endDate = "FECHA FIN NO PUEDE SER ANTES QUE INICIO";
    }
    
    if (project.location && project.location.trim().length < 3) errors.location = "MÍNIMO 3 CARACTERES";

    setValidationErrors(errors);
    
    const isValid = Object.keys(errors).length === 0;
    if (!isValid) {
      toast.error('Datos inválidos', { description: 'Por favor, revise los campos marcados del proyecto.' });
    }
    
    return isValid;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { id, ...projectData } = project;

      // Firestore rechaza undefined en cualquier nivel — reemplazar con null o eliminar
      const sanitize = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(sanitize);
        if (obj !== null && typeof obj === 'object') {
          return Object.fromEntries(
            Object.entries(obj)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, sanitize(v)])
          );
        }
        return obj;
      };

      const dataToSave = sanitize({
        ...projectData,
        budget: totalBudget,
        executed: 0,
        progress: 0,
        directCosts: totalDirect,
      });

      await addDocument('projects', dataToSave);
      // Auto-generate inventory stock when project is in EJECUCION
      if (dataToSave.status === 'EJECUCION') {
        const created = await generateProjectStock({ ...dataToSave, id: '' });
        if (created > 0) toast.info(`${created} materiales agregados al inventario automáticamente`);
      }
      toast.success("Proyecto creado exitosamente");
      onComplete();
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error(parseError(error));
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Wizard Header / Steps Navigation */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center relative">
          {/* Connecting Line */}
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0 hidden md:block" />
          
          {STEPS.map((step, idx) => (
            <div 
              key={step.id} 
              className={cn(
                "relative z-10 flex flex-col items-center gap-3 transition-all duration-500",
                idx <= currentStep ? "opacity-100" : "opacity-30"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg",
                idx === currentStep ? "bg-slate-900 text-secondary scale-110" : 
                idx < currentStep ? "bg-secondary text-primary" : "bg-white border-2 border-slate-100 text-slate-300"
              )}>
                {step.icon}
              </div>
              <span className="hidden md:block text-[9px] font-black uppercase tracking-widest text-primary">
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <motion.div 
              key="step-info"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8 text-left">
                <div className="space-y-1">
                  <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Paso 01</h3>
                  <h2 className="text-3xl font-black text-primary tracking-tight uppercase">Datos del Proyecto</h2>
                </div>

                <div className="space-y-6">
                  <motion.div 
                    animate={validationErrors.name ? { x: [-2, 2, -2, 2, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className="space-y-2"
                  >
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Comercial de la Obra</label>
                    <div className="relative">
                      <Building2 className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", validationErrors.name ? "text-red-400" : "text-slate-400")} size={18} />
                      <input 
                        type="text" 
                        value={project.name}
                        onChange={(e) => {
                          setProject(p => ({ ...p, name: e.target.value }));
                          if (validationErrors.name) setValidationErrors(prev => ({ ...prev, name: undefined }));
                        }}
                        className={cn(
                          "w-full bg-slate-50 border rounded-2xl pl-12 pr-12 py-4 text-sm font-black uppercase focus:outline-none transition-all",
                          validationErrors.name ? "border-red-200 bg-red-50/30 text-red-900" : "border-slate-100 focus:border-secondary"
                        )}
                        placeholder="EJ: RESIDENCIAL LAS LOMAS"
                      />
                      {validationErrors.name && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500">
                          <AlertCircle size={18} />
                        </div>
                      )}
                    </div>
                  </motion.div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.div 
                      animate={validationErrors.client ? { x: [-2, 2, -2, 2, 0] } : {}}
                      transition={{ duration: 0.4 }}
                      className="space-y-2"
                    >
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente / Propietario</label>
                      <div className="relative">
                        <User className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", validationErrors.client ? "text-red-400" : "text-slate-400")} size={18} />
                        <input 
                          type="text" 
                          value={project.clientName}
                          onChange={(e) => {
                            setProject(p => ({ ...p, clientName: e.target.value }));
                            if (validationErrors.client) setValidationErrors(prev => ({ ...prev, client: undefined }));
                          }}
                          className={cn(
                            "w-full bg-slate-50 border rounded-2xl pl-12 pr-12 py-4 text-sm font-black uppercase focus:outline-none transition-all",
                            validationErrors.client ? "border-red-200 bg-red-50/30 text-red-900" : "border-slate-100 focus:border-secondary"
                          )}
                          placeholder="NOMBRE COMPLETO"
                        />
                        {validationErrors.client && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500">
                            <AlertCircle size={18} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipología Técnica</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select 
                          value={project.typology}
                          onChange={(e) => setProject(p => ({ ...p, typology: e.target.value as Typology }))}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary transition-all appearance-none"
                        >
                          {Object.values(Typology).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.div 
                      animate={validationErrors.date ? { x: [-2, 2, -2, 2, 0] } : {}}
                      transition={{ duration: 0.4 }}
                      className="space-y-2"
                    >
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Inicio</label>
                      <div className="relative">
                        <Calendar className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", validationErrors.date ? "text-red-400" : "text-slate-400")} size={18} />
                        <input 
                          type="date" 
                          value={project.startDate}
                          onChange={(e) => {
                            setProject(p => ({ ...p, startDate: e.target.value }));
                            if (validationErrors.date) setValidationErrors(prev => ({ ...prev, date: undefined }));
                          }}
                          className={cn(
                            "w-full bg-slate-50 border rounded-2xl pl-12 pr-12 py-4 text-sm font-black uppercase focus:outline-none transition-all",
                            validationErrors.date ? "border-red-200 bg-red-50/30 text-red-900" : "border-slate-100 focus:border-secondary"
                          )}
                        />
                        {validationErrors.date && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500">
                            <AlertCircle size={18} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Finalización (Est.)</label>
                      <div className="relative">
                        <Calendar className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", validationErrors.endDate ? "text-red-400" : "text-slate-400")} size={18} />
                        <input 
                          type="date" 
                          value={project.endDate}
                          onChange={(e) => {
                              setProject(p => ({ ...p, endDate: e.target.value }));
                              if (validationErrors.endDate) setValidationErrors(prev => ({ ...prev, endDate: undefined }));
                          }}
                          className={cn(
                            "w-full bg-slate-50 border rounded-2xl pl-12 pr-6 py-4 text-sm font-black uppercase focus:outline-none transition-all",
                            validationErrors.endDate ? "border-red-200 bg-red-50/30 text-red-900" : "border-slate-100 focus:border-secondary"
                          )}
                        />
                        {validationErrors.endDate && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500">
                            <AlertCircle size={18} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ubicación del Proyecto (Seleccione en mapa)</label>
                    <ProjectMap onLocationSelect={(lat, lng) => setProject(p => ({ ...p, location: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }))} />
                    <div className="relative">
                      <MapPin className={cn("absolute left-4 top-1/2 -translate-y-1/2 transition-colors", validationErrors.location ? "text-red-400" : "text-slate-400")} size={18} />
                      <input 
                        type="text" 
                        value={project.location}
                        onChange={(e) => {
                          setProject(p => ({ ...p, location: e.target.value }));
                          if (validationErrors.location) setValidationErrors(prev => ({ ...prev, location: undefined }));
                        }}
                        className={cn(
                          "w-full bg-slate-50 border rounded-2xl pl-12 pr-12 py-4 text-sm font-black uppercase focus:outline-none transition-all",
                          validationErrors.location ? "border-red-200 bg-red-50/30 text-red-900" : "border-slate-100 focus:border-secondary"
                        )}
                        placeholder="EJ: 14.6349, -90.5069"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Documentos Adjuntos</label>
                    <input 
                      type="file" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLoading(true);
                          try {
                            const url = await uploadFile(file, `projects/${project.id}/${file.name}`);
                            setProject(p => ({ ...p, attachments: [...(p.attachments || []), url] }));
                            toast.success("Archivo adjunto exitosamente");
                          } catch (err) {
                            toast.error("Error al subir el archivo");
                          } finally {
                            setLoading(false);
                          }
                        }
                      }}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-slate-100 file:text-primary hover:file:bg-secondary transition-all"
                    />
                    {project.attachments && project.attachments.length > 0 && (
                        <div className="text-[10px] text-slate-500">Archivos adjuntos: {project.attachments.length}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 rounded-3xl p-10 text-white flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                <div className="relative z-10 space-y-6">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-secondary">
                    <TrendingUp size={32} />
                  </div>
                  <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-tight">Define las metas del proyecto</h3>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] leading-relaxed">
                    La información técnica y comercial es la base para el cálculo de costos indirectos y la planificación logística en obra.
                  </p>
                  {directsExceedBudget && (
                    <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-2xl flex gap-3 text-red-100">
                      <AlertCircle size={24} className="shrink-0 text-red-400" />
                      <p className="text-[10px] font-bold uppercase">Advertencia: El costo directo excede el presupuesto total estimado en más del 15%. Revise sus costos directos o el presupuesto.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 1 && (
            <motion.div 
              key="step-team"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white p-8 rounded-3xl border border-slate-200 text-left">
                <h2 className="text-2xl font-black text-primary tracking-tight uppercase mb-2">Asignación de Equipo</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">Selecciona el personal clave para este proyecto</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allStaff.length > 0 ? (
                    allStaff.map(member => {
                      const isSelected = project.teamIds?.includes(member.id);
                      return (
                        <div 
                          key={member.id}
                          onClick={() => toggleTeamMember(member.id)}
                          className={cn(
                            "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 group",
                            isSelected ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 hover:border-secondary"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center font-black",
                              isSelected ? "bg-white/10 text-secondary" : "bg-slate-100 text-slate-400 group-hover:bg-secondary group-hover:text-primary transition-all"
                            )}>
                              {member.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <p className={cn("text-[11px] font-black uppercase truncate", isSelected ? "text-white" : "text-primary")}>{member.name}</p>
                              <p className={cn("text-[9px] font-bold uppercase tracking-widest", isSelected ? "text-slate-400" : "text-slate-400")}>{member.role}</p>
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 size={20} className="text-secondary shrink-0" />}
                        </div>
                      )
                    })
                  ) : (
                    <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No hay personal registrado en el sistema</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div 
              key="step-selection"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-white p-6 rounded-3xl border border-slate-200">
                <div className="text-left">
                  <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-1">Paso 03</h3>
                  <h2 className="text-2xl font-black text-primary tracking-tight uppercase">Catálogo de Renglones</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                    Selecciona las actividades que componen el proyecto
                  </p>
                </div>
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="BUSCAR ACTIVIDAD O CÓDIGO..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-4 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                  <div className="bg-slate-900 p-4 border-b border-slate-800 flex justify-between items-center text-white">
                    <span className="text-[10px] font-black uppercase tracking-widest text-secondary">Disponibles ({availableItems.length})</span>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar p-2">
                    {paginatedAvailableItems.map(item => {
                      const isAdded = project.items.some(i => i.id === item.id);
                      return (
                        <div 
                          key={item.id} 
                          onClick={() => !isAdded && addItem(item)}
                          className={cn(
                            "group p-4 rounded-2xl mb-2 transition-all cursor-pointer border",
                            isAdded ? "bg-slate-50 border-slate-100 opacity-50" : "bg-white border-transparent hover:border-secondary hover:shadow-md"
                          )}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-[9px] text-secondary font-black uppercase">{item.code}</p>
                              <h5 className="text-[11px] font-black text-primary leading-tight uppercase truncate">{item.description}</h5>
                              <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{item.unit}</p>
                            </div>
                            <div className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                              isAdded ? "bg-green-50 text-green-500" : "bg-slate-100 text-slate-300 group-hover:bg-secondary group-hover:text-primary"
                            )}>
                              {isAdded ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="p-3 border-t border-slate-50">
                    <Pagination 
                      currentPage={catalogPage}
                      totalPages={catalogTotalPages}
                      onNext={nextCatalogPage}
                      onPrev={prevCatalogPage}
                      onPage={goToCatalogPage}
                      totalItems={availableItems.length}
                      startIndex={catalogStartIndex}
                      itemsPerPage={10}
                      compact
                    />
                  </div>
                </div>

                <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                  <div className="bg-slate-50 p-4 border-b border-slate-100 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-primary">
                      <span className="text-[10px] font-black uppercase tracking-widest">Actividades del Proyecto ({project.items.length})</span>
                      <span className="text-[10px] font-black text-secondary">Directo Estimado: Q {totalDirect.toLocaleString()}</span>
                    </div>
                    <input 
                      type="text" 
                      placeholder="BUSCAR ACTIVIDAD O CÓDIGO..." 
                      value={projectItemSearchTerm}
                      onChange={(e) => setProjectItemSearchTerm(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg pl-4 pr-4 py-2 text-[10px] font-black uppercase focus:outline-none focus:border-secondary transition-all"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
                    {project.items.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 opacity-50">
                        <Plus size={48} />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Agrega renglones del catálogo</p>
                      </div>
                    ) : (
                      <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext 
                          items={project.items.filter(i => i.description.toLowerCase().includes(projectItemSearchTerm.toLowerCase()) || i.code.toLowerCase().includes(projectItemSearchTerm.toLowerCase())).map(i => i.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {project.items.filter(i => i.description.toLowerCase().includes(projectItemSearchTerm.toLowerCase()) || i.code.toLowerCase().includes(projectItemSearchTerm.toLowerCase())).map(item => (
                            <SortableItem 
                              key={item.id} 
                              item={item} 
                              onRemove={removeItem}
                              onUpdateQuantity={updateItemQuantity}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div 
              key="step-budget"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 text-left"
            >
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-1">Paso 04</h3>
                <h2 className="text-2xl font-black text-primary tracking-tight uppercase">Cantidades de Obra</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 mb-8">
                  Define el volumen proyectado para cada actividad
                </p>

                <div className="space-y-3">
                  {project.items.map(item => (
                    <div key={item.id} className="bg-slate-50 border border-slate-100 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                      <div className="md:col-span-5 flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 shrink-0">
                          <Package size={16} />
                        </div>
                        <div className="min-w-0">
                          <h6 className="text-[11px] font-black text-primary uppercase tracking-tight truncate">{item.description}</h6>
                          <p className="text-[9px] font-black text-slate-400 uppercase mt-0.5">Precio Unitario: Q {((calculateItemTotal(item) / item.projectQuantity) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                      <div className="md:col-span-4 flex items-center gap-4">
                        <input 
                          type="range"
                          min="0.1"
                          max="500"
                          step="0.1"
                          value={item.projectQuantity}
                          onChange={(e) => updateItemQuantity(item.id, parseFloat(e.target.value))}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-secondary"
                        />
                        <div className="w-20 text-center">
                          <input 
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={item.projectQuantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateItemQuantity(item.id, isNaN(val) ? 0.1 : val);
                            }}
                            className={cn(
                              "w-full bg-white border rounded-lg px-2 py-2 text-xs font-black text-center text-primary focus:outline-none transition-all",
                              item.projectQuantity < 0.1 ? "border-red-200 text-red-500" : "border-slate-100 focus:border-secondary"
                            )}
                          />
                          <span className="text-[8px] font-black text-slate-400 uppercase mt-1 block">{item.unit}</span>
                        </div>
                      </div>
                      <div className="md:col-span-3 text-right">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Subtotal</p>
                         <p className="text-lg font-black text-primary">Q {calculateItemTotal(item).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div 
              key="step-costs"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left"
            >
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                <div className="space-y-1">
                  <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Paso 05</h3>
                  <h2 className="text-2xl font-black text-primary tracking-tight uppercase">Costos Indirectos</h2>
                </div>

                <div className="space-y-6">
                  {[
                    { label: 'Administración', key: 'administrativeCosts', icon: <User size={18} /> },
                    { label: 'Indirectos & Imprevistos', key: 'indirectCosts', icon: <Settings2 size={18} /> },
                    { label: 'Utilidad / Personal', key: 'personalCosts', icon: <DollarSign size={18} /> },
                  ].map((field) => (
                    <div key={field.key} className="space-y-2">
                      <div className="flex justify-between items-center mb-2 px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           {field.icon} {field.label}
                        </label>
                        <span className="text-[10px] font-black text-primary">{String(project[field.key as keyof Pick<Project, "administrativeCosts" | "indirectCosts" | "personalCosts" | "progress" | "budget">] || 0)}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="30"
                        step="0.5"
                        value={project[field.key as keyof Project] as number}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setProject(p => ({ ...p, [field.key]: val }));
                        }}
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-secondary"
                      />
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Factor Multiplicador</p>
                   <p className="text-3xl font-black text-secondary">
                     {(project.indirectCosts + project.administrativeCosts + project.personalCosts).toFixed(1)}%
                   </p>
                </div>
              </div>

              <div className="bg-primary text-white p-10 rounded-3xl shadow-2xl shadow-slate-900/20 flex flex-col justify-between overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-[120px]" />
                
                <div className="relative z-10 space-y-4">
                  <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Consolidado Financiero</h4>
                  <div className="space-y-6 pt-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo Directo</p>
                      <p className="text-4xl font-black text-white tracking-tighter">Q {totalDirect.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo Total Presupuestado</p>
                      <p className="text-5xl font-black text-secondary tracking-tighter">Q {totalBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="pt-6 grid grid-cols-2 gap-4">
                       <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Margen Bruto</p>
                          <p className="text-lg font-black text-green-400">Q {(totalBudget - totalDirect).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 5 && (
            <motion.div 
              key="step-review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 text-left"
            >
              <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm space-y-10">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-green-50 text-green-500 rounded-3xl flex items-center justify-center mx-auto mb-4 border-2 border-green-100 shadow-sm">
                    <CheckCircle2 size={32} />
                  </div>
                  <h2 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Revisión Final (Paso 06)</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confirma los detalles antes de guardar en el sistema</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 border-t border-slate-50 pt-10">
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Información del Proyecto</h4>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nombre Comercial</p>
                        <p className="text-lg font-black text-primary uppercase">{project.name || 'SIN NOMBRE'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                         <div>
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ubicación</p>
                           <p className="text-sm font-black text-primary uppercase">{project.location || 'N/A'}</p>
                         </div>
                         <div>
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Finalización Est.</p>
                           <p className="text-sm font-black text-primary uppercase">{project.endDate || 'N/A'}</p>
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                         <div>
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cliente</p>
                           <p className="text-sm font-black text-primary uppercase">{project.clientName || 'SIN CLIENTE'}</p>
                         </div>
                         <div>
                           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Programado</p>
                           <p className="text-sm font-black text-primary uppercase">{project.startDate}</p>
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Resumen Financiero</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end p-4 bg-slate-900 rounded-2xl text-white">
                         <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Presupuesto Final</p>
                            <p className="text-2xl font-black text-secondary tracking-tighter shrink-0 leading-none">Q {totalBudget.toLocaleString()}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Renglones</p>
                            <p className="text-lg font-black text-white leading-none">{project.items.length}</p>
                         </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                         <div className="p-3 bg-slate-50 rounded-xl text-center">
                            <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Administrador</p>
                            <p className="text-xs font-black text-primary">{project.administrativeCosts}%</p>
                         </div>
                         <div className="p-3 bg-slate-50 rounded-xl text-center">
                            <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Indir.</p>
                            <p className="text-xs font-black text-primary">{project.indirectCosts}%</p>
                         </div>
                         <div className="p-3 bg-slate-50 rounded-xl text-center">
                            <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Pers.</p>
                            <p className="text-xs font-black text-primary">{project.personalCosts}%</p>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center pt-6">
                  <button 
                    disabled={loading || !project.name}
                    onClick={handleSave}
                    className="group bg-slate-900 text-white px-10 py-5 rounded-3xl text-xs font-black uppercase tracking-widest flex items-center gap-4 hover:bg-secondary hover:text-primary transition-all shadow-2xl shadow-slate-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save size={20} className="text-secondary group-hover:text-primary transition-colors" />
                        Finalizar y Guardar Proyecto
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-between items-center pt-8 border-t border-slate-100">
        <button 
          onClick={prevStep}
          disabled={currentStep === 0}
          className="flex items-center gap-3 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-all disabled:opacity-0"
        >
          <ChevronLeft size={18} /> Anterior
        </button>
        
        {currentStep < STEPS.length - 1 && (
           <button 
            onClick={() => {
              if (currentStep === 0) {
                if (validateStep01()) nextStep();
              } else {
                nextStep();
              }
            }}
            disabled={
              (currentStep === 2 && project.items.length === 0)
            }
            className="group flex items-center gap-3 bg-white border border-slate-200 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-primary hover:border-secondary hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente <ChevronRight size={18} className="text-secondary group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
}
