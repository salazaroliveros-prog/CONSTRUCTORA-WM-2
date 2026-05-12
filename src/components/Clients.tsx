import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Search, Plus, Trash2, Pencil, X, Building2,
  Phone, Mail, MapPin, FileText, TrendingUp, CheckCircle2,
  AlertCircle, ChevronRight, DollarSign, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client } from '../constants';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument, parseError } from '../services/firestoreService';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
function fmtQ(n: number) { return 'Q ' + Math.round(n).toLocaleString('es-GT'); }

type ClientForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  nit: string;
  type: NonNullable<Client['type']>;
  notes: string;
  status: NonNullable<Client['status']>;
};

const EMPTY_FORM: ClientForm = { name: '', email: '', phone: '', address: '', nit: '', type: 'PERSONA', notes: '', status: 'ACTIVO' };

export default function ClientsModule() {
  const [clients, setClients]         = useState<Client[]>([]);
  const [projects, setProjects]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState<Client | null>(null);
  const [showForm, setShowForm]       = useState(false);
  const [editMode, setEditMode]       = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVO' | 'INACTIVO'>('ALL');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());

  const toggleSelectClient = (id: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllClients = () => {
    if (selectedClientIds.size === currentItems.length) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(currentItems.map(c => c.id)));
    }
  };

  const handleBulkDeleteClients = () => {
    if (selectedClientIds.size === 0) return;
    toast('¿Eliminar clientes seleccionados?', {
      description: `${selectedClientIds.size} cliente(s) serán eliminados.`,
      action: { label: 'Eliminar Todo', onClick: async () => {
        try {
          for (const id of selectedClientIds) await deleteDocument('clients', id);
          toast.success(`${selectedClientIds.size} cliente(s) eliminados`);
          setSelectedClientIds(new Set());
        } catch (e: any) { toast.error('Error', { description: parseError(e) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  useEffect(() => {
    const u1 = subscribeToCollection('clients', d => { setClients(d); setLoading(false); });
    const u2 = subscribeToCollection('projects', setProjects);
    return () => { u1(); u2(); };
  }, []);

  // Proyectos de un cliente (por clientName o clientId)
  const clientProjects = (client: Client) =>
    projects.filter(p => p.clientName === client.name || p.clientId === client.id);

  // KPIs globales
  const kpis = useMemo(() => {
    const active   = clients.filter(c => (c.status ?? 'ACTIVO') === 'ACTIVO').length;
    const withProj = clients.filter(c => clientProjects(c).length > 0).length;
    const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
    const inExec   = projects.filter(p => p.status === 'EJECUCION').length;
    return { active, withProj, totalBudget, inExec };
  }, [clients, projects]);

  const filtered = useMemo(() =>
    clients.filter(c => {
      const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.nit?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'ALL' || (c.status ?? 'ACTIVO') === filterStatus;
      return matchSearch && matchStatus;
    }), [clients, search, filterStatus]);

  const { currentItems, currentPage, totalPages, nextPage, prevPage, goToPage, startIndex, totalItems } =
    usePagination<Client>(filtered, 12);

  const openCreate = () => { setForm(EMPTY_FORM); setEditMode(false); setShowForm(true); };
  const openEdit   = (c: Client) => {
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '',
      nit: c.nit || '', type: c.type || 'PERSONA', notes: c.notes || '', status: c.status || 'ACTIVO' });
    setEditMode(true); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editMode && selected) {
        await updateDocument('clients', selected.id, form);
        setSelected(prev => prev ? { ...prev, ...form } : null);
        toast.success('Cliente actualizado');
      } else {
        await addDocument('clients', { ...form, projects: [] });
        toast.success('Cliente registrado');
      }
      setShowForm(false);
    } catch (err) { toast.error('Error', { description: parseError(err) }); }
    finally { setSaving(false); }
  };

  const handleDelete = (c: Client) => {
    toast(`¿Eliminar a ${c.name}?`, {
      description: 'Esta acción no se puede deshacer.',
      action: { label: 'Eliminar', onClick: async () => {
        try { await deleteDocument('clients', c.id); if (selected?.id === c.id) setSelected(null); toast.success('Cliente eliminado'); }
        catch (err) { toast.error('Error', { description: parseError(err) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-3 p-0 overflow-hidden">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {[
          { icon: <Users size={14} className="text-blue-500" />,      label: 'Clientes Activos',  value: kpis.active,                color: 'text-blue-700' },
          { icon: <Building2 size={14} className="text-amber-500" />, label: 'Con Proyectos',     value: kpis.withProj,              color: 'text-amber-700' },
          { icon: <TrendingUp size={14} className="text-green-500" />,label: 'En Ejecución',      value: `${kpis.inExec} proy.`,     color: 'text-green-700' },
          { icon: <DollarSign size={14} className="text-purple-500" />,label: 'Presupuesto Total', value: fmtQ(kpis.totalBudget),    color: 'text-purple-700' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">{k.icon}<span className="text-[7px] font-black text-slate-400 uppercase">{k.label}</span></div>
            <p className={cn('text-lg font-black', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, email o NIT..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold focus:outline-none focus:border-blue-400" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase focus:outline-none">
          <option value="ALL">Todos</option>
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
        </select>
        <button type="button" title="Selección múltiple" onClick={() => { setBulkMode(!bulkMode); if (bulkMode) setSelectedClientIds(new Set()); }}
          className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${bulkMode ? 'bg-red-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
          {bulkMode ? 'Cancelar' : 'Seleccionar'}
        </button>
        <button onClick={openCreate}
                     className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-700 active:scale-95 transition-all">
          <Plus size={14} /> Nuevo Cliente
        </button>
      </div>

      {/* ── Main: lista + perfil ── */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">

        {/* Lista */}
        <div className={cn('flex flex-col gap-2 overflow-y-auto', selected ? 'w-80 shrink-0' : 'flex-1')}>
          {currentItems.length === 0 && (
            <div className="py-16 text-center opacity-20">
              <Users size={40} className="mx-auto mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest">Sin clientes</p>
            </div>
          )}
          {currentItems.map((c, i) => {
            const cProjs = clientProjects(c);
            const isActive = (c.status ?? 'ACTIVO') === 'ACTIVO';
            return (
              <motion.div key={c.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => { if (bulkMode) { toggleSelectClient(c.id); } else { setSelected(prev => prev?.id === c.id ? null : c); } }}
                className={cn(
                  'bg-white border rounded-xl p-3 cursor-pointer hover:shadow-md transition-all group relative',
                  selected?.id === c.id || selectedClientIds.has(c.id) ? 'border-blue-400 shadow-md' : 'border-slate-200'
                )}
              >
                {bulkMode && (
                  <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedClientIds.has(c.id)} onChange={() => toggleSelectClient(c.id)}
                      className="w-4 h-4 accent-red-500 cursor-pointer" />
                  </div>
                )}
                <div className={cn("flex items-center gap-3", bulkMode && "ml-7")}>
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center font-black text-[10px] shrink-0',
                    c.type === 'EMPRESA' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                    {c.type === 'EMPRESA' ? <Building2 size={16} /> : c.name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-slate-800 uppercase truncate">{c.name}</p>
                      <span className={cn('text-[7px] font-black px-1.5 py-0.5 rounded uppercase shrink-0',
                        isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>
                        {isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <p className="text-[8px] text-slate-400 font-bold truncate">{c.email || c.phone || 'Sin contacto'}</p>
                    {c.nit && <p className="text-[7px] text-slate-300 font-bold">NIT: {c.nit}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[8px] font-black text-slate-500">{cProjs.length} proy.</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); setSelected(c); openEdit(c); }}
                        className="p-1 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600"><Pencil size={11} /></button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(c); }}
                        className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"><Trash2 size={11} /></button>
                    </div>
                    <ChevronRight size={13} className={cn('text-slate-300 transition-transform', selected?.id === c.id && 'rotate-90 text-blue-400')} />
                  </div>
                </div>
              </motion.div>
            );
          })}
          <div className="shrink-0 pt-1">
            <Pagination currentPage={currentPage} totalPages={totalPages} onNext={nextPage} onPrev={prevPage}
              onPage={goToPage} totalItems={totalItems} startIndex={startIndex} itemsPerPage={12} compact />
          </div>
        </div>

        {/* Perfil lateral */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
              className="flex-1 bg-white border border-slate-200 rounded-xl overflow-y-auto"
            >
              {/* Header perfil */}
              <div className="bg-slate-900 p-5 text-white relative">
                <button onClick={() => setSelected(null)} className="absolute top-3 right-3 p-1 hover:bg-white/10 rounded-lg">
                  <X size={14} />
                </button>
                <div className="flex items-center gap-4">
                  <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg',
                    selected.type === 'EMPRESA' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white')}>
                    {selected.type === 'EMPRESA' ? <Building2 size={24} /> : selected.name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">{selected.type || 'PERSONA'}</p>
                    <h2 className="text-base font-black uppercase">{selected.name}</h2>
                    {selected.nit && <p className="text-[9px] text-slate-400">NIT: {selected.nit}</p>}
                  </div>
                </div>
                <div className="flex gap-4 mt-4 text-[8px] font-bold text-slate-400 uppercase">
                  {selected.email && <span className="flex items-center gap-1"><Mail size={10} />{selected.email}</span>}
                  {selected.phone && <span className="flex items-center gap-1"><Phone size={10} />{selected.phone}</span>}
                  {selected.address && <span className="flex items-center gap-1"><MapPin size={10} />{selected.address}</span>}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* KPIs del cliente */}
                {(() => {
                  const cProjs = clientProjects(selected);
                  const totalBudget = cProjs.reduce((s, p) => s + (p.budget || 0), 0);
                  const inExec = cProjs.filter(p => p.status === 'EJECUCION').length;
                  const done   = cProjs.filter(p => p.status === 'FINALIZADO').length;
                  return (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Proyectos', value: cProjs.length, color: 'text-blue-600' },
                        { label: 'En Ejecución', value: inExec, color: 'text-amber-600' },
                        { label: 'Finalizados', value: done, color: 'text-green-600' },
                      ].map(k => (
                        <div key={k.label} className="bg-slate-50 rounded-xl p-3 text-center">
                          <p className={cn('text-xl font-black', k.color)}>{k.value}</p>
                          <p className="text-[7px] font-black text-slate-400 uppercase">{k.label}</p>
                        </div>
                      ))}
                      <div className="col-span-3 bg-slate-50 rounded-xl p-3 flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Presupuesto Total</span>
                        <span className="text-sm font-black text-purple-700">{fmtQ(totalBudget)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Proyectos vinculados */}
                <div>
                  <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Proyectos</h3>
                  <div className="space-y-2">
                    {clientProjects(selected).length === 0 ? (
                      <p className="text-[9px] text-slate-300 font-bold text-center py-4">Sin proyectos registrados</p>
                    ) : clientProjects(selected).map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={cn('w-2 h-2 rounded-full shrink-0',
                          p.status === 'EJECUCION' ? 'bg-amber-400' :
                          p.status === 'FINALIZADO' ? 'bg-green-400' : 'bg-slate-300')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black text-slate-700 uppercase truncate">{p.name}</p>
                          <p className="text-[7px] font-bold text-slate-400 uppercase">{p.status} · {fmtQ(p.budget || 0)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] font-black text-blue-600">{p.progress || 0}%</p>
                          <div className="w-16 h-1 bg-slate-200 rounded mt-0.5">
                            <div className="h-full bg-blue-400 rounded" style={{ width: `${p.progress || 0}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notas */}
                {selected.notes && (
                  <div>
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <FileText size={11} /> Notas
                    </h3>
                    <p className="text-[10px] text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">{selected.notes}</p>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button onClick={() => openEdit(selected)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-700 transition-all">
                    <Pencil size={12} /> Editar
                  </button>
                  <button onClick={() => handleDelete(selected)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-black uppercase hover:bg-red-100 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modal Crear / Editar ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          >
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                <h2 className="text-sm font-black text-white uppercase">{editMode ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded-lg text-white"><X size={16} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nombre Completo / Razón Social *</label>
                    <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold uppercase focus:outline-none focus:border-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tipo</label>
                    <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold uppercase focus:outline-none focus:border-blue-400">
                      <option value="PERSONA">Persona Individual</option>
                      <option value="EMPRESA">Empresa / Jurídico</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">NIT</label>
                    <input value={form.nit} onChange={e => setForm(p => ({ ...p, nit: e.target.value }))} placeholder="CF o número"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold uppercase focus:outline-none focus:border-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Correo</label>
                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Teléfono</label>
                    <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+502"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-blue-400" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dirección</label>
                    <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estado</label>
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold uppercase focus:outline-none focus:border-blue-400">
                      <option value="ACTIVO">Activo</option>
                      <option value="INACTIVO">Inactivo</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Notas</label>
                    <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-blue-400 resize-none" />
                  </div>
                </div>
                <button type="submit" disabled={saving}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-700 transition-all disabled:opacity-50">
                  {saving ? 'Guardando…' : editMode ? 'Guardar Cambios' : 'Registrar Cliente'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {bulkMode && selectedClientIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4">
          <span className="text-[9px] font-black uppercase tracking-widest">{selectedClientIds.size} seleccionado(s)</span>
          <button type="button" onClick={handleBulkDeleteClients}
            className="px-4 py-1.5 bg-white text-red-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-red-50 transition-all">
            Eliminar
          </button>
          <button type="button" onClick={() => setSelectedClientIds(new Set())}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-all">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
