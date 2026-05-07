/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  Search, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  FileDown, 
  Settings2,
  Package,
  HardHat,
  Save,
  CheckCircle2,
  AlertTriangle,
  Percent,
  Gauge,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import { 
  Typology, 
  DEFAULT_WORK_ITEMS, 
  Project, 
  ProjectItem, 
  WorkItem 
} from '../constants';
import { generateBudgetPDF, generateBudgetCSV, generateBudgetPDFEjecutivo, generateBudgetPDFAPU } from '../lib/reports';
import { APU_BY_TYPOLOGY, APUItem } from '../lib/apuLibrary';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { addDocument, parseError, subscribeToCollection } from '../services/firestoreService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function CalculatorModule() {
  const [selectedTypology, setSelectedTypology] = useState<Typology>(Typology.RESIDENCIAL);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentProject, setCurrentProject] = useState<Project>({
    id: 'temp-id',
    name: 'Nuevo Proyecto',
    clientName: 'Cliente Sin Nombre',
    typology: Typology.RESIDENCIAL,
    status: 'COTIZACION',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    items: [],
    directCosts: 0,
    indirectCosts: 15,
    administrativeCosts: 5,
    personalCosts: 10,
    progress: 0,
    budget: 0
  });

  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  
  // Motor de Cálculo Avanzado - Configuración
  const [wasteFactors, setWasteFactors] = useState({
    materials: 5, // % de desperdicio de materiales
    labor: 0,     // % de desperdicio de mano de obra
  });
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [areaTotal, setAreaTotal] = useState(0);
  const [showAPUPanel, setShowAPUPanel] = useState(false);
  const [apuSearch, setApuSearch] = useState('');

  // Available items filtered by typology and search
  const availableItems = useMemo<WorkItem[]>(() => {
    return DEFAULT_WORK_ITEMS.filter(item => 
      item.typology === selectedTypology && 
      (item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
       item.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [selectedTypology, searchTerm]);

  const { 
    currentItems: paginatedAvailableItems, 
    currentPage, 
    totalPages, 
    nextPage, 
    prevPage, 
    goToPage,
    startIndex,
    totalItems: totalItemsCount
  } = usePagination<WorkItem>(availableItems, 8);

  const addItem = (item: WorkItem) => {
    if (currentProject.items.find(i => i.id === item.id)) return;
    const newItem: ProjectItem = {
      ...item,
      projectQuantity: 1,
      selected: true
    };
    setCurrentProject(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const removeItem = (id: string) => {
    setCurrentProject(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== id)
    }));
  };

  const updateMaterialField = (itemId: string, matIdx: number, field: string, value: any) => {
    setCurrentProject(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const newMaterials = [...item.materials];
          newMaterials[matIdx] = { ...newMaterials[matIdx], [field]: value };
          return { ...item, materials: newMaterials };
        }
        return item;
      })
    }));
  };

  const updateLaborField = (itemId: string, labIdx: number, field: string, value: any) => {
    setCurrentProject(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const newLabor = [...item.labor];
          newLabor[labIdx] = { ...newLabor[labIdx], [field]: value };
          return { ...item, labor: newLabor };
        }
        return item;
      })
    }));
  };

  const addCustomItem = () => {
    const customId = `CUSTOM-${Date.now()}`;
    const newItem: ProjectItem = {
      id: customId,
      code: 'CUST-000',
      description: 'NUEVO TRABAJO PERSONALIZADO',
      unit: 'GL',
      typology: selectedTypology,
      category: 'Personalizado',
      durationDays: 1,
      projectQuantity: 1,
      selected: true,
      materials: [{ name: 'Material Nuevo', unit: 'GL', quantity: 1, price: 0 }],
      labor: [{ role: 'Oficial', unit: 'día', quantity: 1, price: 0 }]
    };
    setCurrentProject(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setExpandedItem(customId);
  };

  const addAPUItem = (apu: APUItem) => {
    if (currentProject.items.find(i => i.id === apu.id)) {
      toast.info('Este renglón APU ya está en el presupuesto');
      return;
    }
    const newItem: ProjectItem = {
      id: apu.id,
      code: apu.code,
      description: apu.description,
      unit: apu.unit,
      typology: apu.typology,
      category: apu.category,
      durationDays: apu.durationDays,
      projectQuantity: 1,
      selected: true,
      materials: apu.materials.map(m => ({ ...m })),
      labor: apu.labor.map(l => ({ ...l })),
    };
    setCurrentProject(prev => ({ ...prev, items: [...prev.items, newItem] }));
    toast.success(`APU agregado: ${apu.description}`);
    setShowAPUPanel(false);
  };

  const updateItemBasic = (id: string, field: 'description' | 'unit', value: string) => {
    setCurrentProject(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, [field]: value } : i)
    }));
  };

  const updateQuantity = (id: string, qty: number) => {
    setCurrentProject(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, projectQuantity: Math.max(0.1, qty) } : i)
    }));
  };

  const updateDurationDays = (id: string, days: number) => {
    setCurrentProject(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, durationDays: Math.max(0.01, days) } : i)
    }));
  };

  const calculateItemTotal = (item: ProjectItem) => {
    const matTotal = item.materials.reduce((acc, m) => acc + (Math.max(0, m.price || 0) * m.quantity), 0);
    const labTotal = item.labor.reduce((acc, l) => acc + (Math.max(0, l.price || 0) * l.quantity), 0);
    return (matTotal + labTotal) * item.projectQuantity;
  };

  // Cálculo con factor de desperdicio
  const calculateItemTotalWithWaste = (item: ProjectItem) => {
    const matTotal = item.materials.reduce((acc, m) => acc + (Math.max(0, m.price || 0) * m.quantity), 0);
    const labTotal = item.labor.reduce((acc, l) => acc + (Math.max(0, l.price || 0) * l.quantity), 0);
    const matWithWaste = matTotal * (1 + wasteFactors.materials / 100);
    const labWithWaste = labTotal * (1 + wasteFactors.labor / 100);
    return (matWithWaste + labWithWaste) * item.projectQuantity;
  };

  const totalDirect = useMemo(() => {
    return currentProject.items.reduce((acc, item) => acc + calculateItemTotalWithWaste(item), 0);
  }, [currentProject.items, wasteFactors]);

  // Desglose de costos
  const costBreakdown = useMemo(() => {
    const materialsTotal = currentProject.items.reduce((acc, item) => {
      const mat = item.materials.reduce((m, mat) => m + (mat.price || 0) * mat.quantity, 0);
      return acc + (mat * (1 + wasteFactors.materials / 100) * item.projectQuantity);
    }, 0);
    
    const laborTotal = currentProject.items.reduce((acc, item) => {
      const lab = item.labor.reduce((l, lab) => l + (lab.price || 0) * lab.quantity, 0);
      return acc + (lab * (1 + wasteFactors.labor / 100) * item.projectQuantity);
    }, 0);

    const wasteAmount = currentProject.items.reduce((acc, item) => {
      const mat = item.materials.reduce((m, mat) => m + (mat.price || 0) * mat.quantity, 0);
      return acc + (mat * (wasteFactors.materials / 100) * item.projectQuantity);
    }, 0);

    const indirectCost = totalDirect * (currentProject.indirectCosts / 100);
    const adminCost = totalDirect * (currentProject.administrativeCosts / 100);
    const personalCost = totalDirect * (currentProject.personalCosts / 100);
    
    return { materialsTotal, laborTotal, wasteAmount, indirectCost, adminCost, personalCost };
  }, [currentProject.items, totalDirect, wasteFactors, currentProject.indirectCosts, currentProject.administrativeCosts, currentProject.personalCosts]);

  const totalBudget = totalDirect * (1 + (currentProject.indirectCosts + currentProject.administrativeCosts + currentProject.personalCosts) / 100);
  
  // Costo por m2
  const costPerM2 = areaTotal > 0 ? totalBudget / areaTotal : 0;
  
  // Duración estimada corregida: (qty × days/unit) / cuadrilla
  const estimatedDays = useMemo(() => {
    return currentProject.items.reduce((acc, item) => {
      const workers = Math.max(1, item.labor.reduce((s, l) => s + (l.quantity || 0), 0));
      return acc + Math.ceil((item.projectQuantity * (item.durationDays || 1)) / workers);
    }, 0);
  }, [currentProject.items]);

  const [saving, setSaving] = useState(false);
  const [pdfTemplate, setPdfTemplate] = useState<'completo' | 'ejecutivo' | 'apu'>('completo');

  // Cargar clientes para el selector
  const [clientList, setClientList] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    return subscribeToCollection('clients', (data: any[]) =>
      setClientList(data.map(c => ({ id: c.id, name: c.name })))
    );
  }, []);

  const handleSaveProject = async () => {
    if (!currentProject.name || currentProject.items.length === 0) {
      toast.error('Datos incompletos', { description: 'Debe ingresar un nombre y agregar renglones' });
      return;
    }
    setSaving(true);
    try {
      const { id, ...projectData } = currentProject;
      const dataToSave = {
        ...projectData,
        budget: totalBudget,
        executed: 0,
        progress: 0,
        directCosts: totalDirect,
      };
      await addDocument('projects', dataToSave);
      toast.success('Cotización guardada como proyecto');
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar', { description: parseError(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="calculator-motor" className="space-y-6 animate-in fade-in duration-500">
      {/* Header with Project Stats */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Calculator size={120} className="text-slate-900" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-2 space-y-4">
               <div className="flex items-center gap-2 text-secondary font-black text-[10px] uppercase tracking-[0.2em]">
                  <Settings2 size={16} /> Motor de Cálculo V 2.4.1
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Nombre del Proyecto</label>
                 <input 
                   type="text" 
                   value={currentProject.name}
                   onChange={(e) => setCurrentProject(p => ({ ...p, name: e.target.value }))}
                   className="text-4xl font-black bg-transparent border-b-2 border-transparent focus:border-secondary focus:outline-none w-full tracking-tighter text-primary"
                   placeholder="NOMBRE DEL PROYECTO..."
                 />
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Nombre del Cliente</label>
                   <select
                     value={currentProject.clientName}
                     onChange={e => setCurrentProject(p => ({ ...p, clientName: e.target.value }))}
                     className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-secondary"
                   >
                     <option value="">— Seleccionar cliente —</option>
                     {clientList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                     <option value={currentProject.clientName && !clientList.find(c => c.name === currentProject.clientName) ? currentProject.clientName : '__custom__'}>
                       + Escribir manualmente
                     </option>
                   </select>
                   {/* Si eligió "escribir manualmente" o no está en la lista */}
                   {(currentProject.clientName === '__custom__' || (currentProject.clientName && !clientList.find(c => c.name === currentProject.clientName))) && (
                     <input
                       type="text"
                       value={currentProject.clientName === '__custom__' ? '' : currentProject.clientName}
                       onChange={e => setCurrentProject(p => ({ ...p, clientName: e.target.value }))}
                       placeholder="Nombre del cliente..."
                       className="w-full bg-white border border-secondary rounded px-3 py-2 text-xs font-bold focus:outline-none mt-1"
                     />
                   )}
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Estado del Proyecto</label>
                   <select 
                     value={currentProject.status}
                     onChange={(e) => setCurrentProject(p => ({ ...p, status: e.target.value as any }))}
                     className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-secondary uppercase"
                   >
                     <option value="COTIZACION">Cotización</option>
                     <option value="PRE-ESTUDIO">Pre-Estudio</option>
                     <option value="EJECUCION">En Ejecución</option>
                     <option value="FINALIZADO">Finalizado</option>
                   </select>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Fecha de Inicio</label>
                   <input
                     type="date"
                     value={currentProject.startDate?.split('T')[0] ?? ''}
                     onChange={e => setCurrentProject(p => ({ ...p, startDate: e.target.value }))}
                     className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-secondary"
                   />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Fecha de Entrega</label>
                   <input
                     type="date"
                     value={currentProject.endDate?.split('T')[0] ?? ''}
                     onChange={e => setCurrentProject(p => ({ ...p, endDate: e.target.value }))}
                     className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-secondary"
                   />
                 </div>
               </div>

               <div className="flex gap-4 items-end">
                 <div className="space-y-1 flex-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Tipología</label>
                   <select 
                     value={selectedTypology}
                     onChange={(e) => setSelectedTypology(e.target.value as Typology)}
                     className="w-full bg-slate-100 border border-slate-200 rounded px-3 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none"
                   >
                     {Object.values(Typology).map(t => (
                       <option key={t} value={t}>{t}</option>
                     ))}
                   </select>
                 </div>
                 <div className="text-[10px] mb-2 text-slate-400 font-black uppercase tracking-widest whitespace-nowrap">
                    {currentProject.items.length} Renglones
                 </div>
               </div>
            </div>

           <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-100 p-5 rounded-xl flex flex-col justify-between">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo Directo</span>
                 <h4 className="text-2xl font-black tracking-tighter text-primary">Q {totalDirect.toLocaleString()}</h4>
                 <div className="flex gap-2 mt-2">
                   <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Mat: Q{costBreakdown.materialsTotal.toLocaleString()}</span>
                   <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">M.O: Q{costBreakdown.laborTotal.toLocaleString()}</span>
                 </div>
              </div>
              <div className="bg-secondary text-primary p-5 rounded-xl flex flex-col justify-between shadow-xl shadow-secondary/10">
                 <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Total Presupuesto</span>
                 <h4 className="text-2xl font-black tracking-tighter">Q {totalBudget.toLocaleString()}</h4>
                 <div className="flex gap-2 mt-2">
                   <span className="text-[8px] font-bold text-primary/70 bg-primary/10 px-2 py-0.5 rounded">{estimatedDays.toFixed(0)} dias est.</span>
                   {costPerM2 > 0 && <span className="text-[8px] font-bold text-primary/70 bg-primary/10 px-2 py-0.5 rounded">Q{costPerM2.toFixed(0)}/m2</span>}
                 </div>
              </div>
           </div>
        </div>

        {/* Panel de Configuración Avanzada */}
        <div className="mt-6 border-t border-slate-100 pt-6">
          <button
            onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
            className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-primary transition-colors"
          >
            <Settings2 size={14} className={cn("transition-transform", showAdvancedConfig && "rotate-90")} />
            Configuracion Avanzada del Motor
            <ChevronDown size={12} className={cn("transition-transform", showAdvancedConfig && "rotate-180")} />
          </button>
          
          {showAdvancedConfig && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              {/* Factor de Desperdicio */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <AlertTriangle size={10} className="text-amber-500" /> Desperdicio Materiales
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={wasteFactors.materials}
                    onChange={(e) => setWasteFactors(p => ({ ...p, materials: parseFloat(e.target.value) }))}
                    className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-sm font-black text-amber-600 w-12 text-right">{wasteFactors.materials}%</span>
                </div>
                <p className="text-[7px] text-slate-400 font-bold">Desperdicio: Q{costBreakdown.wasteAmount.toLocaleString()}</p>
              </div>

              {/* Área Total */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Gauge size={10} className="text-blue-500" /> Area Total (m2)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={areaTotal || ''}
                  onChange={(e) => setAreaTotal(parseFloat(e.target.value) || 0)}
                  placeholder="Ej: 150"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-secondary"
                />
                {costPerM2 > 0 && <p className="text-[7px] text-blue-600 font-bold">Costo/m2: Q{costPerM2.toFixed(2)}</p>}
              </div>

              {/* Costos Indirectos */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Percent size={10} className="text-emerald-500" /> Costos Indirectos
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={currentProject.indirectCosts}
                      onChange={(e) => setCurrentProject(p => ({ ...p, indirectCosts: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[10px] font-bold text-center focus:outline-none focus:border-secondary"
                    />
                    <span className="text-[7px] text-slate-400 font-bold block text-center">Indir. %</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={currentProject.administrativeCosts}
                      onChange={(e) => setCurrentProject(p => ({ ...p, administrativeCosts: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[10px] font-bold text-center focus:outline-none focus:border-secondary"
                    />
                    <span className="text-[7px] text-slate-400 font-bold block text-center">Admin. %</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={currentProject.personalCosts}
                      onChange={(e) => setCurrentProject(p => ({ ...p, personalCosts: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1.5 text-[10px] font-bold text-center focus:outline-none focus:border-secondary"
                    />
                    <span className="text-[7px] text-slate-400 font-bold block text-center">Pers. %</span>
                  </div>
                </div>
              </div>

              {/* Resumen Desglose */}
              <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-100">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <BarChart3 size={10} className="text-purple-500" /> Desglose de Costos
                </label>
                <div className="space-y-1 text-[8px] font-bold">
                  <div className="flex justify-between"><span className="text-slate-500">Indirectos:</span><span className="text-slate-700">Q{costBreakdown.indirectCost.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Administrativos:</span><span className="text-slate-700">Q{costBreakdown.adminCost.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Personales:</span><span className="text-slate-700">Q{costBreakdown.personalCost.toLocaleString()}</span></div>
                  <div className="flex justify-between border-t border-slate-100 pt-1 mt-1"><span className="text-primary font-black">TOTAL:</span><span className="text-primary font-black">Q{totalBudget.toLocaleString()}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3 border-t border-slate-50 pt-6 flex-wrap">
           <div className="flex items-center gap-2">
             <select
               value={pdfTemplate}
               onChange={e => setPdfTemplate(e.target.value as any)}
               className="h-10 bg-white border border-slate-200 rounded-lg px-2 text-[8px] font-black uppercase focus:outline-none focus:border-secondary"
             >
               <option value="completo">PDF Completo (4 páginas)</option>
               <option value="ejecutivo">PDF Ejecutivo (1 página)</option>
               <option value="apu">PDF APU Detallado</option>
             </select>
             <button
               onClick={() => {
                 if (pdfTemplate === 'ejecutivo') generateBudgetPDFEjecutivo(currentProject);
                 else if (pdfTemplate === 'apu') generateBudgetPDFAPU(currentProject);
                 else generateBudgetPDF(currentProject);
               }}
               className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:bg-primary/90"
             >
               <FileDown size={14} className="text-secondary" /> Exportar PDF
             </button>
           </div>
           <button 
             onClick={() => generateBudgetCSV(currentProject)}
             className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50"
           >
             <FileDown size={14} /> EXPORTAR CSV
           </button>
           <button 
             onClick={handleSaveProject}
             disabled={saving}
             className="flex items-center gap-2 ml-auto bg-primary text-white px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50">
             <Save size={14} className="text-secondary" /> {saving ? 'GUARDANDO...' : 'GUARDAR COTIZACIÓN'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Selector Column (Renglones Disponibles) */}
        <div className="lg:col-span-4 space-y-4">
           <div className="sticky top-20 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="BUSCAR RENGLÓN..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-bold focus:outline-none focus:border-secondary"
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-900 px-4 py-3 border-b border-slate-700 flex justify-between items-center text-white">
                   <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Renglones {selectedTypology}</h4>
                   <span className="bg-slate-700 px-2 py-0.5 rounded text-[9px] font-black">{availableItems.length}</span>
                </div>
                <div className="p-3 border-b border-slate-50 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setShowAPUPanel(v => !v); setApuSearch(''); }}
                      className="bg-blue-50 border border-blue-200 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-100 transition-all flex items-center justify-center gap-1"
                    >
                      <Search size={12} /> Librería APU
                    </button>
                    <button
                      onClick={addCustomItem}
                      className="bg-slate-50 border border-dashed border-slate-300 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-secondary hover:border-secondary transition-all flex items-center justify-center gap-1"
                    >
                      <Plus size={12} /> Personalizado
                    </button>
                  </div>

                  {/* Panel Librería APU */}
                  {showAPUPanel && (() => {
                    const apuItems = APU_BY_TYPOLOGY[selectedTypology] ?? [];
                    const filtered = apuItems.filter(a =>
                      a.description.toLowerCase().includes(apuSearch.toLowerCase()) ||
                      a.category.toLowerCase().includes(apuSearch.toLowerCase()) ||
                      a.code.toLowerCase().includes(apuSearch.toLowerCase())
                    );
                    return (
                      <div className="border border-blue-200 rounded-xl overflow-hidden bg-white">
                        <div className="bg-blue-600 px-3 py-2 flex items-center justify-between">
                          <span className="text-[8px] font-black text-white uppercase">Librería APU — {selectedTypology}</span>
                          <span className="text-[7px] text-blue-200">{apuItems.length} renglones</span>
                        </div>
                        <div className="p-2">
                          <input
                            value={apuSearch}
                            onChange={e => setApuSearch(e.target.value)}
                            placeholder="Buscar en librería..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-bold focus:outline-none focus:border-blue-400"
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                          {filtered.length === 0 && (
                            <p className="text-center py-4 text-[8px] text-slate-300 font-bold uppercase">Sin resultados</p>
                          )}
                          {filtered.map(apu => {
                            const matTotal = apu.materials.reduce((s, m) => s + m.price * m.quantity, 0);
                            const labTotal = apu.labor.reduce((s, l) => s + l.price * l.quantity, 0);
                            const unitCost = matTotal + labTotal;
                            const alreadyAdded = currentProject.items.some(i => i.id === apu.id);
                            return (
                              <div key={apu.id} className="p-2 hover:bg-blue-50 transition-colors flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[8px] font-black text-slate-700 uppercase truncate">{apu.description}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[7px] font-bold text-blue-500 uppercase">{apu.category}</span>
                                    <span className="text-[7px] text-slate-400">·</span>
                                    <span className="text-[7px] font-bold text-slate-500">{apu.unit}</span>
                                    <span className="text-[7px] text-slate-400">·</span>
                                    <span className="text-[7px] font-black text-amber-600">Q{unitCost.toLocaleString()}/{apu.unit}</span>
                                  </div>
                                  <div className="flex gap-1 mt-0.5 flex-wrap">
                                    {apu.materials.slice(0, 3).map((m, i) => (
                                      <span key={i} className="text-[6px] bg-slate-100 text-slate-500 px-1 rounded">{m.name}</span>
                                    ))}
                                    {apu.materials.length > 3 && <span className="text-[6px] text-slate-400">+{apu.materials.length - 3} más</span>}
                                  </div>
                                </div>
                                <button
                                  onClick={() => addAPUItem(apu)}
                                  disabled={alreadyAdded}
                                  className={cn(
                                    'shrink-0 p-1.5 rounded-lg transition-all',
                                    alreadyAdded ? 'bg-green-100 text-green-500' : 'bg-blue-600 text-white hover:bg-blue-700'
                                  )}
                                >
                                  {alreadyAdded ? <CheckCircle2 size={12} /> : <Plus size={12} />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                    {paginatedAvailableItems.map((item) => {
                      const isAdded = currentProject.items.some(i => i.id === item.id);
                      return (
                        <div 
                          key={item.id} 
                          className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                        >
                          <div className="flex-1">
                             <p className="text-[9px] text-secondary font-black uppercase tracking-tighter">{item.code}</p>
                             <h5 className="text-xs font-black text-primary uppercase leading-tight">{item.description}</h5>
                             <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">{item.category} • {item.unit}</p>
                          </div>
                          <button 
                            disabled={isAdded}
                            onClick={() => addItem(item)}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              isAdded 
                                ? "bg-green-50 text-green-500" 
                                : "bg-slate-100 text-slate-400 hover:bg-secondary hover:text-primary shadow-sm"
                            )}
                          >
                            {isAdded ? <CheckCircle2 size={18} /> : <Plus size={18} />}
                          </button>
                        </div>
                      );
                    })}
                </div>
                <div className="p-3 border-t border-slate-50">
                  <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onNext={nextPage}
                    onPrev={prevPage}
                    onPage={goToPage}
                    totalItems={totalItemsCount}
                    startIndex={startIndex}
                    itemsPerPage={8}
                    compact
                  />
                </div>
              </div>
           </div>
        </div>

        {/* Right: Budget View (Desglose) */}
        <div className="lg:col-span-8 space-y-3">
           {currentProject.items.length === 0 ? (
             <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center flex flex-col items-center gap-4">
                <div className="p-6 bg-slate-50 rounded-full text-slate-200">
                   <Plus size={40} />
                </div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest leading-loose">Seleccione renglones a la izquierda <br/> para iniciar el presupuesto</h3>
             </div>
           ) : (
             <div className="space-y-3">
               {currentProject.items.map((item) => (
                 <motion.div 
                   layout
                   initial={{ opacity: 0, scale: 0.95 }}
                   animate={{ opacity: 1, scale: 1 }}
                   key={item.id} 
                   className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
                 >
                    <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}>
                       <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex flex-col items-center justify-center border border-slate-700">
                          <input 
                            value={item.unit}
                            onChange={(e) => updateItemBasic(item.id, 'unit', e.target.value)}
                            className="bg-transparent border-none text-[9px] font-black text-secondary text-center w-full focus:outline-none uppercase"
                          />
                          <span className="text-sm font-black leading-none">{item.projectQuantity}</span>
                       </div>
                       <div className="flex-1">
                          <input 
                            value={item.description}
                            onChange={(e) => updateItemBasic(item.id, 'description', e.target.value)}
                            className="w-full bg-transparent border-none text-xs font-black text-primary uppercase tracking-tight focus:outline-none focus:border-b border-secondary/20"
                            placeholder="Descripción"
                          />
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{item.category}</p>
                       </div>
                       <div className="text-right mr-4">
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Subtotal</p>
                          <p className="text-sm font-black text-secondary">Q {calculateItemTotal(item).toLocaleString()}</p>
                       </div>
                       <div className="flex gap-2 items-center text-slate-300">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (window.confirm('¿Seguro que desea eliminar el renglón del presupuesto?')) {
                                removeItem(item.id); 
                              }
                            }}
                            className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors group"
                            title="Eliminar renglón"
                          >
                             <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                          </button>
                          {expandedItem === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                       </div>
                    </div>

                    <AnimatePresence>
                      {expandedItem === item.id && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="border-t border-slate-50 bg-slate-50/50 p-6 space-y-6 overflow-hidden"
                        >
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              {/* Materials */}
                              <div className="space-y-3">
                                 <h5 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                    <Package size={14} className="text-accent" /> Materiales
                                 </h5>
                                 <div className="space-y-2">
                                    {item.materials.map((m, idx) => (
                                      <div key={idx} className="bg-white p-3 rounded border border-slate-100 flex justify-between items-center text-[11px] font-bold">
                                         {item.category === 'Personalizado' || (item.id === 'custom-1709791367000' && m.name === 'Material Nuevo') ? (
                                           <div className="flex gap-2 items-center w-full max-w-[200px]">
                                             <input 
                                                value={m.name}
                                                onChange={e => updateMaterialField(item.id, idx, 'name', e.target.value)}
                                                className="w-full text-[11px] font-bold border-b border-transparent focus:border-secondary focus:outline-none uppercase"
                                                placeholder="Material"
                                             />
                                             <input 
                                                value={m.unit}
                                                onChange={e => updateMaterialField(item.id, idx, 'unit', e.target.value)}
                                                className="w-12 text-[11px] font-bold border-b border-transparent focus:border-secondary focus:outline-none uppercase text-center"
                                                placeholder="Unid"
                                             />
                                           </div>
                                         ) : (
                                           <span className="uppercase">{m.name} ({m.unit})</span>
                                         )}
                                         <div className="flex items-center gap-2">
                                           {item.category === 'Personalizado' ? (
                                             <div className="flex items-center mr-2">
                                                <input 
                                                  type="number" 
                                                  min="0.1" 
                                                  step="0.1"
                                                  value={m.quantity}
                                                  onChange={e => updateMaterialField(item.id, idx, 'quantity', parseFloat(e.target.value))}
                                                  className="w-16 text-[11px] font-bold border-b border-slate-200 focus:border-secondary focus:outline-none text-right"
                                                />
                                                <span className="text-slate-400 ml-1">x</span>
                                             </div>
                                           ) : (
                                             <span className="text-slate-400">{m.quantity} x </span>
                                           )}
                                           <div className="relative">
                                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">Q</span>
                                              <input 
                                                type="number"
                                                step="0.01"
                                                value={m.price === 0 && m.price.toString() !== '0' ? '' : m.price}
                                                onChange={(e) => updateMaterialField(item.id, idx, 'price', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                className={cn(
                                                  "w-24 pl-5 pr-2 py-1 bg-slate-50 border rounded text-right focus:outline-none",
                                                  m.price < 0 ? "border-red-500 text-red-500 focus:border-red-500" : "border-slate-200 focus:border-secondary"
                                                )}
                                              />
                                              {m.price < 0 && (
                                                <span className="absolute -bottom-4 right-0 text-[8px] text-red-500 whitespace-nowrap font-black">Precio inválido</span>
                                              )}
                                           </div>
                                         </div>
                                      </div>
                                    ))}
                                 </div>
                              </div>
                              {/* Labor */}
                              <div className="space-y-3">
                                 <h5 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                    <HardHat size={14} className="text-secondary" /> Mano de Obra
                                 </h5>
                                 <div className="space-y-2">
                                    {item.labor.map((l, idx) => (
                                      <div key={idx} className="bg-white p-3 rounded border border-slate-100 flex justify-between items-center text-[11px] font-bold gap-2">
                                         {/* Rol — editable siempre */}
                                         <input
                                           value={l.role}
                                           onChange={e => updateLaborField(item.id, idx, 'role', e.target.value)}
                                           className="flex-1 min-w-0 text-[11px] font-bold border-b border-transparent focus:border-secondary focus:outline-none uppercase truncate"
                                           placeholder="Rol"
                                         />
                                         {/* Cuadrilla — editable en todos */}
                                         <div className="flex items-center gap-1 shrink-0">
                                           <span className="text-[8px] text-slate-400 uppercase">Obreros</span>
                                           <input
                                             type="number" min="0.1" step="0.1"
                                             value={l.quantity}
                                             onChange={e => updateLaborField(item.id, idx, 'quantity', parseFloat(e.target.value) || 0.1)}
                                             className="w-14 text-[11px] font-bold border border-slate-200 rounded px-1 py-0.5 text-center focus:outline-none focus:border-secondary"
                                           />
                                         </div>
                                         {/* Precio */}
                                         <div className="relative shrink-0">
                                           <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">Q</span>
                                           <input
                                             type="number" step="0.01"
                                             value={l.price || ''}
                                             onChange={e => updateLaborField(item.id, idx, 'price', parseFloat(e.target.value) || 0)}
                                             className="w-24 pl-5 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-right focus:outline-none focus:border-secondary text-[11px]"
                                           />
                                         </div>
                                      </div>
                                    ))}
                                 </div>
                              </div>
                           </div>

                           <div className="flex items-center gap-6 pt-4 border-t border-slate-100">
                              <div className="flex-1">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Cantidad de Obra ({item.unit})</label>
                                 <input 
                                   type="range" min="0.1" max="500" step="0.1"
                                   value={item.projectQuantity}
                                   onChange={(e) => updateQuantity(item.id, parseFloat(e.target.value))}
                                   className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-secondary"
                                 />
                              </div>
                              <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                 <button onClick={() => updateQuantity(item.id, item.projectQuantity > 1 ? item.projectQuantity - 1 : 0.1)} className="px-3 py-1.5 bg-slate-50 text-slate-500 hover:bg-slate-100 font-bold transition-colors">-</button>
                                 <input 
                                   type="number" min="0.1" step="0.1"
                                   value={item.projectQuantity || ''}
                                   onChange={(e) => updateQuantity(item.id, parseFloat(e.target.value) || 0.1)}
                                   className="w-16 px-1 py-1.5 text-xs font-black text-center text-primary border-x border-slate-200 focus:outline-none appearance-none"
                                 />
                                 <button onClick={() => updateQuantity(item.id, item.projectQuantity + 1)} className="px-3 py-1.5 bg-slate-50 text-slate-500 hover:bg-slate-100 font-bold transition-colors">+</button>
                              </div>
                           </div>

                           {/* Rendimiento y duración real */}
                           <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                              <div className="flex items-center gap-2">
                                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Rendimiento (días/{item.unit})</label>
                                 <input
                                   type="number" min="0.01" step="0.01"
                                   value={item.durationDays ?? 1}
                                   onChange={e => updateDurationDays(item.id, parseFloat(e.target.value) || 0.01)}
                                   className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-xs font-black text-center focus:outline-none focus:border-secondary"
                                 />
                              </div>
                              {(() => {
                                const workers = Math.max(1, item.labor.reduce((s, l) => s + (l.quantity || 0), 0));
                                const realDays = Math.ceil((item.projectQuantity * (item.durationDays || 1)) / workers);
                                return (
                                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                                    <TrendingUp size={12} className="text-blue-500" />
                                    <span className="text-[9px] font-black text-blue-700 uppercase">
                                      Duración real: <span className="text-blue-900">{realDays} días</span>
                                      <span className="text-blue-400 ml-2">({workers} obrero{workers !== 1 ? 's' : ''})</span>
                                    </span>
                                  </div>
                                );
                              })()}
                           </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </motion.div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
