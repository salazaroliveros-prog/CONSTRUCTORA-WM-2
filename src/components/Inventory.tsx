/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  Search,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  MapPin,
  History,
  ShieldCheck,
  Wrench,
  Layers,
  ChevronRight,
  Info,
  DollarSign,
  Trash2,
  ArrowUpRight,
  ShoppingCart,
  ClipboardList,
  CheckCircle2,
  Building2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WarehouseItem, PurchaseOrder, PurchaseOrderItem } from '../constants';
import { cn } from '../utils/cn';
import { addDocument, updateDocument, deleteDocument, parseError } from '../services/firestoreService';
import { useStore } from '../store/DataStore';
import { uploadFile } from '../services/storageService';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import { toast } from 'sonner';
import { Modal } from './ui/Modal';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { sanitizeString, sanitizeNIT, sanitizePhone } from '../utils/sanitize';
import { trackCRUD, trackEvent } from '../utils/logger';

export default function InventoryModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [filterProject, setFilterProject] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const store = useStore();
  const items = store.inventory.items as WarehouseItem[];
  const loading = store.inventory.isLoading;
  const [newItem, setNewItem] = useState<{name: string, cat: 'Materiales' | 'Herramientas' | 'EPP', stock: number, minStock: number, unit: string, location: string, iconUrl: string, expiryDate: string}>({ name: '', cat: 'Materiales', stock: 0, minStock: 5, unit: 'U', location: 'Almacén Central', iconUrl: '', expiryDate: '' });
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState<{id:string, field:string, value:string} | null>(null);

  // Bulk select
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllItems = () => {
    if (selectedItemIds.size === paginatedItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(paginatedItems.map(i => i.id)));
    }
  };

  const handleBulkDeleteItems = () => {
    if (selectedItemIds.size === 0) return;
    toast('¿Eliminar items seleccionados?', {
      description: `${selectedItemIds.size} item(s) serán eliminados.`,
      action: { label: 'Eliminar Todo', onClick: async () => {
        try {
          for (const id of selectedItemIds) await deleteDocument('inventory', id);
          toast.success(`${selectedItemIds.size} item(s) eliminados`);
          setSelectedItemIds(new Set());
        } catch (e: any) { toast.error('Error', { description: parseError(e) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOrders = () => {
    if (selectedOrderIds.size === purchaseOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(purchaseOrders.map(o => o.id)));
    }
  };

  const handleBulkDeleteOrders = () => {
    if (selectedOrderIds.size === 0) return;
    toast('¿Eliminar órdenes seleccionadas?', {
      description: `${selectedOrderIds.size} orden(es) serán eliminadas.`,
      action: { label: 'Eliminar Todo', onClick: async () => {
        try {
          for (const id of selectedOrderIds) await deleteDocument('purchaseOrders', id);
          toast.success(`${selectedOrderIds.size} orden(es) eliminadas`);
          setSelectedOrderIds(new Set());
        } catch (e: any) { toast.error('Error', { description: parseError(e) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleDeleteOrder = (orderId: string) => {
    toast('¿Eliminar orden de compra?', {
      description: 'Esta acción no se puede deshacer.',
      action: { label: 'Eliminar', onClick: async () => {
        try {
          await deleteDocument('purchaseOrders', orderId);
          toast.success('Orden eliminada');
        } catch (e: any) { toast.error('Error', { description: parseError(e) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  // Project stock & purchase orders
  const projects = store.projects.items as any[];
  const suppliers = store.suppliers.items as any[];
  const purchaseOrders = store.purchaseOrders.items as PurchaseOrder[];
  const [activeTab, setActiveTab] = useState<'stock' | 'orders'>('stock');
  const [isOCModalOpen, setIsOCModalOpen] = useState(false);
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [selectedProjectForGen, setSelectedProjectForGen] = useState('');
  const [generatingStock, setGeneratingStock] = useState(false);
  const [forcePerRenglon, setForcePerRenglon] = useState(false);
  const [ocForm, setOcForm] = useState<{ projectId: string; selectedItemId: string; supplierId: string; notes: string; items: PurchaseOrderItem[] }>({
    projectId: '', selectedItemId: '', supplierId: '', notes: '', items: []
  });



  const generateStockFromProject = async (forcePerRenglonMode?: boolean) => {
    const project = projects.find(p => p.id === selectedProjectForGen);
    if (!project) return;
    setGeneratingStock(true);
    try {
      // Check if old aggregated records exist for this project (backward compat)
      const hasOldRecords = items.some(i => i.projectId === project.id && !i.itemId);
      if (hasOldRecords && !forcePerRenglonMode && !forcePerRenglon) {
        toast.info('Ya existen registros agregados. Marca "Forzar por renglón" para reemplazarlos.');
        setGeneratingStock(false);
        return;
      }
      // If forcing per-renglón, remove old aggregated records first
      if (forcePerRenglonMode || forcePerRenglon) {
        const oldRecords = items.filter(i => i.projectId === project.id && !i.itemId);
        for (const rec of oldRecords) {
          await deleteDocument('inventory', rec.id);
        }
      }
      let created = 0;
      for (const item of (project.items || [])) {
        if (!item.id || !item.description) continue;
        for (const m of (item.materials || [])) {
          const qty = (m.quantity || 0) * (item.projectQuantity || 1);
          const exists = items.find(i => i.name === m.name && i.projectId === project.id && i.itemId === item.id);
          if (exists) continue;
          await addDocument('inventory', {
            name: m.name,
            cat: 'Materiales' as const,
            stock: 0,
            unit: m.unit || 'U',
            location: 'Almacén Central',
            minStock: Math.ceil(qty * 0.1),
            lastEntry: new Date().toISOString().split('T')[0],
            history: [],
            projectId: project.id,
            projectName: project.name,
            itemId: item.id,
            itemName: item.description,
            budgetedQty: qty,
            budgetedCost: m.price || 0,
            usedQty: 0,
          });
          created++;
        }
      }
      toast.success(`${created} materiales generados desde presupuesto`, { description: project.name });
      setIsGenModalOpen(false);
      setSelectedProjectForGen('');
      setForcePerRenglon(false);
    } catch (e) {
      toast.error('Error al generar stock', { description: parseError(e) });
    } finally {
      setGeneratingStock(false);
    }
  };

const createPurchaseOrder = async () => {
     const project = projects.find(p => p.id === ocForm.projectId);
     const supplier = suppliers.find(s => s.id === ocForm.supplierId);
     if (!project || !supplier || ocForm.items.length === 0) {
       toast.error('Completa todos los campos y agrega al menos un material');
       return;
     }
     try {
       const total = ocForm.items.reduce((a, i) => a + i.total, 0);
       await addDocument('purchaseOrders', {
         projectId: project.id,
         projectName: sanitizeString(project.name),
         supplierId: supplier.id,
         supplierName: sanitizeString(supplier.name),
         status: 'PENDIENTE',
         items: ocForm.items,
         total,
         createdAt: new Date().toISOString().split('T')[0],
         notes: sanitizeString(ocForm.notes),
       });
       toast.success('Orden de compra creada');
       setIsOCModalOpen(false);
       setOcForm({ projectId: '', selectedItemId: '', supplierId: '', notes: '', items: [] });
       trackCRUD('create', 'purchase-order');
     } catch (e) {
       toast.error('Error al crear OC', { description: parseError(e) });
     }
   };

  const receiveOrder = async (order: PurchaseOrder) => {
    try {
      for (const oi of order.items) {
        const inv = items.find(i =>
          i.name === oi.materialName &&
          i.projectId === order.projectId &&
          (!oi.itemId || i.itemId === oi.itemId)
        );
        if (inv) {
          await updateDocument('inventory', inv.id, {
            stock: (inv.stock || 0) + oi.qty,
            lastEntry: new Date().toISOString().split('T')[0],
          });
        }
      }
      await updateDocument('purchaseOrders', order.id, { status: 'RECIBIDA' });
      toast.success('Orden recibida — stock actualizado');
    } catch (e) {
      toast.error('Error', { description: parseError(e) });
    }
  };

  const consumeMaterial = async (item: WarehouseItem, qty: number) => {
    if (qty <= 0 || qty > item.stock) { toast.error('Cantidad inválida'); return; }
    try {
      await updateDocument('inventory', item.id, {
        stock: item.stock - qty,
        usedQty: (item.usedQty || 0) + qty,
        lastEntry: new Date().toISOString().split('T')[0],
      });
      toast.success(`${qty} ${item.unit} descontados de ${item.name}`);
    } catch (e) {
      toast.error('Error', { description: parseError(e) });
    }
  };

  const saveInlineEdit = async () => {
    if (!editingCell) return;
    const { id, field, value } = editingCell;
    try {
      await updateDocument('inventory', id, { [field]: field === 'stock' || field === 'minStock' ? parseFloat(value) || 0 : value });
      toast.success('Actualizado');
    } catch (e) {
      toast.error('Error al guardar', { description: parseError(e) });
    }
    setEditingCell(null);
  };



  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toast("¿Confirmar eliminación?", {
      description: "Esta acción no se puede deshacer.",
      action: {
        label: "Eliminar",
        onClick: async () => {
          try {
            await deleteDocument('inventory', id);
            toast.success("Ítem eliminado");
          } catch (error) {
            console.error(error);
            toast.error("Error al eliminar", { description: parseError(error) });
          }
        }
      },
      cancel: { label: "Cancelar", onClick: () => {} }
    });
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name) return;
    setSaving(true);
    try {
      let iconUrl = '';
      if (iconFile) {
        iconUrl = await uploadFile(iconFile, `inventory/${Date.now()}_${iconFile.name}`);
      }
      await addDocument('inventory', { ...newItem, iconUrl, lastEntry: new Date().toISOString().split('T')[0] });
      setIsCreateModalOpen(false);
      setNewItem({ name: '', cat: 'Materiales', stock: 0, minStock: 5, unit: 'U', location: 'Almacén Central', iconUrl: '', expiryDate: '' });
      setIconFile(null);
      toast.success("Material registrado");
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar", { description: parseError(e) });
    } finally {
      setSaving(false);
    }
  };

  const zones = [
    { id: 'Almacén Central', name: 'Almacén Central', short: 'AC', desc: 'Depósito Principal', color: 'bg-primary' },
    { id: 'Zona de Obra A', name: 'Zona de Obra A', short: 'ZA', desc: 'Maquinaria y Equipos', color: 'bg-secondary' },
    { id: 'Zona de Obra B', name: 'Zona de Obra B', short: 'ZB', desc: 'Materiales Pesados', color: 'bg-slate-400' },
    { id: 'Bodega Acabados', name: 'Bodega Acabados', short: 'BA', desc: 'Material Delicado', color: 'bg-[var(--color-info)]' },
  ];

  const [movementForm, setMovementForm] = useState({
    itemId: '',
    type: 'Entrada' as 'Entrada' | 'Salida',
    quantity: 0,
    cost: 0,
    description: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    projectId: ''
  });

  const entryCategories = ['Aporte Cliente', 'Anteproyecto', 'Estudios', 'Agrimensura', 'Cuantificación', 'Otros'];
  const exitCategories = ['Materiales', 'Mano de Obra', 'Herramienta y Equipo', 'Sub-contratos', 'Administrativo', 'Personales', 'Hogar'];

  const openMovementModal = (id: string = '', type: 'Entrada' | 'Salida' = 'Entrada') => {
    setMovementForm({
      itemId: id,
      type: type,
      quantity: 0,
      cost: 0,
      description: '',
      category: type === 'Entrada' ? entryCategories[0] : exitCategories[0],
      date: new Date().toISOString().split('T')[0],
      projectId: ''
    });
    setIsModalOpen(true);
  };

  const categories = ['Todos', 'Materiales', 'Herramientas', 'EPP'];

  // Filter out inventory from deleted/non-existent projects (same pattern as Dashboard)
  const existingProjectIds = useMemo(() => new Set((projects as any[]).filter((p: any) => p.id).map((p: any) => p.id)), [projects]);
  const validItems = useMemo(() =>
    items.filter(i => !i.projectId || existingProjectIds.has(i.projectId)),
  [items, existingProjectIds]);

  const filteredItems = validItems.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat    = activeCategory === 'Todos' || item.cat === activeCategory;
    const matchesZone   = !selectedZone || item.location?.includes(selectedZone);
    const matchesProj   = filterProject === 'ALL' || item.projectId === filterProject || (!item.projectId && filterProject === 'GENERAL');
    return matchesSearch && matchesCat && matchesZone && matchesProj;
  });

  // KPI: valor real = stock × budgetedCost (costo unitario del presupuesto)
  const totalRealValue = validItems.reduce((acc, i) => acc + (i.stock || 0) * (i.budgetedCost || 0), 0);
  const criticalItems  = validItems.filter(i => (i.stock || 0) <= (i.minStock || 0));
  // Días restantes por item según tasa de consumo
  const withDaysLeft = (item: WarehouseItem): number | null => {
    const days = item.lastEntry ? Math.max(1, Math.floor((Date.now() - new Date(item.lastEntry).getTime()) / 86_400_000)) : 30;
    const rate = (item.usedQty || 0) / days;
    return rate > 0 ? Math.floor((item.stock || 0) / rate) : null;
  };

  const { 
    currentItems: paginatedItems, 
    currentPage, 
    totalPages, 
    nextPage, 
    prevPage, 
    goToPage,
    startIndex,
    totalItems: totalItemsCount
  } = usePagination<WarehouseItem>(filteredItems, 12);

  const getCatIcon = (cat: string) => {
    switch(cat) {
      case 'Materiales': return <Layers size={14} />;
      case 'Herramientas': return <Wrench size={14} />;
      case 'EPP': return <ShieldCheck size={14} />;
      default: return <Package size={14} />;
    }
  };

  const handleMovement = async () => {
    // If an item is selected, update its stock
    if (movementForm.itemId) {
      const item = items.find(i => i.id === movementForm.itemId);
      if (!item) return;

      const newStock = movementForm.type === 'Entrada' 
        ? item.stock + movementForm.quantity 
        : item.stock - movementForm.quantity;

      if (newStock < 0) {
        toast.error('No se puede tener stock negativo');
        return;
      }

      await updateDocument('inventory', item.id, {
        stock: newStock,
        lastEntry: movementForm.date
      });
    }

    // Always register the transaction
    try {
      await addDocument('transactions', {
        description: movementForm.description || (movementForm.itemId ? `Movimiento: ${items.find(i => i.id === movementForm.itemId)?.name}` : 'Movimiento Manual'),
        amount: movementForm.cost * movementForm.quantity,
        qty: movementForm.quantity,
        unitCost: movementForm.cost,
        type: movementForm.type === 'Entrada' ? 'INGRESO' : 'GASTO',
        category: movementForm.category,
        date: movementForm.date,
        createdAt: new Date().toISOString(),
        itemId: movementForm.itemId || null,
        projectId: movementForm.projectId || null
      });
      setIsModalOpen(false);
      toast.success("Movimiento registrado", { description: "Su inventario se ha actualizado." });
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar el movimiento", { description: parseError(e) });
    }
  };

  const totalValue = items.reduce((acc, item) => acc + (item.stock || 0), 0);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div id="warehouse-management" className="space-y-6 animate-in fade-in duration-500 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] scroll-mb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 text-left">
          <div className="p-2 bg-slate-900 text-secondary rounded-lg shrink-0">
            <Package size={16} />
          </div>
          <div className="min-w-0">
            <p className="label truncate">Total Items</p>
            <h3 className="text-sm md:text-xl font-black text-primary truncate">{items.length}</h3>
            <p className="text-[7px] text-slate-400 font-bold">{filteredItems.length} filtrados</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 text-left">
          <div className={cn('p-2 rounded-lg shrink-0', criticalItems.length > 0 ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]' : 'bg-[var(--color-success-bg)] text-[var(--color-success)]')}>
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0">
            <p className="label truncate">Stock Crítico</p>
            <h3 className={cn('text-sm md:text-xl font-black truncate', criticalItems.length > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]')}>{criticalItems.length}</h3>
            <p className="text-[7px] text-slate-400 font-bold">de {items.length} items</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 text-left">
          <div className="p-2 bg-[var(--color-success-bg)] text-[var(--color-success)] rounded-lg shrink-0">
            <DollarSign size={16} />
          </div>
          <div className="min-w-0">
            <p className="label truncate">Valor Real Stock</p>
            <h3 className="text-sm md:text-xl font-black text-primary truncate">Q {Math.round(totalRealValue).toLocaleString('es-GT')}</h3>
            <p className="text-[7px] text-slate-400 font-bold">stock × costo presupuestado</p>
          </div>
        </div>
        <div className="col-span-2 md:col-span-1 grid grid-cols-2 gap-2">
          <button 
            onClick={() => openMovementModal()}
            className="w-full h-full bg-slate-900 text-white p-3 rounded-xl text-[9px] font-black tracking-widest uppercase flex flex-col items-center justify-center gap-1 hover:bg-slate-800 transition-all shadow-lg"
          >
            <ArrowUpRight size={14} className="text-secondary" /> MOVIMIENTO
          </button>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full h-full bg-secondary text-primary p-3 rounded-xl text-[9px] font-black tracking-widest uppercase flex flex-col items-center justify-center gap-1 hover:bg-secondary/90 transition-all shadow-lg"
          >
            <Plus size={14} /> REGISTRAR
          </button>
        </div>
      </div>

      {/* Tabs: Stock / Ordenes de Compra */}
      <div className="flex flex-wrap gap-2 items-center overflow-x-auto">
        {[{ id: 'stock', label: 'Stock / Bodega', icon: <Package size={13}/> }, { id: 'orders', label: 'Ordenes de Compra', icon: <ShoppingCart size={13}/> }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all',
              activeTab === t.id ? 'bg-slate-900 text-white shadow' : 'bg-white border border-slate-200 text-slate-500 hover:border-secondary')}>
            {t.icon}{t.label}
          </button>
        ))}
        {/* Filtro por proyecto mejorado */}
        <div className="flex flex-col gap-1">
          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Proyecto</span>
           <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
             title="Filtrar por proyecto"
             className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase focus:outline-none focus:border-secondary min-w-40">
            <option value="ALL">Todos los proyectos ({validItems.length})</option>
            <option value="GENERAL">Sin proyecto ({validItems.filter(i => !i.projectId).length})</option>
            {projects.filter(p => p.status === 'EJECUCION').map((p: any) => {
              const projectItems = validItems.filter(i => i.projectId === p.id);
              return (
                <option key={p.id} value={p.id}>{p.name} ({projectItems.length})</option>
              );
            })}
          </select>
        </div>
        <button onClick={() => setIsGenModalOpen(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[var(--color-success)] text-white hover:bg-[var(--color-success)] transition-all shadow">
          <Building2 size={13}/> Generar desde Presupuesto
        </button>
        {activeTab === 'orders' && (
          <>
            <button type="button" title="Selección múltiple" onClick={() => { setBulkMode(!bulkMode); if (bulkMode) setSelectedOrderIds(new Set()); }}
              className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${bulkMode ? 'bg-[var(--color-error)] text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
              {bulkMode ? 'Cancelar' : 'Seleccionar'}
            </button>
            <button onClick={() => setIsOCModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[var(--color-info)] text-white hover:bg-[var(--color-info)] transition-all shadow">
              <Plus size={13}/> Nueva OC
            </button>
          </>
        )}
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Registrar Nuevo Suministro"
      >
        <form onSubmit={handleCreateItem} className="space-y-4 text-left">
          <Input label="Nombre del Material / Equipo" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="EJ: CEMENTO UGC" />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="label">Categoría</label>
              <select value={newItem.cat} onChange={e => setNewItem({...newItem, cat: e.target.value as 'Materiales' | 'Herramientas' | 'EPP'})} title="Seleccionar categoría" className="select">
                {categories.filter(c => c !== 'Todos').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Unidad de Medida</label>
              <input type="text" placeholder="EJ: SACO, GL, UD" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} className="input" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="label">Ícono Personalizado</label>
            <input type="file" accept="image/*" title="Seleccionar icono" onChange={e => setIconFile(e.target.files?.[0] || null)} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Stock Inicial" type="number" value={newItem.stock} onChange={e => setNewItem({...newItem, stock: parseFloat(e.target.value)})} placeholder="0" />
            <Input label="Stock Mínimo" type="number" value={newItem.minStock} onChange={e => setNewItem({...newItem, minStock: parseFloat(e.target.value)})} placeholder="0" />
          </div>
          <div className="space-y-1">
            <label className="label">Fecha de Vencimiento</label>
            <input type="date" value={newItem.expiryDate} min={new Date().toISOString().split('T')[0]} title="Fecha de vencimiento" onChange={e => setNewItem({...newItem, expiryDate: e.target.value})} className="input" />
          </div>
          <div className="space-y-1">
            <label className="label">Ubicación Física</label>
            <select value={newItem.location} title="Seleccionar ubicación" onChange={e => setNewItem({...newItem, location: e.target.value})} className="select">
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <Button type="submit" isLoading={saving} className="w-full">
            REGISTRAR EN SISTEMA
          </Button>
        </form>
      </Modal>

      {/* Interactive Warehouse Map - Only Desktop for clarity */}
      <div className="hidden lg:block bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4 text-left">
          <div>
            <h3 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
              <MapPin size={16} className="text-secondary" /> Mapa de Almacén
            </h3>
          </div>
          {selectedZone && (
            <button 
              onClick={() => setSelectedZone(null)}
              className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] border-b border-secondary pb-1 hover:opacity-70 transition-all"
            >
              LIMPIAR ZONA
            </button>
          )}
        </div>

        <div className="grid grid-cols-12 gap-6 items-center">
          <div className="col-span-7 bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-center min-h-[200px]">
            <div className="relative w-full max-w-[400px] aspect-[16/9] grid grid-cols-4 grid-rows-2 gap-2">
              {zones.map((zone, idx) => (
                <motion.div 
                  key={zone.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelectedZone(zone.id)}
                  className={cn(
                    "rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-all border-2",
                    idx === 0 ? "col-span-2 row-span-2" : idx === 1 ? "col-span-2" : "",
                    selectedZone === zone.id 
                      ? "bg-slate-900 text-white border-slate-900 shadow-xl" 
                      : "bg-white border-slate-100 shadow-sm text-slate-400 hover:border-secondary"
                  )}
                >
                  <MapPin size={18} className={selectedZone === zone.id ? "text-secondary" : "text-slate-200"} />
                  <span className="text-[9px] font-black uppercase tracking-tight">{zone.short}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="col-span-5 grid grid-cols-1 gap-2">
             {zones.map((zone) => {
               const isActive = selectedZone === zone.id;
               const count = items.filter(i => i.location?.includes(zone.id)).length;
               return (
                 <div 
                   key={zone.id}
                   onClick={() => setSelectedZone(isActive ? null : zone.id)}
                   className={cn(
                     "p-2 rounded-xl border transition-all cursor-pointer group flex items-center justify-between",
                     isActive ? "bg-slate-900 border-slate-900" : "bg-white border-slate-100 hover:bg-slate-50"
                   )}
                 >
                   <div className="flex items-center gap-3">
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-[9px]", zone.color)}>
                        {zone.short}
                      </div>
                      <div className="text-left">
                        <p className={cn("text-[9px] font-black uppercase leading-tight", isActive ? "text-white" : "text-primary")}>{zone.name}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className={cn("text-xs font-black", isActive ? "text-secondary" : "text-primary")}>{count}</p>
                   </div>
                 </div>
               );
             })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-p-400" />
            <input
              type="text"
              placeholder="BUSCAR SUMINISTRO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 text-xs font-bold uppercase tracking-widest"
            />
          </div>
          <Button variant={bulkMode ? "danger" : "ghost"} size="sm" onClick={() => { setBulkMode(!bulkMode); if (bulkMode) setSelectedItemIds(new Set()); }}>
            {bulkMode ? 'Cancelar' : 'Seleccionar'}
          </Button>
          <div className="flex gap-1.5 w-full md:w-auto overflow-x-auto no-scrollbar scroll-smooth">
            {categories.map((cat) => (
              <button 
                key={cat} 
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  activeCategory === cat ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 shadow-sm"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-left text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                {bulkMode && (
                  <th className="px-2 py-3 w-8">
                    <input type="checkbox" checked={paginatedItems.length > 0 && selectedItemIds.size === paginatedItems.length}
                      onChange={toggleSelectAllItems} className="w-4 h-4 accent-[var(--color-error)] cursor-pointer" />
                  </th>
                )}
                <th className="px-4 py-3">Suministro</th>
                <th className="hidden md:table-cell px-4 py-3">Categoría</th>
                <th className="hidden lg:table-cell px-4 py-3">Renglón</th>
                <th className="px-4 py-3">Stock</th>
                <th className="hidden lg:table-cell px-4 py-3">Ubicación</th>
                <th className="px-4 py-3 text-right">#</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedItems.map((item, i) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    className={cn(
                      "hover:bg-slate-50/50 transition-all cursor-pointer group",
                      selectedItem === item.id || selectedItemIds.has(item.id) ? "bg-slate-50/80" : ""
                    )}
                    onClick={() => { if (bulkMode) { toggleSelectItem(item.id); } else { setSelectedItem(selectedItem === item.id ? null : item.id); } }}
                  >
                    {bulkMode && (
                      <td className="px-2 py-2.5 w-8" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedItemIds.has(item.id)} onChange={() => toggleSelectItem(item.id)}
                          className="w-4 h-4 accent-[var(--color-error)] cursor-pointer" />
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                       {item.iconUrl ? (
                          <img src={item.iconUrl} alt={item.name} className="w-8 h-8 rounded-lg object-cover" />
                       ) : (
                          <div className={cn(
                            "p-1.5 rounded-lg shrink-0",
                            item.stock < item.minStock ? "bg-red-50 text-[var(--color-error)]" : "bg-slate-100 text-slate-400"
                          )}>
                            {getCatIcon(item.cat)}
                          </div>
                      )}
                      <div className="min-w-0 text-left">
                        {editingCell?.id === item.id && editingCell.field === 'name' ? (
              <input
                autoFocus
                title="Nombre del suministro"
                value={editingCell.value}
                onChange={e => setEditingCell({...editingCell, value: e.target.value})}
                onBlur={saveInlineEdit}
                onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                className="text-[11px] font-black uppercase w-full border-b-2 border-secondary bg-transparent focus:outline-none"
                onClick={e => e.stopPropagation()}
              />
                        ) : (
                          <p
                            className="text-[11px] font-black text-primary uppercase truncate group-hover:text-secondary transition-colors cursor-text"
                            onDoubleClick={e => { e.stopPropagation(); setEditingCell({id: item.id, field: 'name', value: item.name}); }}
                            title="Doble click para editar"
                          >{item.name}</p>
                        )}
                        <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest truncate">{item.id.slice(-4)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-4 py-2.5">
                    <span className="label">{item.cat}</span>
                  </td>
                  <td className="hidden lg:table-cell px-4 py-2.5">
                    <span className="text-[8px] font-bold text-slate-500 truncate max-w-[120px] block">{item.itemName || '—'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col text-left">
                      {editingCell?.id === item.id && editingCell.field === 'stock' ? (
                        <input
                          autoFocus type="number"
                          title="Stock"
                          value={editingCell.value}
                          onChange={e => setEditingCell({...editingCell, value: e.target.value})}
                          onBlur={saveInlineEdit}
                          onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                          className="text-[11px] font-black w-16 border-b-2 border-secondary bg-transparent focus:outline-none"
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={cn("text-[11px] font-black tabular-nums cursor-text", item.stock < item.minStock ? "text-[var(--color-error)]" : "text-primary")}
                          onDoubleClick={e => { e.stopPropagation(); setEditingCell({id: item.id, field: 'stock', value: String(item.stock)}); }}
                          title="Doble click para editar"
                        >{item.stock} {item.unit}</span>
                      )}
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-4 py-2.5">
                    {editingCell?.id === item.id && editingCell.field === 'location' ? (
                      <input
                        autoFocus
                        value={editingCell.value}
                        onChange={e => setEditingCell({...editingCell, value: e.target.value})}
                        onBlur={saveInlineEdit}
                        onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                        className="text-[8px] font-bold uppercase w-full border-b-2 border-secondary bg-transparent focus:outline-none"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="text-[8px] font-bold uppercase text-slate-500 truncate max-w-[100px] cursor-text"
                        onDoubleClick={e => { e.stopPropagation(); setEditingCell({id: item.id, field: 'location', value: item.location || ''}); }}
                        title="Doble click para editar"
                      >{item.location}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        title="Eliminar suministro"
                        onClick={(e) => handleDelete(e, item.id)}
                        className="btn-delete hover:bg-[var(--color-error-bg)] rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button title="Ver detalles" className="p-2 text-slate-400 hover:text-secondary transition-all">
                        <ChevronRight size={16} className={cn("transition-transform duration-300", selectedItem === item.id ? "rotate-90" : "")} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center opacity-30">
                    <Package size={48} className="mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-[0.2em]">Almacén Vacío</p>
                    <button 
                      onClick={() => openMovementModal()}
                      className="mt-4 text-[9px] font-black text-secondary border-b border-secondary pb-0.5 uppercase tracking-widest"
                    >
                      Añade el primer ítem
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-2 mt-2">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onNext={nextPage}
            onPrev={prevPage}
            onPage={goToPage}
            totalItems={totalItemsCount}
            startIndex={startIndex}
            itemsPerPage={12}
            compact={true}
          />
        </div>
      </div>

      {/* Panel lateral de información de proyecto */}
      {filterProject !== 'ALL' && filterProject !== 'GENERAL' && (() => {
        const selectedProject = projects.find(p => p.id === filterProject);
        const projectItems = items.filter(i => i.projectId === filterProject);
        const totalBudgetedValue = projectItems.reduce((acc, i) => acc + (i.budgetedQty || 0) * (i.budgetedCost || 0), 0);
        const totalCurrentValue = projectItems.reduce((acc, i) => acc + (i.stock || 0) * (i.budgetedCost || 0), 0);
        const criticalProjectItems = projectItems.filter(i => (i.stock || 0) <= (i.minStock || 0));
        const completionRate = totalBudgetedValue > 0 ? (totalCurrentValue / totalBudgetedValue) * 100 : 0;
        
        if (!selectedProject) return null;
        
        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-secondary flex items-center justify-center">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-primary uppercase tracking-tight">{selectedProject.name}</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Inventario del Proyecto</p>
                </div>
              </div>
              <button 
                onClick={() => setFilterProject('ALL')}
                className="text-[8px] font-black text-slate-400 hover:text-secondary uppercase tracking-widest border-b border-slate-200 hover:border-secondary pb-0.5 transition-all"
              >
                Ver Todos
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Items Proyecto</p>
                <p className="text-lg font-black text-primary">{projectItems.length}</p>
                <p className="text-[6px] font-bold text-slate-400 uppercase">materiales</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Crítico</p>
                <p className={cn('text-lg font-black', criticalProjectItems.length > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]')}>
                  {criticalProjectItems.length}
                </p>
                <p className="text-[6px] font-bold text-slate-400 uppercase">items bajo mínimo</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Presupuestado</p>
                <p className="text-lg font-black text-primary">Q {Math.round(totalBudgetedValue/1000)}k</p>
                <p className="text-[6px] font-bold text-slate-400 uppercase">total planificado</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Completitud Stock</p>
                <p className={cn('text-lg font-black', completionRate >= 80 ? 'text-[var(--color-success)]' : completionRate >= 50 ? 'text-[var(--color-warning)]' : 'text-[var(--color-error)]')}>
                  {Math.round(completionRate)}%
                </p>
                <p className="text-[6px] font-bold text-slate-400 uppercase">stock vs presupuesto</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="label">Progreso del Proyecto</span>
                <span className="text-[9px] font-black text-secondary">{selectedProject.progress || 0}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-secondary rounded-full transition-all duration-500 progress-fill-dynamic" 
                  style={{ '--w': `${selectedProject.progress || 0}%` } as React.CSSProperties}
                />
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <span className="label">Completitud de Stock</span>
                <span className={cn('text-[9px] font-black', completionRate >= 80 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]')}>
                  {Math.round(completionRate)}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={cn('h-full rounded-full transition-all duration-500 progress-fill-dynamic', 
                    completionRate >= 80 ? 'bg-[var(--color-success)]' : completionRate >= 50 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-error)]'
                  )} 
                  style={{ '--w': `${completionRate}%` } as React.CSSProperties}
                />
              </div>
            </div>
            
            {criticalProjectItems.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-[var(--color-red-border)] rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={12} className="text-[var(--color-error)]" />
                  <span className="text-[8px] font-black text-[var(--color-error)] uppercase tracking-widest">Materiales Críticos</span>
                </div>
                <div className="space-y-1">
                  {criticalProjectItems.slice(0, 3).map(item => (
                    <div key={item.id} className="flex justify-between items-center text-[8px]">
                      <span className="font-bold text-[var(--color-error)] uppercase truncate max-w-[60%]">{item.name}</span>
                      <span className="font-black text-[var(--color-error)]">{item.stock}/{item.minStock} {item.unit}</span>
                    </div>
                  ))}
                  {criticalProjectItems.length > 3 && (
                    <p className="text-[7px] font-bold text-[var(--color-error)] uppercase text-center pt-1">
                      +{criticalProjectItems.length - 3} más
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <div className="mt-4 flex gap-2">
              <button 
                onClick={() => {
                  setSelectedProjectForGen(filterProject);
                  setIsGenModalOpen(true);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--color-success)] text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-[var(--color-success)] transition-all"
              >
                <Building2 size={11}/> Generar Faltantes
              </button>
              <button 
                onClick={() => {
                  setOcForm(prev => ({ ...prev, projectId: filterProject }));
                  setIsOCModalOpen(true);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--color-info)] text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-[var(--color-info)] transition-all"
              >
                <ShoppingCart size={11}/> Nueva OC
              </button>
            </div>
          </div>
        );
      })()}

      {/* Movement Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-modal overflow-hidden border border-p-200"
            >
              <div className="bg-brand px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Movimiento</h3>
                  <p className="text-[8px] font-bold text-p-400 uppercase mt-0.5">Gestión de Stock Real</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg text-white" aria-label="Cerrar"><X size={16} /></button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="label">Tipo</label>
                    <div className="flex bg-slate-50 p-0.5 rounded-lg border border-p-200">
                      <button type="button"
                        onClick={() => setMovementForm({ ...movementForm, type: 'Entrada', category: entryCategories[0] })}
                        className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", movementForm.type === 'Entrada' ? "bg-white text-green-600 shadow-sm" : "text-p-400")}>
                        Entrada
                      </button>
                      <button type="button"
                        onClick={() => setMovementForm({ ...movementForm, type: 'Salida', category: exitCategories[0] })}
                        className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", movementForm.type === 'Salida' ? "bg-white text-red-600 shadow-sm" : "text-p-400")}>
                        Salida
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="label">Fecha</label>
                    <input type="date" value={movementForm.date} title="Fecha del movimiento" onChange={(e) => setMovementForm({ ...movementForm, date: e.target.value })} className="input" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="label">Producto (Opcional)</label>
                  <select value={movementForm.itemId} title="Seleccionar producto" onChange={(e) => setMovementForm({ ...movementForm, itemId: e.target.value })} className="select">
                    <option value="">Seleccione suministro...</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.stock})</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="label">Proyecto (Opcional)</label>
                  <select value={movementForm.projectId} title="Asignar a proyecto" onChange={(e) => setMovementForm({ ...movementForm, projectId: e.target.value })} className="select">
                    <option value="">Sin proyecto</option>
                    {projects.filter((p: any) => p.status === 'EJECUCION').map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="label">Categoría</label>
                  <select value={movementForm.category} title="Seleccionar categoría" onChange={(e) => setMovementForm({ ...movementForm, category: e.target.value })} className="select">
                    {(movementForm.type === 'Entrada' ? entryCategories : exitCategories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="label">Cantidad</label>
                    <input type="number" step="0.01" value={movementForm.quantity || ''} onChange={(e) => setMovementForm({ ...movementForm, quantity: parseFloat(e.target.value) || 0 })} className="input" placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Costo / Precio (Q)</label>
                    <input type="number" step="0.01" value={movementForm.cost || ''} onChange={(e) => setMovementForm({ ...movementForm, cost: parseFloat(e.target.value) || 0 })} className="input" placeholder="0.00" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="label">Descripción</label>
                  <textarea value={movementForm.description} onChange={(e) => setMovementForm({ ...movementForm, description: e.target.value })} placeholder="Detalles del movimiento..." className="textarea min-h-[60px]" />
                </div>

                <Button type="button" onClick={handleMovement} disabled={!movementForm.category || movementForm.quantity <= 0} className="w-full">
                  Confirmar Registro
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -- Purchase Orders View ------------------------------- */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {purchaseOrders.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center">
              <ShoppingCart size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin ordenes de compra</p>
              <p className="text-[9px] text-slate-300 mt-1">Crea una nueva OC para solicitar materiales a proveedores</p>
            </div>
          ) : (
            <>
              {bulkMode && purchaseOrders.length > 0 && (
                <div className="flex items-center gap-2 px-1 py-1">
                  <input type="checkbox" checked={selectedOrderIds.size === purchaseOrders.length && purchaseOrders.length > 0}
                    onChange={toggleSelectAllOrders} className="w-4 h-4 accent-[var(--color-error)] cursor-pointer" />
                  <span className="label">
                    {selectedOrderIds.size > 0 ? `${selectedOrderIds.size} seleccionado(s)` : 'Seleccionar todo'}
                  </span>
                </div>
              )}
              {purchaseOrders.map(order => (
            <div key={order.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm relative">
              {bulkMode && (
                <div className="absolute top-3 left-3 z-10" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedOrderIds.has(order.id)} onChange={() => toggleSelectOrder(order.id)}
                    className="w-4 h-4 accent-[var(--color-error)] cursor-pointer" />
                </div>
              )}
              <div className={cn("flex items-start justify-between gap-4 mb-3", bulkMode && "ml-7")}>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{order.projectName}</p>
                  <p className="text-sm font-black text-primary">{order.supplierName}</p>
                  <p className="text-[8px] text-slate-400 mt-0.5">{order.createdAt}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('px-2 py-1 rounded-lg text-[8px] font-black uppercase',
                    order.status === 'RECIBIDA' ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' :
                    order.status === 'APROBADA' ? 'bg-[var(--color-info-bg)] text-[var(--color-info)]' :
                    order.status === 'CANCELADA' ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]' :
                    'bg-[var(--color-warning-bg)] text-[var(--color-warning)]')}>{order.status}</span>
                  {order.status === 'PENDIENTE' && (
                    <button onClick={() => receiveOrder(order)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[var(--color-success)] text-white rounded-lg text-[8px] font-black uppercase hover:bg-[var(--color-success)] transition-all">
                      <CheckCircle2 size={11}/> Recibir
                    </button>
                  )}
                  <button type="button" title="Eliminar orden" onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order.id); }}
                    className="p-1.5 bg-red-50 text-[var(--color-error)] rounded-lg hover:bg-[var(--color-error-bg)] transition-all opacity-60 hover:opacity-100">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <div className={cn("space-y-1", bulkMode && "ml-7")}>
                {order.items.map((oi, i) => (
                  <div key={i} className="flex justify-between items-center text-[9px] py-1 border-b border-slate-50 last:border-0">
                    <span className="font-bold text-slate-700">{oi.materialName} - {oi.qty} {oi.unit}</span>
                    <span className="font-black text-primary">Q {oi.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className={cn("flex justify-between items-center mt-2", bulkMode && "ml-7")}>
                <span className="text-[10px] font-black text-primary">Total: Q {order.total.toLocaleString()}</span>
              </div>
            </div>
          ))}
            </>
          )}
        </div>
      )}

      {/* -- Modal: Generar stock desde presupuesto -------------- */}
      <Modal isOpen={isGenModalOpen} onClose={() => setIsGenModalOpen(false)} title="Generar Stock desde Presupuesto">
        <div className="space-y-4 text-left">
          <p className="text-[9px] text-p-500 uppercase tracking-widest">Selecciona un proyecto para extraer sus materiales presupuestados y crearlos en inventario por renglón.</p>
          <div className="space-y-1">
            <label className="label">Proyecto</label>
            <select value={selectedProjectForGen} title="Seleccionar proyecto" onChange={e => { setSelectedProjectForGen(e.target.value); setForcePerRenglon(false); }} className="select">
              <option value="">Seleccionar proyecto...</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {selectedProjectForGen && items.some(i => i.projectId === selectedProjectForGen && !i.itemId) && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={forcePerRenglon} onChange={e => setForcePerRenglon(e.target.checked)} className="rounded border-p-300 text-accent focus:ring-accent/20" />
              <span className="text-[9px] font-bold text-amber-600">Forzar creación por renglón (reemplaza registros agregados)</span>
            </label>
          )}
          <Button onClick={() => generateStockFromProject()} disabled={!selectedProjectForGen || generatingStock} isLoading={generatingStock} className="w-full bg-green-600 hover:bg-green-700 text-white">
            Generar Materiales
          </Button>
        </div>
      </Modal>

      {/* -- Modal: Nueva Orden de Compra ------------------------ */}
      <Modal isOpen={isOCModalOpen} onClose={() => setIsOCModalOpen(false)} title="Nueva Orden de Compra">
        <div className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="label">Proyecto</label>
              <select value={ocForm.projectId} title="Seleccionar proyecto" onChange={e => setOcForm(f => ({ ...f, projectId: e.target.value, selectedItemId: '' }))} className="select">
                <option value="">Seleccionar...</option>
                {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Proveedor</label>
              <select value={ocForm.supplierId} title="Seleccionar proveedor" onChange={e => setOcForm(f => ({ ...f, supplierId: e.target.value }))} className="select">
                <option value="">Seleccionar...</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {ocForm.projectId && (() => {
            const project = projects.find((p: any) => p.id === ocForm.projectId);
            return (
              <div className="space-y-1">
                <label className="label">Renglón</label>
                <select value={ocForm.selectedItemId} title="Seleccionar renglón" onChange={e => setOcForm(f => ({ ...f, selectedItemId: e.target.value }))} className="select">
                  <option value="">Seleccionar renglón...</option>
                  {(project?.items || []).map((it: any) =>
                    <option key={it.id} value={it.id}>{it.code} - {it.description}</option>
                  )}
                </select>
              </div>
            );
          })()}

          {ocForm.selectedItemId && (() => {
            const project = projects.find(p => p.id === ocForm.projectId);
            const item = (project?.items || []).find((it: any) => it.id === ocForm.selectedItemId);
            return (
              <div>
                <label className="label">
                  Materiales de {item?.code} — {item?.description}
                </label>
                <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-100 rounded-xl p-2">
                  {(item?.materials || []).map((m: any, idx: number) => {
                    const budgetedQty = (m.quantity || 0) * (item.projectQuantity || 1);
                    const invItem = items.find(i => i.name === m.name && i.projectId === ocForm.projectId && i.itemId === item.id);
                    const alreadyInOC = ocForm.items.some(oi => oi.materialName === m.name && oi.itemId === item.id);
                    return (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-lg px-2 py-1">
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-bold text-slate-700 truncate block">{m.name}</span>
                          <span className="text-[7px] text-slate-400">
                            Presupuestado: {budgetedQty} {m.unit || 'U'}
                            {invItem ? ` | Stock: ${invItem.stock || 0}` : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={alreadyInOC}
                          onClick={() => {
                            if (alreadyInOC) return;
                            setOcForm(f => ({
                              ...f,
                              items: [...f.items, {
                                itemId: item.id,
                                itemName: item.description,
                                materialName: m.name,
                                unit: m.unit || 'U',
                                qty: Math.max(1, Math.ceil(budgetedQty * 0.25)),
                                unitPrice: m.price || 0,
                                total: Math.max(1, Math.ceil(budgetedQty * 0.25)) * (m.price || 0),
                              }]
                            }));
                          }}
                          className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg transition-all shrink-0 ${
                            alreadyInOC
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-[var(--color-info-bg)] text-[var(--color-info)] hover:bg-blue-200'
                          }`}>
                          {alreadyInOC ? 'Agregado' : '+ Agregar'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Items de la OC */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="label">Materiales en OC</label>
              <button type="button" onClick={() => setOcForm(f => ({ ...f, items: [...f.items, { materialName: '', unit: 'U', qty: 1, unitPrice: 0, total: 0 }] }))}
                className="flex items-center gap-1 text-[8px] font-black text-[var(--color-info)] hover:text-[var(--color-info)] uppercase">
                <Plus size={10}/> Manual
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {ocForm.items.map((oi, i) => (
                <div key={i} className="grid grid-cols-12 gap-1 items-center">
                  {oi.itemName && (
                    <span className="col-span-12 text-[7px] text-slate-400 font-bold truncate -mb-1">
                      {oi.itemName}
                    </span>
                  )}
                  <input title="Nombre del material" className="input col-span-4"
                    placeholder="Material" value={oi.materialName}
                    onChange={e => { const it = [...ocForm.items]; it[i] = { ...it[i], materialName: e.target.value }; setOcForm(f => ({ ...f, items: it })); }} />
                  <input title="Unidad de medida" className="input col-span-2"
                    placeholder="Unidad" value={oi.unit}
                    onChange={e => { const it = [...ocForm.items]; it[i] = { ...it[i], unit: e.target.value }; setOcForm(f => ({ ...f, items: it })); }} />
                  <input type="number" title="Cantidad" className="input col-span-2"
                    placeholder="Cant." value={oi.qty || ''}
                    onChange={e => { const it = [...ocForm.items]; it[i] = { ...it[i], qty: +e.target.value, total: +e.target.value * it[i].unitPrice }; setOcForm(f => ({ ...f, items: it })); }} />
                  <input type="number" title="Precio unitario" className="input col-span-3"
                    placeholder="P.Unit Q" value={oi.unitPrice || ''}
                    onChange={e => { const it = [...ocForm.items]; it[i] = { ...it[i], unitPrice: +e.target.value, total: it[i].qty * +e.target.value }; setOcForm(f => ({ ...f, items: it })); }} />
                  <button type="button" title="Eliminar material" onClick={() => setOcForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}
                    className="col-span-1 text-[var(--color-error)] hover:text-[var(--color-error)] flex justify-center"><X size={12}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="label">Notas</label>
            <textarea value={ocForm.notes} title="Notas de la orden" onChange={e => setOcForm(f => ({ ...f, notes: e.target.value }))} className="textarea" rows={2} />
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-p-100">
            <span className="text-[10px] font-black text-primary">Total: Q {ocForm.items.reduce((a, i) => a + i.total, 0).toLocaleString()}</span>
            <Button onClick={createPurchaseOrder} variant="default" size="sm">
              Crear Orden
            </Button>
          </div>
        </div>
      </Modal>

      {bulkMode && activeTab === 'stock' && selectedItemIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-modal flex items-center gap-4">
          <span className="text-[9px] font-black uppercase tracking-widest">{selectedItemIds.size} seleccionado(s)</span>
          <button type="button" onClick={handleBulkDeleteItems} className="px-4 py-1.5 bg-white text-red-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-red-50 transition-all">Eliminar</button>
          <button type="button" onClick={() => setSelectedItemIds(new Set())} aria-label="Cancelar selección" className="p-1.5 hover:bg-white/20 rounded-lg transition-all"><X size={14} /></button>
        </div>
      )}
      {bulkMode && activeTab === 'orders' && selectedOrderIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-modal flex items-center gap-4">
          <span className="text-[9px] font-black uppercase tracking-widest">{selectedOrderIds.size} seleccionado(s)</span>
          <button type="button" onClick={handleBulkDeleteOrders} className="px-4 py-1.5 bg-white text-red-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-red-50 transition-all">Eliminar</button>
          <button type="button" onClick={() => setSelectedOrderIds(new Set())} aria-label="Cancelar selección" className="p-1.5 hover:bg-white/20 rounded-lg transition-all"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}


