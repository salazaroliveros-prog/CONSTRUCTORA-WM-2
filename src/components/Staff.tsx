/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Trash2, LayoutGrid, List, Briefcase, HardHat, Pencil } from 'lucide-react';
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

interface StaffMember {
  id: string;
  name: string;
  role: string;
  salary: string | number;
  documentId: string;
  status?: string;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'MAESTRO DE OBRA': { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  'ALBAÑIL':         { bg: 'bg-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-500' },
  'AYUDANTE':        { bg: 'bg-slate-100',   text: 'text-slate-600',  dot: 'bg-slate-400' },
  'RESIDENTE':       { bg: 'bg-purple-100',  text: 'text-purple-700', dot: 'bg-purple-500' },
  'PLANIFICADOR':    { bg: 'bg-green-100',   text: 'text-green-700',  dot: 'bg-green-500' },
  'ELECTRICISTA':    { bg: 'bg-yellow-100',  text: 'text-yellow-700', dot: 'bg-yellow-500' },
  'PLOMERO':         { bg: 'bg-cyan-100',    text: 'text-cyan-700',   dot: 'bg-cyan-500' },
  'SUPERVISOR':      { bg: 'bg-red-100',     text: 'text-red-700',    dot: 'bg-red-500' },
};
const getRoleColor = (role: string) =>
  ROLE_COLORS[role?.toUpperCase()] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

export default function StaffModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [member, setMember] = useState({ name: '', role: '', salary: '', documentId: '' });
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: '', salary: '', documentId: '', status: 'Activo' });

  const cardPageSize = useAutoPageSize(140, 280, 4);
  const tablePageSize = useAutoPageSize(44, 220, 6);
  const pageSize = viewMode === 'table' ? tablePageSize : cardPageSize;

  useEffect(() => {
    const unsub = subscribeToCollection('staff', (data) => { setStaff(data); setLoading(false); });
    return () => unsub();
  }, []);

  const handleDelete = (id: string) => {
    toast('¿Eliminar colaborador?', {
      description: 'Esta acción no se puede deshacer.',
      action: { label: 'Eliminar', onClick: async () => { try { await deleteDocument('staff', id); toast.success('Colaborador eliminado'); } catch (e: any) { toast.error('Error al eliminar', { description: parseError(e) }); } } },
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!member.name) return;
    toast('¿Registrar colaborador?', {
      description: member.name,
      action: { label: 'Guardar', onClick: async () => {
        setSaving(true);
        try { await addDocument('staff', { ...member, status: 'Activo' }); setIsModalOpen(false); setMember({ name: '', role: '', salary: '', documentId: '' }); toast.success('Colaborador registrado'); }
        catch (error) { toast.error('Error al registrar', { description: parseError(error) }); }
        finally { setSaving(false); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };



  const handleEditStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    toast('Guardar cambios?', {
      description: editForm.name,
      action: { label: 'Confirmar', onClick: async () => {
        try {
          await updateDocument('staff', editMember.id, editForm);
          setEditMember(null);
          toast.success('Colaborador actualizado');
        } catch (err) { toast.error('Error', { description: parseError(err) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const filtered = staff.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { currentItems, currentPage, totalPages, nextPage, prevPage, goToPage, startIndex, totalItems } =
    usePagination<StaffMember>(filtered, pageSize);

  const totalSalary = staff.reduce((a, s) => a + Number(s.salary || 0), 0);

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
          <div className="p-2.5 bg-slate-900 text-secondary rounded-xl shrink-0"><HardHat size={18} /></div>
          <div className="text-left">
            <h2 className="text-sm font-black text-primary tracking-widest uppercase leading-none">Recursos Humanos</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{filtered.length} colaboradores · Q {totalSalary.toLocaleString('es-GT')} nómina</p>
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
            <input type="text" placeholder="BUSCAR PERSONAL..." value={searchTerm}
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
            {currentItems.map((m, i) => {
              const rc = getRoleColor(m.role);
              const initials = m.name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?';
              return (
                <motion.div key={m.id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="group bg-white border border-slate-100 rounded-xl p-3 hover:shadow-md hover:border-secondary/30 transition-all">
                  <div className="flex items-start gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-secondary font-black text-[11px] shrink-0 shadow-md">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-primary uppercase truncate group-hover:text-secondary transition-colors">{m.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                        <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded ${rc.bg} ${rc.text}`}>{m.role || 'Sin cargo'}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => { setEditMember(m); setEditForm({ name: m.name, role: m.role, salary: String(m.salary), documentId: m.documentId, status: m.status || 'Activo' }); }} className="p-1 text-slate-300 hover:text-blue-500 transition-all"><Pencil size={11} /></button>
                      <button onClick={() => handleDelete(m.id)} className="p-1 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={11} /></button>
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2.5 border-t border-slate-50 flex items-center justify-between">
                    <div>
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Salario</p>
                      <p className="text-[10px] font-black text-primary">Q {Number(m.salary || 0).toLocaleString('es-GT')}</p>
                    </div>
                    <span className={cn("text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full",
                      m.status === 'Activo' || !m.status ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                      {m.status || 'Activo'}
                    </span>
                  </div>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center opacity-20">
                <Users size={40} className="mx-auto mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest">Sin personal registrado</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Cargo</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">DPI / Cédula</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Salario (Q)</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {currentItems.map((m, i) => {
                    const rc = getRoleColor(m.role);
                    const initials = m.name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?';
                    return (
                      <motion.tr key={m.id}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-secondary font-black text-[8px] shrink-0">{initials}</div>
                            <span className="text-[10px] font-black text-primary uppercase truncate max-w-[120px]">{m.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded", rc.bg, rc.text)}>{m.role || '--'}</span>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-2.5 text-[9px] text-slate-500 font-bold">{m.documentId || '--'}</td>
                        <td className="px-4 py-2.5 text-right text-[10px] font-black text-primary">
                          {Number(m.salary || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn("text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full",
                            m.status === 'Activo' || !m.status ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                            {m.status || 'Activo'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => { setEditMember(m); setEditForm({ name: m.name, role: m.role, salary: String(m.salary), documentId: m.documentId, status: m.status || 'Activo' }); }} className="p-1 text-slate-300 hover:text-blue-500 transition-colors"><Pencil size={12} /></button>
                            <button onClick={() => handleDelete(m.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="py-12 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin personal registrado</td></tr>
                  )}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Nómina ({staff.length} colaboradores)</td>
                      <td className="px-4 py-2 text-right text-[10px] font-black text-secondary">
                        {totalSalary.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
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
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Nuevo Colaborador">
        <form onSubmit={handleCreate} className="space-y-5 text-left">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
            <input type="text" required placeholder="NOMBRE DEL TRABAJADOR" value={member.name}
              onChange={e => setMember({ ...member, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo / Puesto</label>
              <select value={member.role} onChange={e => setMember({ ...member, role: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                <option value="">SELECCIONAR...</option>
                <option value="MAESTRO DE OBRA">MAESTRO DE OBRA</option>
                <option value="ALBAÑIL">ALBAÑIL</option>
                <option value="AYUDANTE">AYUDANTE</option>
                <option value="RESIDENTE">RESIDENTE</option>
                <option value="PLANIFICADOR">PLANIFICADOR</option>
                <option value="ELECTRICISTA">ELECTRICISTA</option>
                <option value="PLOMERO">PLOMERO</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">DPI / Cédula</label>
              <input type="text" placeholder="DOCUMENTO ID" value={member.documentId}
                onChange={e => setMember({ ...member, documentId: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Salario Base (Q)</label>
            <input type="number" placeholder="0.00" value={member.salary}
              onChange={e => setMember({ ...member, salary: e.target.value })}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all disabled:opacity-50">
            {saving ? 'PROCESANDO...' : 'GUARDAR COLABORADOR'}
          </button>
        </form>
      </Modal>
      <Modal isOpen={!!editMember} onClose={() => setEditMember(null)} title="Editar Colaborador">
        <form onSubmit={handleEditStaff} className="space-y-5 text-left">
          <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label><input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo</label><select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none"><option value="">SELECCIONAR...</option><option>MAESTRO DE OBRA</option><option>ALBAÑIL</option><option>AYUDANTE</option><option>RESIDENTE</option><option>PLANIFICADOR</option><option>ELECTRICISTA</option><option>PLOMERO</option><option>SUPERVISOR</option></select></div>
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">DPI</label><input type="text" value={editForm.documentId} onChange={e => setEditForm({ ...editForm, documentId: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Salario (Q)</label><input type="number" value={editForm.salary} onChange={e => setEditForm({ ...editForm, salary: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" /></div>
            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</label><select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none"><option>Activo</option><option>Inactivo</option></select></div>
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all">GUARDAR CAMBIOS</button>
        </form>
      </Modal>
    </div>
  );
}

