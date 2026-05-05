/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Star, Phone, Mail, Trash2, LayoutGrid, List, Pencil } from 'lucide-react';
import { motion } from 'motion/react';
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
}

export default function SuppliersModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', contact: '', email: '', rating: '5.0', status: 'Activo' });
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [editForm, setEditForm] = useState({ name: '', category: '', contact: '', email: '', rating: '5.0', status: 'Activo' });

  const cardPageSize = useAutoPageSize(160, 260, 4);
  const tablePageSize = useAutoPageSize(44, 220, 6);
  const pageSize = viewMode === 'table' ? tablePageSize : cardPageSize;

  useEffect(() => {
    const unsub = subscribeToCollection('suppliers', (data) => { setSuppliers(data); setLoading(false); });
    return () => unsub();
  }, []);

  const handleDelete = (id: string) => {
    toast('¿Eliminar proveedor?', {
      description: 'Esta acción no se puede deshacer.',
      action: { label: 'Eliminar', onClick: async () => { try { await deleteDocument('suppliers', id); toast.success('Proveedor eliminado'); } catch (e: any) { toast.error('Error al eliminar', { description: parseError(e) }); } } },
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
        try { await addDocument('suppliers', form); setIsModalOpen(false); setForm({ name: '', category: '', contact: '', email: '', rating: '5.0', status: 'Activo' }); toast.success('Proveedor registrado'); }
        catch (error) { toast.error('Error al registrar', { description: parseError(error) }); }
        finally { setSaving(false); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };



  const handleEditSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplier) return;
    toast('Guardar cambios?', {
      description: editForm.name,
      action: { label: 'Confirmar', onClick: async () => {
        try {
          await updateDocument('suppliers', editSupplier.id, editForm);
          setEditSupplier(null);
          toast.success('Proveedor actualizado');
        } catch (err) { toast.error('Error', { description: parseError(err) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { currentItems, currentPage, totalPages, nextPage, prevPage, goToPage, startIndex, totalItems } =
    usePagination<Supplier>(filtered, pageSize);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in duration-500">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-secondary rounded-xl shrink-0"><Truck size={18} /></div>
          <div className="text-left">
            <h2 className="text-sm font-black text-primary tracking-widest uppercase leading-none">Proveedores</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{filtered.length} registros</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto items-center">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button onClick={() => setViewMode('grid')} title="Cuadrícula"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              <LayoutGrid size={15} />
            </button>
            <button onClick={() => setViewMode('table')} title="Tabla"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              <List size={15} />
            </button>
          </div>
          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="BUSCAR..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <button onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shrink-0">
            <Plus size={14} /> Nuevo
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 h-full content-start">
            {currentItems.map((s, i) => (
              <motion.div key={s.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="group bg-white rounded-xl border border-slate-100 p-3 hover:border-secondary/40 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-slate-900 rounded-lg text-secondary"><Truck size={14} /></div>
                  <span className={cn("px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase",
                    s.status === 'Activo' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-600")}>
                    {s.status || 'Activo'}
                  </span>
                </div>
                <h3 className="text-[10px] font-black text-primary uppercase truncate group-hover:text-secondary transition-colors">{s.name}</h3>
                <span className="text-[8px] font-bold text-slate-400 uppercase">{s.category || 'General'}</span>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-[8px] text-slate-500"><Phone size={9} className="text-secondary" />{s.contact || '--'}</div>
                  <div className="flex items-center gap-1.5 text-[8px] text-slate-500 lowercase"><Mail size={9} className="text-secondary" />{s.email || '--'}</div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(star => (
                      <Star key={star} size={9} className={star <= Number(s.rating || 5) ? 'text-amber-400' : 'text-slate-200'}
                        fill={star <= Number(s.rating || 5) ? 'currentColor' : 'none'} />
                    ))}
                  </div>
                  <button onClick={() => handleDelete(s.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={11} />
                  </button>
                </div>
              </motion.div>
            ))}
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
                    <th className="hidden lg:table-cell px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Correo</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Rating</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentItems.map((s, i) => (
                    <motion.tr key={s.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-secondary shrink-0"><Truck size={12} /></div>
                          <span className="text-[10px] font-black text-primary uppercase truncate max-w-[120px]">{s.name}</span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-[9px] text-slate-500 font-bold uppercase">{s.category || '--'}</td>
                      <td className="hidden md:table-cell px-4 py-2.5 text-[9px] text-slate-500 font-bold">{s.contact || '--'}</td>
                      <td className="hidden lg:table-cell px-4 py-2.5 text-[9px] text-slate-500 font-bold lowercase truncate max-w-[140px]">{s.email || '--'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn("px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase",
                          s.status === 'Activo' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-600")}>
                          {s.status || 'Activo'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex gap-0.5 justify-center">
                          {[1,2,3,4,5].map(star => (
                            <Star key={star} size={9} className={star <= Number(s.rating || 5) ? 'text-amber-400' : 'text-slate-200'}
                              fill={star <= Number(s.rating || 5) ? 'currentColor' : 'none'} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => handleDelete(s.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin proveedores registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="shrink-0">
        <Pagination currentPage={currentPage} totalPages={totalPages} onNext={nextPage} onPrev={prevPage}
          onPage={goToPage} totalItems={totalItems} startIndex={startIndex} itemsPerPage={pageSize} compact />
      </div>

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Nuevo Proveedor">
        <form onSubmit={handleCreate} className="space-y-5 text-left">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Empresa</label>
            <input type="text" required placeholder="NOMBRE COMERCIAL" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
              <input type="text" placeholder="OBRA GRIS, ELECTRICIDAD..." value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
              <input type="text" placeholder="+502" value={form.contact}
                onChange={e => setForm({ ...form, contact: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
            <input type="email" placeholder="PROV@SISTEMA.COM" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all disabled:opacity-50">
            {saving ? 'PROCESANDO...' : 'REGISTRAR PROVEEDOR'}
          </button>
        </form>
      </Modal>
      <Modal isOpen={!!editSupplier} onClose={() => setEditSupplier(null)} title="Editar Proveedor">
        <form onSubmit={handleEditSupplier} className="space-y-5 text-left">
          <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label><input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label><input type="text" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" /></div>
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefono</label><input type="text" value={editForm.contact} onChange={e => setEditForm({ ...editForm, contact: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo</label><input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" /></div>
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</label><select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none"><option>Activo</option><option>Inactivo</option></select></div>
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all">GUARDAR CAMBIOS</button>
        </form>
      </Modal>
    </div>
  );
}

