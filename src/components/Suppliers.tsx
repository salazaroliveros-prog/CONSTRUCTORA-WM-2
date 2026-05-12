/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck, Plus, Search, Star, Phone, Mail, Trash2, LayoutGrid, List, Pencil,
  X, Globe, CreditCard, Clock, ShoppingCart, TrendingUp, Download,
  Package, CheckCircle2, AlertCircle, ChevronRight, DollarSign, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument, parseError } from '../services/firestoreService';
import { usePagination } from '../hooks/usePagination';
import { useAutoPageSize } from '../hooks/useAutoPageSize';
import Pagination from './ui/Pagination';
import Modal from './ui/Modal';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface Supplier {
  id: string;
  name: string;
  category: string;
  contact: string;
  email: string;
  rating: string;
  status: 'Activo' | 'Inactivo';
  address?: string;
  nit?: string;
  website?: string;
  paymentTerms?: string;
  notes?: string;
}

interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  projectId?: string;
  projectName: string;
  status: string;
  total: number;
  createdAt: string;
  items?: any[];
}

const CATEGORIES = ['OBRA GRIS','ELECTRICIDAD','PLOMERÍA','ACABADOS','ESTRUCTURA METÁLICA','MADERA','VIDRIO Y ALUMINIO','HERRAMIENTAS','EPP','TRANSPORTE','GENERAL'];

function exportSuppliersCSV(suppliers: Supplier[]) {
  const headers = ['Nombre','Categoría','Teléfono','Email','Rating','Estado','NIT','Dirección'];
  const rows = suppliers.map(s => [s.name, s.category, s.contact, s.email, s.rating, s.status, s.nit||'', s.address||'']);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'proveedores.csv'; a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exportado correctamente');
}

