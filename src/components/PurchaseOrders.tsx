import React, { useState, useMemo } from 'react';
import {
  ShoppingCart, Plus, Search, Trash2, CheckCircle2, XCircle,
  Building2, Package, Clock, ChevronRight, FileDown, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';
import { addDocument, updateDocument, deleteDocument, parseError } from '../services/firestoreService';
import { useStore } from '../store/DataStore';
import { usePagination } from '../hooks/usePagination';
import { useAutoPageSize } from '../hooks/useAutoPageSize';
import Pagination from './ui/Pagination';
import { Modal } from './ui/Modal';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { sanitizeString } from '../utils/sanitize';
import { fmtQ } from '../engine/precision';
import { trackCRUD } from '../utils/logger';

const STATUS_ORDER = ['PENDIENTE', 'APROBADA', 'RECIBIDA', 'CANCELADA'];
const STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-500/10 text-amber-500',
  APROBADA: 'bg-blue-500/10 text-blue-400',
  RECIBIDA: 'bg-emerald-500/10 text-emerald-400',
  CANCELADA: 'bg-red-500/10 text-red-400',
};

export default function PurchaseOrdersModule() {
  const store = useStore();
  const orders = store.purchaseOrders.items as any[];
  const projects = store.projects.items as any[];
  const suppliers = store.suppliers.items as any[];
  const inventory = store.inventory.items as any[];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ projectId: '', supplierId: '', notes: '' });
  const [formItems, setFormItems] = useState<{ materialName: string; unit: string; qty: number; unitPrice: number; total: number }[]>([]);

  const filtered = useMemo(() => {
    let list = orders;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.projectName?.toLowerCase().includes(q) ||
        o.supplierName?.toLowerCase().includes(q) ||
        o.id?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) list = list.filter(o => o.status === statusFilter);
    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [orders, search, statusFilter]);

  const pageSize = useAutoPageSize(120, 340);
  const pag = usePagination(filtered, pageSize);

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    toast(`¿Eliminar ${selected.size} orden(es)?`, {
      action: { label: 'Eliminar', onClick: async () => {
        for (const id of selected) await deleteDocument('purchaseOrders', id);
        toast.success(`${selected.size} orden(es) eliminadas`);
        setSelected(new Set());
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleDelete = (id: string) => {
    toast('¿Eliminar orden de compra?', {
      action: { label: 'Eliminar', onClick: async () => {
        await deleteDocument('purchaseOrders', id);
        toast.success('Orden eliminada');
        trackCRUD('delete', 'purchase-order');
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleReceive = async (order: any) => {
    try {
      for (const oi of order.items || []) {
        const inv = inventory.find(i =>
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
      trackCRUD('update', 'purchase-order');
    } catch (e) {
      toast.error('Error al recibir orden', { description: parseError(e) });
    }
  };

  const handleCancel = async (id: string) => {
    await updateDocument('purchaseOrders', id, { status: 'CANCELADA' });
    toast.success('Orden cancelada');
    trackCRUD('update', 'purchase-order');
  };

  const loadProjectMaterials = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const items: typeof formItems = [];
    for (const item of project.items || []) {
      for (const m of item.materials || []) {
        const qty = (m.quantity || 0) * (item.projectQuantity || 1);
        items.push({
          materialName: m.name || 'Material',
          unit: m.unit || 'U',
          qty,
          unitPrice: m.unitPrice ?? m.price ?? 0,
          total: qty * (m.unitPrice ?? m.price ?? 0),
        });
      }
    }
    setFormItems(items);
  };

  const handleCreate = async () => {
    if (!form.projectId || !form.supplierId || formItems.length === 0) {
      toast.error('Seleccione proyecto, proveedor y verifique los materiales');
      return;
    }
    setCreating(true);
    try {
      const project = projects.find(p => p.id === form.projectId);
      const supplier = suppliers.find(s => s.id === form.supplierId);
      const total = formItems.reduce((a, i) => a + i.total, 0);
      await addDocument('purchaseOrders', {
        projectId: form.projectId,
        projectName: sanitizeString(project?.name || ''),
        supplierId: form.supplierId,
        supplierName: sanitizeString(supplier?.name || ''),
        status: 'PENDIENTE',
        items: formItems,
        total,
        createdAt: new Date().toISOString().split('T')[0],
        notes: sanitizeString(form.notes),
      });
      toast.success('Orden de compra creada');
      setIsCreateOpen(false);
      setForm({ projectId: '', supplierId: '', notes: '' });
      setFormItems([]);
      trackCRUD('create', 'purchase-order');
    } catch (e) {
      toast.error('Error al crear OC', { description: parseError(e) });
    } finally {
      setCreating(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Proyecto','Proveedor','Total','Estado','Fecha'];
    const rows = filtered.map(o => [o.projectName, o.supplierName, o.total, o.status, o.createdAt]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'ordenes-compra.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-3">
            <ShoppingCart className="text-white" />
            Órdenes de Compra
          </h1>
          <p className="text-white text-sm">{filtered.length} registro(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setBulkMode(!bulkMode)}>
            Seleccionar
          </Button>
          <Button variant="ghost" onClick={exportCSV}>
            <FileDown size={14} /> CSV
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus size={14} /> Nueva OC
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por proyecto, proveedor..."
            className="w-full bg-white/10 border border-white/20 rounded-xl pl-9 pr-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-amber-500 text-sm"
          />
        </div>
        <select
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 text-sm"
          title="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {selected.size > 0 && (
          <button onClick={handleBulkDelete} className="px-3 py-2 bg-red-500/20 text-red-400 rounded-xl text-sm font-bold hover:bg-red-500/30">
            Eliminar {selected.size}
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-3">
        {pag.currentItems.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart size={40} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/40 text-sm font-bold uppercase tracking-widest">Sin órdenes de compra</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {pag.currentItems.map(order => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {bulkMode && (
                        <input type="checkbox" checked={selected.has(order.id)}
                          onChange={() => toggleSelect(order.id)}
                          className="w-4 h-4 accent-amber-500 cursor-pointer"
                        />
                      )}
                      <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest', STATUS_COLORS[order.status] || STATUS_COLORS.PENDIENTE)}>
                        {order.status}
                      </span>
                      <span className="text-[10px] text-white/30">{order.createdAt}</span>
                    </div>
                    <h3 className="text-base font-bold text-white">{order.supplierName}</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-white/60 flex items-center gap-1">
                        <Building2 size={12} /> {order.projectName}
                      </span>
                      {order.notes && (
                        <span className="text-xs text-white/40 italic">{order.notes}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-amber-500">{fmtQ(order.total)}</p>
                    <p className="text-[10px] text-white/30">{order.items?.length || 0} material(es)</p>
                  </div>
                </div>

                {/* Items */}
                {order.items && order.items.length > 0 && (
                  <div className="mt-4 border-t border-white/10 pt-3 space-y-1">
                    {order.items.slice(0, 5).map((oi: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-white/60">{oi.materialName} — {oi.qty} {oi.unit}</span>
                        <span className="text-white/80 font-bold">{fmtQ(oi.total)}</span>
                      </div>
                    ))}
                    {order.items.length > 5 && (
                      <p className="text-[10px] text-white/30">...y {order.items.length - 5} más</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-3 border-t border-white/10">
                  {order.status === 'PENDIENTE' && (
                    <>
                      <button onClick={() => handleReceive(order)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/30 transition-all">
                        <CheckCircle2 size={12} /> Recibir
                      </button>
                      <button onClick={() => handleCancel(order.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/30 transition-all">
                        <XCircle size={12} /> Cancelar
                      </button>
                    </>
                  )}
                  {order.status !== 'PENDIENTE' && (
                    <span className="text-[10px] text-white/30 italic">
                      {order.status === 'RECIBIDA' ? 'Stock actualizado' : 'Orden cancelada'}
                    </span>
                  )}
                  <button onClick={() => handleDelete(order.id)}
                    className="ml-auto p-1.5 text-white/30 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > pageSize && (
        <Pagination
          currentPage={pag.currentPage}
          totalPages={pag.totalPages}
          onNext={pag.nextPage}
          onPrev={pag.prevPage}
          onPage={pag.goToPage}
          totalItems={filtered.length}
          startIndex={pag.startIndex}
          itemsPerPage={pageSize}
        />
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nueva Orden de Compra">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1 block">Proyecto</label>
            <select
              value={form.projectId} onChange={e => { setForm(f => ({ ...f, projectId: e.target.value })); loadProjectMaterials(e.target.value); }}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 text-sm"
              title="Seleccionar proyecto"
            >
              <option value="">Seleccionar proyecto...</option>
              {projects.filter((p: any) => p.status !== 'FINALIZADO').map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1 block">Proveedor</label>
            <select
              value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 text-sm"
              title="Seleccionar proveedor"
            >
              <option value="">Seleccionar proveedor...</option>
              {suppliers.filter((s: any) => s.status !== 'Inactivo').map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} — {s.category}</option>
              ))}
            </select>
          </div>

          {formItems.length > 0 && (
            <div>
              <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1 block">Materiales ({formItems.length})</label>
              <div className="max-h-48 overflow-y-auto space-y-1 bg-white/5 rounded-xl p-2">
                {formItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-white/5 rounded-lg p-2">
                    <span className="flex-1 text-white/80 font-bold">{item.materialName}</span>
                    <span className="text-white/40">{item.qty} {item.unit}</span>
                    <span className="text-amber-400 font-black">{fmtQ(item.total)}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm font-black text-amber-400 mt-2">
                Total: {fmtQ(formItems.reduce((a, i) => a + i.total, 0))}
              </p>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1 block">Notas (opcional)</label>
            <textarea
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 text-sm resize-none"
              rows={3} placeholder="Condiciones de entrega, instrucciones..."
            />
          </div>

          <Button onClick={handleCreate} isLoading={creating} className="w-full">
            <ShoppingCart size={14} /> Generar Orden de Compra
          </Button>
        </div>
      </Modal>
    </div>
  );
}
