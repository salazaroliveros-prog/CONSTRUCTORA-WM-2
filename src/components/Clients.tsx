/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Trash2, LayoutGrid, List, Pencil } from 'lucide-react';
import { motion } from 'motion/react';
import { Client } from '../constants';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument, parseError } from '../services/firestoreService';
import { usePagination } from '../hooks/usePagination';
import { useAutoPageSize } from '../hooks/useAutoPageSize';
import Pagination from './ui/Pagination';
import Modal from './ui/Modal';
import { toast } from 'sonner';

export default function ClientsModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', address: '' });

  // Auto page size: card ~160px, table row ~44px, reserved ~220px
  const cardPageSize = useAutoPageSize(160, 260, 4);
  const tablePageSize = useAutoPageSize(44, 220, 6);
  const pageSize = viewMode === 'table' ? tablePageSize : cardPageSize;

  useEffect(() => {
    const unsub = subscribeToCollection('clients', (data) => { setClients(data); setLoading(false); });
    return () => unsub();
  }, []);

  const handleDelete = (id: string) => {
    toast('¿Eliminar cliente?', {
      description: 'Esta acción no se puede deshacer.',
      action: { label: 'Eliminar', onClick: async () => { try { await deleteDocument('clients', id); toast.success('Cliente eliminado'); } catch (e: any) { toast.error('Error al eliminar', { description: parseError(e) }); } } },
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name) return;
    if (newClient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email)) { toast.error('Email no válido'); return; }
    toast('¿Registrar cliente?', {
      description: newClient.name,
      action: { label: 'Guardar', onClick: async () => {
        setSaving(true);
        try { await addDocument('clients', { ...newClient, projects: [] }); setIsModalOpen(false); setNewClient({ name: '', email: '', phone: '', address: '' }); toast.success('Cliente registrado'); }
        catch (error) { toast.error('Error al registrar', { description: parseError(error) }); }
        finally { setSaving(false); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };



  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClient) return;
    toast('Guardar cambios?', {
      description: editForm.name,
      action: { label: 'Confirmar', onClick: async () => {
        try {
          await updateDocument('clients', editClient.id, editForm);
          setEditClient(null);
          toast.success('Cliente actualizado');
        } catch (err) { toast.error('Error', { description: parseError(err) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { currentItems, currentPage, totalPages, nextPage, prevPage, goToPage, startIndex, totalItems } =
    usePagination<Client>(filtered, pageSize);

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-4 animate-in slide-in-from-bottom-4 duration-500">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-secondary rounded-xl shrink-0"><Users size={18} /></div>
          <div className="text-left">
            <h2 className="text-sm font-black text-primary tracking-widest uppercase leading-none">Clientes</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{filtered.length} registros</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto items-center">
          {/* View toggle */}
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
            className="flex items-center justify-center p-2 bg-secondary text-primary rounded-lg hover:bg-secondary/90 transition-all shrink-0">
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 h-full content-start">
            {currentItems.map((client, i) => (
              <motion.div key={client.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">
                <div className="bg-slate-900 h-0.5 group-hover:bg-secondary transition-colors" />
                <div className="p-3 text-left flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-[9px]">
                      {client.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditClient(client); setEditForm({ name: client.name, email: client.email || '', phone: client.phone || '', address: client.address || '' }); }} className="btn-edit"><Pencil size={11} /></button>
                      <button onClick={() => handleDelete(client.id)} className="btn-delete"><Trash2 size={11} /></button>
                    </div>
                  </div>
                  <h3 className="text-[10px] font-black text-primary tracking-tight uppercase group-hover:text-secondary transition-colors truncate">{client.name}</h3>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest truncate mt-0.5">{client.email || 'Sin correo'}</p>
                  <div className="mt-2 pt-2 border-t border-slate-50 flex justify-between text-[8px] font-bold uppercase tracking-widest">
                    <span className="text-slate-400">Tel: {client.phone || '--'}</span>
                    <span className="text-primary">{client.projects?.length || 0} proy.</span>
                  </div>
                </div>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center opacity-20">
                <Users size={40} className="mx-auto mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest">Sin clientes registrados</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Nombre</th>
                    <th className="hidden md:table-cell px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Correo</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Teléfono</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Proyectos</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentItems.map((client, i) => (
                    <motion.tr key={client.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-500 text-[8px] shrink-0">
                            {client.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                          </div>
                          <span className="text-[10px] font-black text-primary uppercase truncate max-w-[120px]">{client.name}</span>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-2.5 text-[9px] text-slate-500 font-bold truncate max-w-[160px]">{client.email || '--'}</td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-[9px] text-slate-500 font-bold">{client.phone || '--'}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-[9px] font-black text-primary">{client.projects?.length || 0}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => handleDelete(client.id)} className="btn-delete">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="py-12 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin clientes registrados</td></tr>
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
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Nuevo Cliente">
        <form onSubmit={handleCreate} className="space-y-5 text-left">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
            <input type="text" required placeholder="NOMBRE DEL CLIENTE" value={newClient.name}
              onChange={e => setNewClient({ ...newClient, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo</label>
              <input type="email" placeholder="EMAIL@EJEMPLO.COM" value={newClient.email}
                onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
              <input type="text" placeholder="+502" value={newClient.phone}
                onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección</label>
            <input type="text" placeholder="CIUDAD, ZONA..." value={newClient.address}
              onChange={e => setNewClient({ ...newClient, address: e.target.value })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all disabled:opacity-50">
            {saving ? 'PROCESANDO...' : 'GUARDAR CLIENTE'}
          </button>
        </form>
      </Modal>
      {/* Edit Modal */}
      <Modal isOpen={!!editClient} onClose={() => setEditClient(null)} title="Editar Cliente">
        <form onSubmit={handleEdit} className="space-y-5 text-left">
          <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label><input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo</label><input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" /></div>
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label><input type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" /></div>
          </div>
          <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección</label><input type="text" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" /></div>
          <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all">GUARDAR CAMBIOS</button>
        </form>
      </Modal>
    </div>
  );
}