// Componente de rating interactivo
function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(star => (
        <button key={star} type="button"
          title={`${star} estrella${star > 1 ? 's' : ''}`}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={cn("transition-transform", !readonly && "hover:scale-125 cursor-pointer", readonly && "cursor-default")}>
          <Star size={readonly ? 9 : 14}
            className={star <= (hover || value) ? 'text-amber-400' : 'text-slate-200'}
            fill={star <= (hover || value) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

const EMPTY_FORM = { name: '', category: '', contact: '', email: '', rating: '5', status: 'Activo', address: '', nit: '', website: '', paymentTerms: '', notes: '' };

export default function SuppliersModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterRating, setFilterRating] = useState(0);

  const cardPageSize = useAutoPageSize(160, 260, 4);
  const tablePageSize = useAutoPageSize(44, 220, 6);
  const pageSize = viewMode === 'table' ? tablePageSize : cardPageSize;

  useEffect(() => {
    const u1 = subscribeToCollection('suppliers', (data) => { setSuppliers(data); setLoading(false); });
    const u2 = subscribeToCollection('purchaseOrders', (data) => setPurchaseOrders(data));
    const u3 = subscribeToCollection('inventory', (data) => setInventory(data));
    const u4 = subscribeToCollection('projects', (data) => setProjects(data));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const handleDelete = (id: string) => {
    const ocs = purchaseOrders.filter(o => o.supplierId === id);
    toast('¿Eliminar proveedor?', {
      description: ocs.length > 0 ? `Tiene ${ocs.length} orden(es) de compra asociadas.` : 'Esta acción no se puede deshacer.',
      action: { label: 'Eliminar', onClick: async () => { try { await deleteDocument('suppliers', id); if (selectedSupplier?.id === id) setSelectedSupplier(null); toast.success('Proveedor eliminado'); } catch (e: any) { toast.error('Error al eliminar', { description: parseError(e) }); } } },
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Nombre requerido'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Email no válido'); return; }
    toast('¿Registrar proveedor?', {
      description: form.name,
      action: { label: 'Guardar', onClick: async () => {
        setSaving(true);
        try { await addDocument('suppliers', form); setIsModalOpen(false); setForm({ ...EMPTY_FORM }); toast.success('Proveedor registrado'); }
        catch (error) { toast.error('Error al registrar', { description: parseError(error) }); }
        finally { setSaving(false); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleEditSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplier) return;
    toast('¿Guardar cambios?', {
      description: editForm.name,
      action: { label: 'Confirmar', onClick: async () => {
        try {
          await updateDocument('suppliers', editSupplier.id, editForm);
          if (selectedSupplier?.id === editSupplier.id) setSelectedSupplier({ ...editSupplier, ...editForm } as Supplier);
          setEditSupplier(null);
          toast.success('Proveedor actualizado');
        } catch (err) { toast.error('Error', { description: parseError(err) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleRatingChange = async (supplier: Supplier, newRating: number) => {
    try {
      await updateDocument('suppliers', supplier.id, { rating: String(newRating) });
      if (selectedSupplier?.id === supplier.id) setSelectedSupplier({ ...supplier, rating: String(newRating) });
      toast.success(`Rating actualizado a ${newRating} ★`);
    } catch { toast.error('Error al actualizar rating'); }
  };

  const filtered = useMemo(() => suppliers.filter(s => {
    const matchSearch = s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.nit?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = !filterCategory || s.category?.toUpperCase() === filterCategory;
    const matchStatus = filterStatus === 'Todos' || s.status === filterStatus;
    const matchRating = filterRating === 0 || Number(s.rating || 5) >= filterRating;
    return matchSearch && matchCat && matchStatus && matchRating;
  }), [suppliers, searchTerm, filterCategory, filterStatus, filterRating]);

  const { currentItems, currentPage, totalPages, nextPage, prevPage, goToPage, startIndex, totalItems } =
    usePagination<Supplier>(filtered, pageSize);

  // KPIs
  const activeCount = suppliers.filter(s => s.status === 'Activo').length;
  const avgRating = suppliers.length ? (suppliers.reduce((a, s) => a + Number(s.rating || 5), 0) / suppliers.length).toFixed(1) : '0.0';
  const totalOCs = purchaseOrders.length;
  const totalSpent = purchaseOrders.reduce((a, o) => a + (o.total || 0), 0);

  // OCs del proveedor seleccionado
  const supplierOCs = useMemo(() =>
    selectedSupplier ? purchaseOrders.filter(o => o.supplierId === selectedSupplier.id || o.supplierName === selectedSupplier.name).slice(0, 8) : [],
    [selectedSupplier, purchaseOrders]
  );
  const supplierTotalSpent = supplierOCs.reduce((a, o) => a + (o.total || 0), 0);

  const OC_STATUS_COLORS: Record<string, string> = {
    'PENDIENTE': 'bg-amber-100 text-amber-700',
    'APROBADA': 'bg-blue-100 text-blue-700',
    'RECIBIDA': 'bg-emerald-100 text-emerald-700',
    'CANCELADA': 'bg-red-100 text-red-600',
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in duration-500">

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Total Proveedores', value: suppliers.length, icon: <Truck size={14}/>, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Activos', value: activeCount, icon: <CheckCircle2 size={14}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Rating Promedio', value: `${avgRating} ★`, icon: <Star size={14}/>, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Total Compras', value: `Q ${totalSpent.toLocaleString('es-GT')}`, icon: <DollarSign size={14}/>, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-3 shadow-sm">
            <div className={cn('p-2 rounded-lg shrink-0', kpi.bg, kpi.color)}>{kpi.icon}</div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
              <p className="text-sm font-black text-primary">{kpi.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-secondary rounded-xl shrink-0"><Truck size={18} /></div>
          <div className="text-left">
            <h2 className="text-sm font-black text-primary tracking-widest uppercase leading-none">Proveedores</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{filtered.length} de {suppliers.length} registros</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} title="Filtrar por categoría"
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
            <option value="">TODAS LAS CATEGORÍAS</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} title="Filtrar por estado"
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
            <option value="Todos">TODOS</option>
            <option value="Activo">ACTIVOS</option>
            <option value="Inactivo">INACTIVOS</option>
          </select>
          <select value={filterRating} onChange={e => setFilterRating(Number(e.target.value))} title="Filtrar por rating mínimo"
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
            <option value={0}>CUALQUIER RATING</option>
            <option value={3}>3+ ESTRELLAS</option>
            <option value={4}>4+ ESTRELLAS</option>
            <option value={5}>5 ESTRELLAS</option>
          </select>
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button type="button" onClick={() => setViewMode('grid')} title="Cuadrícula"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              <LayoutGrid size={15} />
            </button>
            <button type="button" onClick={() => setViewMode('table')} title="Tabla"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              <List size={15} />
            </button>
          </div>
          <div className="relative flex-1 md:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="BUSCAR PROVEEDOR..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} title="Buscar proveedor"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <button type="button" onClick={() => exportSuppliersCSV(suppliers)} title="Exportar CSV"
            className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all">
            <Download size={14} />
          </button>
          <button type="button" onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shrink-0">
            <Plus size={14} /> Nuevo
          </button>
        </div>
      </div>

      {/* Main layout: list + side panel */}
      <div className="flex flex-1 min-h-0 gap-4">
        <div className={cn("flex flex-col min-h-0 transition-all duration-300", selectedSupplier ? "flex-1" : "w-full")}>
          <div className="flex-1 min-h-0 overflow-hidden">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 h-full content-start overflow-y-auto">
                {currentItems.map((s, i) => {
                  const isSelected = selectedSupplier?.id === s.id;
                  const ocCount = purchaseOrders.filter(o => o.supplierId === s.id || o.supplierName === s.name).length;
                  return (
                    <motion.div key={s.id}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.04 }}
                      onClick={() => setSelectedSupplier(isSelected ? null : s)}
                      className={cn("group bg-white rounded-xl border p-3 hover:shadow-md transition-all cursor-pointer",
                        isSelected ? "border-secondary shadow-md ring-2 ring-secondary/20" : "border-slate-100 hover:border-secondary/40")}>
                      <div className="flex justify-between items-start mb-2">
                        <div className={cn("p-2 rounded-lg", isSelected ? "bg-secondary text-primary" : "bg-slate-900 text-secondary")}>
                          <Truck size={14} />
                        </div>
                        <span className={cn("px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase",
                          s.status === 'Activo' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-600")}>
                          {s.status || 'Activo'}
                        </span>
                      </div>
                      <h3 className="text-[10px] font-black text-primary uppercase truncate group-hover:text-secondary transition-colors">{s.name}</h3>
                      <span className="text-[8px] font-bold text-slate-400 uppercase">{s.category || 'General'}</span>
                      <div className="mt-2 space-y-1">
                        {s.contact && <div className="flex items-center gap-1.5 text-[8px] text-slate-500"><Phone size={9} className="text-secondary shrink-0" />{s.contact}</div>}
                        {s.email && <div className="flex items-center gap-1.5 text-[8px] text-slate-500 lowercase"><Mail size={9} className="text-secondary shrink-0" /><span className="truncate">{s.email}</span></div>}
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                        <StarRating value={Number(s.rating || 5)} readonly onChange={v => handleRatingChange(s, v)} />
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          {ocCount > 0 && <span className="text-[7px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{ocCount} OC</span>}
                          <button type="button" title="Editar" onClick={() => { setEditSupplier(s); setEditForm({ name: s.name, category: s.category, contact: s.contact, email: s.email, rating: s.rating, status: s.status, address: s.address||'', nit: s.nit||'', website: s.website||'', paymentTerms: s.paymentTerms||'', notes: s.notes||'' }); }} className="btn-edit opacity-0 group-hover:opacity-100"><Pencil size={11} /></button>
                          <button type="button" title="Eliminar" onClick={() => handleDelete(s.id)} className="btn-delete opacity-0 group-hover:opacity-100"><Trash2 size={11} /></button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="col-span-full py-16 text-center opacity-20">
                    <Truck size={40} className="mx-auto mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Sin proveedores registrados</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
                <div className="overflow-auto flex-1">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="border-b border-slate-100">
                        <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Proveedor</th>
                        <th className="hidden sm:table-cell px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
                        <th className="hidden md:table-cell px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Contacto</th>
                        <th className="hidden lg:table-cell px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">OC</th>
                        <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                        <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Rating</th>
                        <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {currentItems.map((s, i) => {
                        const isSelected = selectedSupplier?.id === s.id;
                        const ocCount = purchaseOrders.filter(o => o.supplierId === s.id || o.supplierName === s.name).length;
                        return (
                          <motion.tr key={s.id}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: i * 0.03 }}
                            onClick={() => setSelectedSupplier(isSelected ? null : s)}
                            className={cn("hover:bg-slate-50/50 transition-colors group cursor-pointer",
                              isSelected && "bg-secondary/5 border-l-2 border-secondary")}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                                  isSelected ? "bg-secondary text-primary" : "bg-slate-900 text-secondary")}><Truck size={12} /></div>
                                <span className="text-[10px] font-black text-primary uppercase truncate max-w-[120px]">{s.name}</span>
                              </div>
                            </td>
                            <td className="hidden sm:table-cell px-4 py-2.5 text-[9px] text-slate-500 font-bold uppercase">{s.category || '--'}</td>
                            <td className="hidden md:table-cell px-4 py-2.5 text-[9px] text-slate-500 font-bold">{s.contact || '--'}</td>
                            <td className="hidden lg:table-cell px-4 py-2.5">
                              {ocCount > 0 ? <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{ocCount} orden{ocCount > 1 ? 'es' : ''}</span>
                                : <span className="text-[8px] text-slate-300 font-bold">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={cn("px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase",
                                s.status === 'Activo' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-600")}>
                                {s.status || 'Activo'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                              <StarRating value={Number(s.rating || 5)} onChange={v => handleRatingChange(s, v)} />
                            </td>
                            <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex gap-1 justify-end">
                                <button type="button" title="Editar" onClick={() => { setEditSupplier(s); setEditForm({ name: s.name, category: s.category, contact: s.contact, email: s.email, rating: s.rating, status: s.status, address: s.address||'', nit: s.nit||'', website: s.website||'', paymentTerms: s.paymentTerms||'', notes: s.notes||'' }); }} className="btn-edit"><Pencil size={12} /></button>
                                <button type="button" title="Eliminar" onClick={() => handleDelete(s.id)} className="btn-delete"><Trash2 size={12} /></button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="py-12 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin proveedores registrados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="shrink-0 mt-3">
            <Pagination currentPage={currentPage} totalPages={totalPages} onNext={nextPage} onPrev={prevPage}
              onPage={goToPage} totalItems={totalItems} startIndex={startIndex} itemsPerPage={pageSize} compact />
          </div>
        </div>

        {/* Side Panel */}
        <AnimatePresence>
          {selectedSupplier && (
            <motion.div
              initial={{ opacity: 0, x: 40, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 300 }}
              exit={{ opacity: 0, x: 40, width: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="shrink-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col"
              style={{ minWidth: 260, maxWidth: 300 }}>
              {/* Header */}
              <div className="bg-slate-900 p-4 relative">
                <button type="button" title="Cerrar panel" onClick={() => setSelectedSupplier(null)}
                  className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                  <X size={14} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-primary shadow-lg">
                    <Truck size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-white uppercase leading-tight truncate">{selectedSupplier.name}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{selectedSupplier.category || 'General'}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <StarRating value={Number(selectedSupplier.rating || 5)} onChange={v => handleRatingChange(selectedSupplier, v)} />
                      <span className={cn("text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full ml-1",
                        selectedSupplier.status === 'Activo' ? "bg-emerald-500/20 text-emerald-300" : "bg-orange-500/20 text-orange-300")}>
                        {selectedSupplier.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* KPIs del proveedor */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                    <p className="text-[7px] font-black text-blue-600 uppercase tracking-widest">Órdenes</p>
                    <p className="text-xs font-black text-blue-700">{supplierOCs.length}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                    <p className="text-[7px] font-black text-amber-600 uppercase tracking-widest">Total Compras</p>
                    <p className="text-xs font-black text-amber-700">Q {supplierTotalSpent.toLocaleString('es-GT')}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2.5 text-center">
                    <p className="text-[7px] font-black text-green-600 uppercase tracking-widest">Promedio OC</p>
                    <p className="text-xs font-black text-green-700">Q {supplierOCs.length > 0 ? Math.round(supplierTotalSpent / supplierOCs.length).toLocaleString('es-GT') : '0'}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                    <p className="text-[7px] font-black text-purple-600 uppercase tracking-widest">Última Compra</p>
                    <p className="text-xs font-black text-purple-700">
                      {supplierOCs.length > 0 ? (() => {
                        const lastOrder = supplierOCs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                        const daysSince = Math.floor((Date.now() - new Date(lastOrder.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                        return daysSince === 0 ? 'Hoy' : daysSince === 1 ? 'Ayer' : `${daysSince}d`;
                      })() : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Información de contacto */}
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Información</p>
                  <div className="space-y-1.5">
                    {[
                      { icon: <Phone size={10}/>, value: selectedSupplier.contact },
                      { icon: <Mail size={10}/>, value: selectedSupplier.email },
                      { icon: <CreditCard size={10}/>, value: selectedSupplier.nit ? `NIT: ${selectedSupplier.nit}` : null },
                      { icon: <Globe size={10}/>, value: selectedSupplier.website },
                      { icon: <Clock size={10}/>, value: selectedSupplier.paymentTerms ? `Pago: ${selectedSupplier.paymentTerms}` : null },
                    ].map((item, i) => item.value ? (
                      <div key={i} className="flex items-center gap-2 text-[9px]">
                        <span className="text-slate-400 shrink-0">{item.icon}</span>
                        <span className="text-primary font-black truncate">{item.value}</span>
                      </div>
                    ) : null)}
                    {selectedSupplier.address && (
                      <p className="text-[9px] text-slate-500 font-bold bg-slate-50 rounded-lg p-2">{selectedSupplier.address}</p>
                    )}
                  </div>
                </div>

                {/* Historial de Órdenes de Compra */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Órdenes de Compra</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[7px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                        {supplierOCs.length} total{supplierOCs.length !== 1 ? 'es' : ''}
                      </span>
                      {supplierOCs.filter(oc => oc.status === 'PENDIENTE').length > 0 && (
                        <span className="text-[7px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full animate-pulse">
                          {supplierOCs.filter(oc => oc.status === 'PENDIENTE').length} pendiente{supplierOCs.filter(oc => oc.status === 'PENDIENTE').length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  {supplierOCs.length === 0 ? (
                    <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      <ShoppingCart size={16} className="mx-auto mb-1 text-slate-300" />
                      <p className="text-[9px] text-slate-300 font-bold italic">Sin órdenes registradas</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {supplierOCs.map(oc => (
                        <div key={oc.id} className="bg-slate-50 rounded-lg p-2 hover:bg-slate-100 transition-all group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-black text-primary uppercase truncate flex-1">{oc.projectName || 'Sin proyecto'}</span>
                            <span className={cn("text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full ml-1 shrink-0", OC_STATUS_COLORS[oc.status] || 'bg-slate-100 text-slate-600')}>
                              {oc.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-slate-400 font-bold">{oc.createdAt ? new Date(oc.createdAt).toLocaleDateString('es-GT') : '--'}</span>
                              {oc.items && oc.items.length > 0 && (
                                <span className="text-[7px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded-full">
                                  {oc.items.length} item{oc.items.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] font-black text-secondary">Q {(oc.total || 0).toLocaleString('es-GT')}</span>
                          </div>
                          {/* Mostrar items de la OC al hacer hover */}
                          <div className="mt-1 opacity-0 group-hover:opacity-100 transition-all max-h-0 group-hover:max-h-20 overflow-hidden">
                            <div className="text-[7px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-200">
                              {(oc.items || []).slice(0, 3).map((item, i) => (
                                <div key={i} className="flex justify-between">
                                  <span className="truncate">{item.materialName}</span>
                                  <span>{item.qty} {item.unit}</span>
                                </div>
                              ))}
                              {(oc.items || []).length > 3 && (
                                <div className="text-center text-slate-400 italic">+{(oc.items || []).length - 3} más...</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Materiales a Cotizar */}
                {(() => {
                  const projectIds = supplierOCs.map(oc => oc.projectId).filter(Boolean);
                  const needed = inventory.filter(inv =>
                    inv.projectId &&
                    projectIds.includes(inv.projectId) &&
                    (inv.stock || 0) < (inv.budgetedQty || 0)
                  );
                  if (needed.length === 0) return null;
                  return (
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Materiales por Cotizar</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {needed.slice(0, 10).map(inv => {
                          const project = projects.find(p => p.id === inv.projectId);
                          return (
                            <div key={inv.id} className="bg-amber-50 rounded-lg px-2 py-1.5">
                              <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black text-slate-700 truncate">{inv.name}</span>
                                <span className="text-[7px] font-bold text-amber-700">
                                  Faltan {(inv.budgetedQty || 0) - (inv.stock || 0)} {inv.unit}
                                </span>
                              </div>
                              <div className="text-[7px] text-slate-500">
                                {project?.name || inv.projectName} {inv.itemName ? `· ${inv.itemName}` : ''}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Notas */}
                {selectedSupplier.notes && (
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Notas</p>
                    <p className="text-[9px] text-slate-600 bg-slate-50 rounded-lg p-2">{selectedSupplier.notes}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-100 flex gap-2">
                <button type="button" onClick={() => { setEditSupplier(selectedSupplier); setEditForm({ name: selectedSupplier.name, category: selectedSupplier.category, contact: selectedSupplier.contact, email: selectedSupplier.email, rating: selectedSupplier.rating, status: selectedSupplier.status, address: selectedSupplier.address||'', nit: selectedSupplier.nit||'', website: selectedSupplier.website||'', paymentTerms: selectedSupplier.paymentTerms||'', notes: selectedSupplier.notes||'' }); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all">
                  <Pencil size={11} /> Editar
                </button>
                <button type="button" title="Nueva orden de compra" 
                  onClick={() => { window.location.search = '?tab=inventory'; }}
                  className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all">
                  <ShoppingCart size={14} />
                </button>
                <button type="button" title="Eliminar proveedor" onClick={() => handleDelete(selectedSupplier.id)}
                  className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal Crear */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Nuevo Proveedor">
        <form onSubmit={handleCreate} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Empresa *</label>
            <input type="text" required placeholder="NOMBRE COMERCIAL" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} title="Nombre de la empresa"
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} title="Categoría del proveedor"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                <option value="">SELECCIONAR...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
              <input type="tel" placeholder="+502 0000-0000" value={form.contact}
                onChange={e => setForm({ ...form, contact: e.target.value })} title="Teléfono de contacto"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
              <input type="email" placeholder="prov@empresa.com" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} title="Correo electrónico"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">NIT</label>
              <input type="text" placeholder="0000000-0" value={form.nit}
                onChange={e => setForm({ ...form, nit: e.target.value })} title="Número de NIT"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Términos de Pago</label>
              <select value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} title="Términos de pago"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                <option value="">SELECCIONAR...</option>
                <option value="Contado">CONTADO</option>
                <option value="15 días">15 DÍAS</option>
                <option value="30 días">30 DÍAS</option>
                <option value="60 días">60 DÍAS</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Rating Inicial</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <StarRating value={Number(form.rating || 5)} onChange={v => setForm({ ...form, rating: String(v) })} />
                <span className="text-[9px] font-black text-slate-500">{form.rating} ★</span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección</label>
            <input type="text" placeholder="DIRECCIÓN COMPLETA" value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })} title="Dirección del proveedor"
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all disabled:opacity-50">
            {saving ? 'PROCESANDO...' : 'REGISTRAR PROVEEDOR'}
          </button>
        </form>
      </Modal>

      {/* Modal Editar */}
      <Modal isOpen={!!editSupplier} onClose={() => setEditSupplier(null)} title="Editar Proveedor">
        <form onSubmit={handleEditSupplier} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label>
            <input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} title="Nombre"
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
              <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} title="Categoría"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                <option value="">SELECCIONAR...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
              <input type="tel" value={editForm.contact} onChange={e => setEditForm({ ...editForm, contact: e.target.value })} title="Teléfono"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo</label>
              <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} title="Correo"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">NIT</label>
              <input type="text" value={editForm.nit} onChange={e => setEditForm({ ...editForm, nit: e.target.value })} title="NIT"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</label>
              <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} title="Estado"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                <option>Activo</option><option>Inactivo</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Términos de Pago</label>
              <select value={editForm.paymentTerms} onChange={e => setEditForm({ ...editForm, paymentTerms: e.target.value })} title="Términos de pago"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                <option value="">SELECCIONAR...</option>
                <option value="Contado">CONTADO</option>
                <option value="15 días">15 DÍAS</option>
                <option value="30 días">30 DÍAS</option>
                <option value="60 días">60 DÍAS</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección</label>
            <input type="text" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} title="Dirección"
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Notas</label>
            <input type="text" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} title="Notas"
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Rating</label>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <StarRating value={Number(editForm.rating || 5)} onChange={v => setEditForm({ ...editForm, rating: String(v) })} />
              <span className="text-[9px] font-black text-slate-500">{editForm.rating} ★</span>
            </div>
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all">GUARDAR CAMBIOS</button>
        </form>
      </Modal>
    </div>
  );
}

