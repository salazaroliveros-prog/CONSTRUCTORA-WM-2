/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
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
  CheckCircle2
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
import { generateBudgetPDF, generateBudgetCSV } from '../lib/reports';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { addDocument, parseError } from '../services/firestoreService';

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
    startDate: new Date().toISOString(),
    items: [],
    directCosts: 0,
    indirectCosts: 15, // Percentage
    administrativeCosts: 5,
    personalCosts: 10,
    progress: 0,
    budget: 0
  });

  const [expandedItem, setExpandedItem] = useState<string | null>(null);

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
    setCurrentProject(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setExpandedItem(customId);
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

  const calculateItemTotal = (item: ProjectItem) => {
    const matTotal = item.materials.reduce((acc, m) => acc + (Math.max(0, m.price || 0) * m.quantity), 0);
    const labTotal = item.labor.reduce((acc, l) => acc + (Math.max(0, l.price || 0) * l.quantity), 0);
    return (matTotal + labTotal) * item.projectQuantity;
  };

  const totalDirect = useMemo(() => {
    return currentProject.items.reduce((acc, item) => acc + calculateItemTotal(item), 0);
  }, [currentProject.items]);

  const totalBudget = totalDirect * (1 + (currentProject.indirectCosts + currentProject.administrativeCosts + currentProject.personalCosts) / 100);

  const [saving, setSaving] = useState(false);

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
                   <input 
                     type="text" 
                     value={currentProject.clientName}
                     onChange={(e) => setCurrentProject(p => ({ ...p, clientName: e.target.value }))}
                     className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-xs font-bold focus:outline-none focus:border-secondary"
                     placeholder="CLIENTE..."
                   />
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
              </div>
              <div className="bg-secondary text-primary p-5 rounded-xl flex flex-col justify-between shadow-xl shadow-secondary/10">
                 <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Total Presupuesto</span>
                 <h4 className="text-2xl font-black tracking-tighter">Q {totalBudget.toLocaleString()}</h4>
              </div>
           </div>
        </div>

        <div className="mt-8 flex gap-3 border-t border-slate-50 pt-6">
           <button 
            onClick={() => generateBudgetPDF(currentProject)}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:bg-primary/90"
           >
             <FileDown size={14} className="text-secondary" /> PDF PROFESIONAL
           </button>
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
                <div className="p-3 border-b border-slate-50">
                  <button 
                    onClick={addCustomItem}
                    className="w-full bg-slate-50 border border-dashed border-slate-300 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-secondary hover:border-secondary transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> CREAR RENGLÓN PERSONALIZADO
                  </button>
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
                                      <div key={idx} className="bg-white p-3 rounded border border-slate-100 flex justify-between items-center text-[11px] font-bold">
                                         {item.category === 'Personalizado' || (item.id === 'custom-1709791367000' && l.role === 'Oficial') ? (
                                           <div className="flex gap-2 items-center w-full max-w-[200px]">
                                             <input 
                                                value={l.role}
                                                onChange={e => updateLaborField(item.id, idx, 'role', e.target.value)}
                                                className="w-full text-[11px] font-bold border-b border-transparent focus:border-secondary focus:outline-none uppercase"
                                                placeholder="Rol"
                                             />
                                             <input 
                                                value={l.unit}
                                                onChange={e => updateLaborField(item.id, idx, 'unit', e.target.value)}
                                                className="w-12 text-[11px] font-bold border-b border-transparent focus:border-secondary focus:outline-none uppercase text-center"
                                                placeholder="Unid"
                                             />
                                           </div>
                                         ) : (
                                           <span className="uppercase">{l.role}</span>
                                         )}
                                         <div className="flex items-center gap-2">
                                           {item.category === 'Personalizado' ? (
                                             <div className="flex items-center mr-2">
                                                <input 
                                                  type="number" 
                                                  min="0.1" 
                                                  step="0.1"
                                                  value={l.quantity}
                                                  onChange={e => updateLaborField(item.id, idx, 'quantity', parseFloat(e.target.value))}
                                                  className="w-16 text-[11px] font-bold border-b border-slate-200 focus:border-secondary focus:outline-none text-right"
                                                />
                                                <span className="text-slate-400 ml-1">x</span>
                                             </div>
                                           ) : (
                                             <span className="text-slate-400">{l.quantity} x </span>
                                           )}
                                           <div className="relative">
                                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">Q</span>
                                              <input 
                                                type="number"
                                                step="0.01"
                                                value={l.price === 0 && l.price.toString() !== '0' ? '' : l.price}
                                                onChange={(e) => updateLaborField(item.id, idx, 'price', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                className={cn(
                                                  "w-24 pl-5 pr-2 py-1 bg-slate-50 border rounded text-right focus:outline-none",
                                                  l.price < 0 ? "border-red-500 text-red-500 focus:border-red-500" : "border-slate-200 focus:border-secondary"
                                                )}
                                              />
                                              {l.price < 0 && (
                                                <span className="absolute -bottom-4 right-0 text-[8px] text-red-500 whitespace-nowrap font-black">Precio inválido</span>
                                              )}
                                           </div>
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
                                   type="range"
                                   min="0.1"
                                   max="500"
                                   step="0.1"
                                   value={item.projectQuantity}
                                   onChange={(e) => updateQuantity(item.id, parseFloat(e.target.value))}
                                   className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-secondary"
                                 />
                              </div>
                              <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                 <button 
                                   onClick={() => updateQuantity(item.id, item.projectQuantity > 1 ? item.projectQuantity - 1 : 0.1)}
                                   className="px-3 py-1.5 bg-slate-50 text-slate-500 hover:bg-slate-100 font-bold transition-colors"
                                 >-</button>
                                 <input 
                                   type="number" 
                                   min="0.1"
                                   step="0.1"
                                   value={item.projectQuantity === 0 && item.projectQuantity.toString() !== '0' ? '' : item.projectQuantity}
                                   onChange={(e) => updateQuantity(item.id, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                   className="w-16 px-1 py-1.5 text-xs font-black text-center text-primary border-x border-slate-200 focus:outline-none appearance-none"
                                 />
                                 <button 
                                   onClick={() => updateQuantity(item.id, item.projectQuantity + 1)}
                                   className="px-3 py-1.5 bg-slate-50 text-slate-500 hover:bg-slate-100 font-bold transition-colors"
                                 >+</button>
                              </div>
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
