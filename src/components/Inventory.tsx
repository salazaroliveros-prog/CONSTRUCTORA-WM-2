/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WarehouseItem, PurchaseOrder, PurchaseOrderItem } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument, parseError } from '../services/firestoreService';
import { uploadFile } from '../services/storageService';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import { toast } from 'sonner';

import Modal from './ui/Modal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function InventoryModule() {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState<{name: string, cat: 'Materiales' | 'Herramientas' | 'EPP', stock: number, minStock: number, unit: string, location: string, iconUrl: string}>({ name: '', cat: 'Materiales', stock: 0, minStock: 5, unit: 'U', location: 'Almacén Central', iconUrl: '' });
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState<{id:string, field:string, value:string} | null>(null);

  // Project stock & purchase orders
  const [projects, setProjects] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'stock' | 'orders'>('stock');
  const [isOCModalOpen, setIsOCModalOpen] = useState(false);
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [selectedProjectForGen, setSelectedProjectForGen] = useState('');
  const [generatingStock, setGeneratingStock] = useState(false);
  const [ocForm, setOcForm] = useState<{ projectId: string; supplierId: string; notes: string; items: PurchaseOrderItem[] }>({
    projectId: '', supplierId: '', notes: '', items: []
  });

  useEffect(() => {
    const u1 = subscribeToCollection('projects', setProjects);
    const u2 = subscribeToCollection('suppliers', setSuppliers);
    const u3 = subscribeToCollection('purchaseOrders', (data: any[]) => setPurchaseOrders(data));
    return () => { u1(); u2(); u3(); };
  }, []);

  const generateStockFromProject = async () => {
    const project = projects.find(p => p.id === selectedProjectForGen);
    if (!project) return;
    setGeneratingStock(true);
    try {
      const materials: { name: string; unit: string; qty: number; cost: number }[] = [];
      (project.items || []).forEach((item: any) => {
        (item.materials || []).forEach((m: any) => {
          const qty = (m.quantity || 0) * (item.projectQuantity || 1);
          const existing = materials.find(x => x.name === m.name && x.unit === (m.unit || 'U'));
          if (existing) { existing.qty += qty; }
          else { materials.push({ name: m.name, unit: m.unit || 'U', qty, cost: m.price || 0 }); }
        });
      });
      let created = 0;
      for (const mat of materials) {
        // Skip if already exists for this project
        const exists = items.find(i => i.name === mat.name && i.projectId === project.id);
        if (exists) continue;
        await addDocument('inventory', {
          name: mat.name,
          cat: 'Materiales' as const,
          stock: 0,
          unit: mat.unit,
          location: 'Almacén Central',
          minStock: Math.ceil(mat.qty * 0.1),
          lastEntry: new Date().toISOString().split('T')[0],
          history: [],
          projectId: project.id,
          projectName: project.name,
          budgetedQty: mat.qty,
          budgetedCost: mat.cost,
          usedQty: 0,
        });
        created++;
      }
      toast.success(`${created} materiales generados desde presupuesto`, { description: project.name });
      setIsGenModalOpen(false);
      setSelectedProjectForGen('');
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
        projectName: project.name,
        supplierId: supplier.id,
        supplierName: supplier.name,
        status: 'PENDIENTE',
        items: ocForm.items,
        total,
        createdAt: new Date().toISOString().split('T')[0],
        notes: ocForm.notes,
      });
      toast.success('Orden de compra creada');
      setIsOCModalOpen(false);
      setOcForm({ projectId: '', supplierId: '', notes: '', items: [] });
    } catch (e) {
      toast.error('Error al crear OC', { description: parseError(e) });
    }
  };

  const receiveOrder = async (order: PurchaseOrder) => {
    try {
      // Update each inventory item stock
      for (const oi of order.items) {
        const inv = items.find(i => i.name === oi.materialName && i.projectId === order.projectId);
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

  useEffect(() => {
    const unsub = subscribeToCollection('inventory', (data) => {
      setItems(data);
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
      setNewItem({ name: '', cat: 'Materiales', stock: 0, minStock: 5, unit: 'U', location: 'Almacén Central', iconUrl: '' });
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
    { id: 'Bodega Acabados', name: 'Bodega Acabados', short: 'BA', desc: 'Material Delicado', color: 'bg-blue-600' },
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

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = activeCategory === 'Todos' || item.cat === activeCategory;
    const matchesZone = !selectedZone || item.location?.includes(selectedZone);
    return matchesSearch && matchesCat && matchesZone;
  });

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
    <div id="warehouse-management" className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 text-left">
          <div className="p-2 bg-slate-900 text-secondary rounded-lg shrink-0">
            <Package size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">Total Items</p>
            <h3 className="text-sm md:text-xl font-black text-primary truncate">{items.length}</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 text-left">
          <div className="p-2 bg-red-50 text-red-500 rounded-lg shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">Bajo Stock</p>
            <h3 className="text-sm md:text-xl font-black text-red-500 truncate">{items.filter(i => i.stock < i.minStock).length}</h3>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 text-left">
          <div className="p-2 bg-green-50 text-green-500 rounded-lg shrink-0">
            <DollarSign size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">Valor Inventario</p>
            <h3 className="text-sm md:text-xl font-black text-primary truncate">Q {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
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
      <div className="flex flex-wrap gap-2 items-center">
        {[{ id: 'stock', label: 'Stock / Bodega', icon: <Package size={13}/> }, { id: 'orders', label: 'Ordenes de Compra', icon: <ShoppingCart size={13}/> }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all',
              activeTab === t.id ? 'bg-slate-900 text-white shadow' : 'bg-white border border-slate-200 text-slate-500 hover:border-secondary')}>
            {t.icon}{t.label}
          </button>
        ))}
        <button onClick={() => setIsGenModalOpen(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow">
          <Building2 size={13}/> Generar desde Presupuesto
        </button>
        {activeTab === 'orders' && (
          <button onClick={() => setIsOCModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-all shadow">
            <Plus size={13}/> Nueva OC
          </button>
        )}
      </div>

      <Modal 

        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        title="Registrar Nuevo Suministro"
      >
        <form onSubmit={handleCreateItem} className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Material / Equipo</label>
            <input 
              type="text"
              required
              placeholder="EJ: CEMENTO UGC"
              value={newItem.name}
              onChange={e => setNewItem({...newItem, name: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
              <select 
                value={newItem.cat}
                onChange={e => setNewItem({...newItem, cat: e.target.value as 'Materiales' | 'Herramientas' | 'EPP'})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none"
              >
                {categories.filter(c => c !== 'Todos').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unidad de Medida</label>
              <input 
                type="text"
                placeholder="EJ: SACO, GL, UD"
                value={newItem.unit}
                onChange={e => setNewItem({...newItem, unit: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ícono Personalizado</label>
            <input 
              type="file"
              accept="image/*"
              onChange={e => setIconFile(e.target.files?.[0] || null)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Inicial</label>
              <input 
                type="number"
                value={newItem.stock}
                onChange={e => setNewItem({...newItem, stock: parseFloat(e.target.value)})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Mínimo</label>
              <input 
                type="number"
                placeholder="0.00"
                value={newItem.minStock}
                onChange={e => setNewItem({...newItem, minStock: parseFloat(e.target.value)})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ubicación Física</label>
            <select 
              value={newItem.location}
              onChange={e => setNewItem({...newItem, location: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none"
            >
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <button 
            type="submit"
            disabled={saving}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-secondary hover:text-primary transition-all disabled:opacity-50"
          >
            {saving ? 'PROCESANDO...' : 'REIGSTRAR EN SISTEMA'}
          </button>
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
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="BUSCAR SUMINISTRO..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-[10px] font-black focus:outline-none focus:border-secondary transition-all uppercase tracking-widest placeholder:text-slate-300" 
            />
          </div>
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
                <th className="px-4 py-3">Suministro</th>
                <th className="hidden md:table-cell px-4 py-3">Categoría</th>
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
                    selectedItem === item.id ? "bg-slate-50/80" : ""
                  )}
                  onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                       {item.iconUrl ? (
                          <img src={item.iconUrl} alt={item.name} className="w-8 h-8 rounded-lg object-cover" />
                       ) : (
                          <div className={cn(
                            "p-1.5 rounded-lg shrink-0",
                            item.stock < item.minStock ? "bg-red-50 text-red-500" : "bg-slate-100 text-slate-400"
                          )}>
                            {getCatIcon(item.cat)}
                          </div>
                      )}
                      <div className="min-w-0 text-left">
                        {editingCell?.id === item.id && editingCell.field === 'name' ? (
                          <input
                            autoFocus
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
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.cat}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col text-left">
                      {editingCell?.id === item.id && editingCell.field === 'stock' ? (
                        <input
                          autoFocus type="number"
                          value={editingCell.value}
                          onChange={e => setEditingCell({...editingCell, value: e.target.value})}
                          onBlur={saveInlineEdit}
                          onKeyDown={e => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                          className="text-[11px] font-black w-16 border-b-2 border-secondary bg-transparent focus:outline-none"
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={cn("text-[11px] font-black tabular-nums cursor-text", item.stock < item.minStock ? "text-red-500" : "text-primary")}
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
                        onClick={(e) => handleDelete(e, item.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-secondary transition-all">
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

      {/* Movement Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 text-left">
                <div>
                  <h3 className="text-sm font-black text-primary uppercase tracking-[0.2em]">Movimiento</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Gestión de Stock Real</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-lg text-slate-400"><X size={20} /></button>
              </div>

              <div className="p-8 space-y-4 text-left overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tipo</label>
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                      <button 
                        type="button"
                        onClick={() => setMovementForm({ ...movementForm, type: 'Entrada', category: entryCategories[0] })}
                        className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", movementForm.type === 'Entrada' ? "bg-white text-green-600 shadow-sm" : "text-slate-400")}
                      >
                        Entrada
                      </button>
                      <button 
                        type="button"
                        onClick={() => setMovementForm({ ...movementForm, type: 'Salida', category: exitCategories[0] })}
                        className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all", movementForm.type === 'Salida' ? "bg-white text-red-600 shadow-sm" : "text-slate-400")}
                      >
                        Salida
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Fecha</label>
                    <input 
                      type="date"
                      value={movementForm.date}
                      onChange={(e) => setMovementForm({ ...movementForm, date: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-secondary shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Producto (Opcional)</label>
                  <select 
                    value={movementForm.itemId}
                    onChange={(e) => setMovementForm({ ...movementForm, itemId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase focus:outline-none focus:border-secondary shadow-sm"
                  >
                    <option value="">Seleccione suministro...</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.stock})</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Proyecto (Opcional)</label>
                  <select
                    value={movementForm.projectId}
                    onChange={(e) => setMovementForm({ ...movementForm, projectId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase focus:outline-none focus:border-secondary shadow-sm"
                  >
                    <option value="">Sin proyecto</option>
                    {projects.filter(p => p.status === 'EJECUCION').map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Categoría</label>
                  <select 
                    value={movementForm.category}
                    onChange={(e) => setMovementForm({ ...movementForm, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase focus:outline-none focus:border-secondary shadow-sm"
                  >
                    {(movementForm.type === 'Entrada' ? entryCategories : exitCategories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Cantidad</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={movementForm.quantity || ''}
                      onChange={(e) => setMovementForm({ ...movementForm, quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black focus:outline-none focus:border-secondary shadow-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Costo / Precio (Q)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={movementForm.cost || ''}
                      onChange={(e) => setMovementForm({ ...movementForm, cost: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black focus:outline-none focus:border-secondary shadow-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Descripción</label>
                  <textarea 
                    value={movementForm.description}
                    onChange={(e) => setMovementForm({ ...movementForm, description: e.target.value })}
                    placeholder="Detalles del movimiento..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase focus:outline-none focus:border-secondary shadow-sm min-h-[60px]"
                  />
                </div>

                <button 
                  type="button"
                  onClick={handleMovement}
                  disabled={!movementForm.category || movementForm.quantity <= 0}
                  className="w-full bg-primary text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2 shadow-xl shadow-primary/10"
                >
                  Confirmar Registro
                </button>
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
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin �rdenes de compra</p>
              <p className="text-[9px] text-slate-300 mt-1">Crea una nueva OC para solicitar materiales a proveedores</p>
            </div>
          ) : purchaseOrders.map(order => (
            <div key={order.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{order.projectName}</p>
                  <p className="text-sm font-black text-primary">{order.supplierName}</p>
                  <p className="text-[8px] text-slate-400 mt-0.5">{order.createdAt}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('px-2 py-1 rounded-lg text-[8px] font-black uppercase',
                    order.status === 'RECIBIDA' ? 'bg-emerald-100 text-emerald-700' :
                    order.status === 'APROBADA' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'CANCELADA' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700')}>{order.status}</span>
                  {order.status === 'PENDIENTE' && (
                    <button onClick={() => receiveOrder(order)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase hover:bg-emerald-700 transition-all">
                      <CheckCircle2 size={11}/> Recibir
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                {order.items.map((oi, i) => (
                  <div key={i} className="flex justify-between items-center text-[9px] py-1 border-b border-slate-50 last:border-0">
                    <span className="font-bold text-slate-700">{oi.materialName} � {oi.qty} {oi.unit}</span>
                    <span className="font-black text-primary">Q {oi.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-2">
                <span className="text-[10px] font-black text-primary">Total: Q {order.total.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* -- Modal: Generar stock desde presupuesto -------------- */}
      <Modal isOpen={isGenModalOpen} onClose={() => setIsGenModalOpen(false)} title="Generar Stock desde Presupuesto">
        <div className="space-y-4 text-left">
          <p className="text-[9px] text-slate-500 uppercase tracking-widest">Selecciona un proyecto para extraer sus materiales presupuestados y crearlos en inventario con cantidad 0 (pendiente de compra).</p>
          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Proyecto</label>
            <select value={selectedProjectForGen} onChange={e => setSelectedProjectForGen(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[10px] font-black focus:outline-none focus:border-secondary">
              <option value="">Seleccionar proyecto...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button onClick={generateStockFromProject} disabled={!selectedProjectForGen || generatingStock}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all">
            {generatingStock ? 'Generando...' : 'Generar Materiales'}
          </button>
        </div>
      </Modal>

      {/* -- Modal: Nueva Orden de Compra ------------------------ */}
      <Modal isOpen={isOCModalOpen} onClose={() => setIsOCModalOpen(false)} title="Nueva Orden de Compra">
        <div className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Proyecto</label>
              <select value={ocForm.projectId} onChange={e => setOcForm(f => ({ ...f, projectId: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-secondary">
                <option value="">Seleccionar...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Proveedor</label>
              <select value={ocForm.supplierId} onChange={e => setOcForm(f => ({ ...f, supplierId: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:border-secondary">
                <option value="">Seleccionar...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Items de la OC */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Materiales</label>
              <button type="button" onClick={() => setOcForm(f => ({ ...f, items: [...f.items, { materialName: '', unit: 'U', qty: 1, unitPrice: 0, total: 0 }] }))}
                className="flex items-center gap-1 text-[8px] font-black text-blue-600 hover:text-blue-800 uppercase">
                <Plus size={10}/> Agregar
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {ocForm.items.map((oi, i) => (
                <div key={i} className="grid grid-cols-12 gap-1 items-center">
                  <input className="col-span-4 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-black focus:outline-none"
                    placeholder="Material" value={oi.materialName}
                    onChange={e => { const it = [...ocForm.items]; it[i] = { ...it[i], materialName: e.target.value }; setOcForm(f => ({ ...f, items: it })); }} />
                  <input className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-black focus:outline-none"
                    placeholder="Unidad" value={oi.unit}
                    onChange={e => { const it = [...ocForm.items]; it[i] = { ...it[i], unit: e.target.value }; setOcForm(f => ({ ...f, items: it })); }} />
                  <input type="number" className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-black focus:outline-none"
                    placeholder="Cant." value={oi.qty || ''}
                    onChange={e => { const it = [...ocForm.items]; it[i] = { ...it[i], qty: +e.target.value, total: +e.target.value * it[i].unitPrice }; setOcForm(f => ({ ...f, items: it })); }} />
                  <input type="number" className="col-span-3 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-black focus:outline-none"
                    placeholder="P.Unit Q" value={oi.unitPrice || ''}
                    onChange={e => { const it = [...ocForm.items]; it[i] = { ...it[i], unitPrice: +e.target.value, total: it[i].qty * +e.target.value }; setOcForm(f => ({ ...f, items: it })); }} />
                  <button type="button" onClick={() => setOcForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))}
                    className="col-span-1 text-red-400 hover:text-red-600 flex justify-center"><X size={12}/></button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Notas</label>
            <textarea value={ocForm.notes} onChange={e => setOcForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none resize-none" rows={2} />
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <span className="text-[10px] font-black text-primary">Total: Q {ocForm.items.reduce((a, i) => a + i.total, 0).toLocaleString()}</span>
            <button onClick={createPurchaseOrder}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
              Crear Orden
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
