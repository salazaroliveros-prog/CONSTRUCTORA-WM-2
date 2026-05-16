import React, { useState, useEffect, useMemo } from 'react';

import {
  Users, Search, Plus, Trash2, Pencil, X, Building2,
  Phone, Mail, MapPin, FileText, TrendingUp, CheckCircle2,
  AlertCircle, ChevronRight, DollarSign, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client } from '../constants';
import { cn } from '../utils/cn';
import { fmtQ } from '../utils/format';
import { toast } from 'sonner';
import { useStore } from '../store/DataStore';
import { addDocument, updateDocument, deleteDocument, parseError } from '../services/firestoreService';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { sanitizeString, sanitizeEmail, sanitizePhone, sanitizeNIT } from '../utils/sanitize';
import { trackCRUD, trackEvent } from '../utils/logger';

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
  const store = useStore();
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
    setClients(store.clients.items as Client[]);
    setProjects(store.projects.items);
    if (store.clients.items.length > 0) setLoading(false);
  }, [store.clients.items.length, store.projects.items.length]);

  const clientProjects = (client: Client) =>
    projects.filter(p => p.clientName === client.name || p.clientId === client.id);

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
      const sanitizedForm = {
        ...form,
        name: sanitizeString(form.name),
        email: sanitizeEmail(form.email),
        phone: sanitizePhone(form.phone),
        address: sanitizeString(form.address),
        nit: sanitizeNIT(form.nit),
        notes: sanitizeString(form.notes),
      };
      if (editMode && selected) {
        await updateDocument('clients', selected.id, sanitizedForm);
        setSelected(prev => prev ? { ...prev, ...sanitizedForm } : null);
        toast.success('Cliente actualizado');
        trackCRUD('update', 'client', selected.id);
      } else {
        await addDocument('clients', { ...sanitizedForm, projects: [] });
        toast.success('Cliente registrado');
        trackCRUD('create', 'client');
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
      <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-3 p-0 overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        {[
          { icon: <Users size={14} className="text-[var(--color-mod-clients)]" />,      label: 'Clientes Activos',  value: kpis.active,                color: 'text-blue-600' },
          { icon: <Building2 size={14} className="text-amber-500" />, label: 'Con Proyectos',     value: kpis.withProj,              color: 'text-amber-600' },
          { icon: <TrendingUp size={14} className="text-emerald-500" />,label: 'En Ejecución',      value: `${kpis.inExec} proy.`,     color: 'text-emerald-600' },
          { icon: <DollarSign size={14} className="text-purple-500" />,label: 'Presupuesto Total', value: fmtQ(kpis.totalBudget),    color: 'text-purple-600' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div className="flex items-center gap-1.5 mb-1">{k.icon}<span className="text-[7px] font-black text-p-400 uppercase">{k.label}</span></div>
            <p className={cn('stat-value', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-p-400" size={13} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, email o NIT..."
            className="input pl-9 text-xs font-bold" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} title="Filtrar por estado"
          className="select !w-auto text-xs font-bold uppercase">
          <option value="ALL">Todos</option>
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
        </select>
        <Button variant={bulkMode ? "danger" : "ghost"} size="sm" onClick={() => { setBulkMode(!bulkMode); if (bulkMode) setSelectedClientIds(new Set()); }}>
          {bulkMode ? 'Cancelar' : 'Seleccionar'}
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} /> Nuevo Cliente
        </Button>
      </div>

      {/* ── Main: lista + perfil ── */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">

        {/* Lista */}
        <div className={cn('flex flex-col gap-2 overflow-y-auto', selected ? 'w-64 sm:w-80 shrink-0' : 'flex-1')}>
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
                  'card p-3 cursor-pointer',
                  selected?.id === c.id || selectedClientIds.has(c.id) ? 'border-[var(--color-mod-clients)] ring-1 ring-[var(--color-mod-clients)]/20' : ''
                )}
              >
                {bulkMode && (
                  <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedClientIds.has(c.id)} onChange={() => toggleSelectClient(c.id)} aria-label="Seleccionar cliente"
                      className="w-4 h-4 accent-[var(--color-error)] cursor-pointer" />
                  </div>
                )}
                <div className={cn("flex items-center gap-3", bulkMode && "ml-7")}>
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center font-black text-[10px] shrink-0',
                    c.type === 'EMPRESA' ? 'bg-amber-bg text-amber-600' : 'bg-blue-bg text-blue-600')}>
                    {c.type === 'EMPRESA' ? <Building2 size={16} /> : c.name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-p-800 uppercase truncate">{c.name}</p>
                      <span className={cn('badge text-[7px] py-0',
                        isActive ? 'badge-green' : 'badge-neutral')}>
                        {isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <p className="text-[8px] text-p-400 font-bold truncate">{c.email || c.phone || 'Sin contacto'}</p>
                    {c.nit && <p className="text-[7px] text-p-300 font-bold">NIT: {c.nit}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[8px] font-black text-p-500">{cProjs.length} proy.</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); setSelected(c); openEdit(c); }}
                        className="p-1 hover:bg-blue-bg rounded text-p-400 hover:text-blue-600" aria-label="Editar cliente"><Pencil size={11} /></button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(c); }}
                        className="p-1 hover:bg-red-bg rounded text-p-400 hover:text-red-600" aria-label="Eliminar cliente"><Trash2 size={11} /></button>
                    </div>
                    <ChevronRight size={13} className={cn('text-p-300 transition-transform', selected?.id === c.id && 'rotate-90 text-[var(--color-mod-clients)]')} />
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
              className="flex-1 card overflow-y-auto"
            >
              <div className="bg-brand p-5 text-white relative">
                <button onClick={() => setSelected(null)} className="absolute top-3 right-3 p-1 hover:bg-white/10 rounded-lg" aria-label="Cerrar perfil">
                  <X size={14} />
                </button>
                <div className="flex items-center gap-4">
                  <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg',
                    selected.type === 'EMPRESA' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white')}>
                    {selected.type === 'EMPRESA' ? <Building2 size={24} /> : selected.name?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-p-400 uppercase">{selected.type || 'PERSONA'}</p>
                    <h2 className="text-base font-black uppercase">{selected.name}</h2>
                    {selected.nit && <p className="text-[9px] text-p-400">NIT: {selected.nit}</p>}
                  </div>
                </div>
                <div className="flex gap-4 mt-4 text-[8px] font-bold text-p-400 uppercase">
                  {selected.email && <span className="flex items-center gap-1"><Mail size={10} />{selected.email}</span>}
                  {selected.phone && <span className="flex items-center gap-1"><Phone size={10} />{selected.phone}</span>}
                  {selected.address && <span className="flex items-center gap-1"><MapPin size={10} />{selected.address}</span>}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {(() => {
                  const cProjs = clientProjects(selected);
                  const totalBudget = cProjs.reduce((s, p) => s + (p.budget || 0), 0);
                  const inExec = cProjs.filter(p => p.status === 'EJECUCION').length;
                  const done   = cProjs.filter(p => p.status === 'FINALIZADO').length;
                  return (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Proyectos', value: cProjs.length, color: 'text-[var(--color-mod-clients)]' },
                        { label: 'En Ejecución', value: inExec, color: 'text-amber-600' },
                        { label: 'Finalizados', value: done, color: 'text-emerald-600' },
                      ].map(k => (
                        <div key={k.label} className="bg-p-50 rounded-xl p-3 text-center">
                          <p className={cn('text-xl font-black', k.color)}>{k.value}</p>
                          <p className="text-[7px] font-black text-p-400 uppercase">{k.label}</p>
                        </div>
                      ))}
                      <div className="col-span-3 bg-p-50 rounded-xl p-3 flex items-center justify-between">
                        <span className="text-[8px] font-black text-p-400 uppercase">Presupuesto Total</span>
                        <span className="text-sm font-black text-[var(--color-mod-clients)]">{fmtQ(totalBudget)}</span>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <h3 className="text-[9px] font-black text-p-400 uppercase tracking-widest mb-2">Proyectos</h3>
                  <div className="space-y-2">
                    {clientProjects(selected).length === 0 ? (
                      <p className="text-[9px] text-p-300 font-bold text-center py-4">Sin proyectos registrados</p>
                    ) : clientProjects(selected).map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-2.5 bg-p-50 rounded-xl border border-p-100">
                        <div className={cn('w-2 h-2 rounded-full shrink-0',
                          p.status === 'EJECUCION' ? 'bg-amber-400' :
                          p.status === 'FINALIZADO' ? 'bg-emerald-400' : 'bg-p-300')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black text-p-700 uppercase truncate">{p.name}</p>
                          <p className="text-[7px] font-bold text-p-400 uppercase">{p.status} · {fmtQ(p.budget || 0)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] font-black text-[var(--color-mod-clients)]">{p.progress || 0}%</p>
                          <div className="w-16 h-1 bg-p-200 rounded mt-0.5">
                            <div className="h-full bg-blue-400 rounded progress-fill-dynamic" style={{ '--pw': `${p.progress || 0}%` } as React.CSSProperties} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selected.notes && (
                  <div>
                    <h3 className="text-[9px] font-black text-p-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <FileText size={11} /> Notas
                    </h3>
                    <p className="text-[10px] text-p-600 bg-p-50 rounded-xl p-3 border border-p-100">{selected.notes}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-p-100">
                  <Button onClick={() => openEdit(selected)} className="flex-1">
                    <Pencil size={12} /> Editar
                  </Button>
                  <Button variant="danger" onClick={() => handleDelete(selected)} aria-label="Eliminar cliente">
                    <Trash2 size={12} />
                  </Button>
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          >
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-modal w-full max-w-lg overflow-hidden">
              <div className="bg-brand px-6 py-4 flex items-center justify-between">
                <h2 className="text-sm font-black text-white uppercase">{editMode ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded-lg text-white" aria-label="Cerrar formulario"><X size={16} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Input label="Nombre Completo / Razón Social" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nombre completo" />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Tipo</label>
                    <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))} title="Tipo de cliente"
                      className="select">
                      <option value="PERSONA">Persona Individual</option>
                      <option value="EMPRESA">Empresa / Jurídico</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="label">NIT</label>
                    <input value={form.nit} onChange={e => setForm(p => ({ ...p, nit: e.target.value }))} placeholder="CF o número" className="input" />
                  </div>
                  <div>
                    <Input type="email" label="Correo" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="correo@ejemplo.com" />
                  </div>
                  <div>
                    <Input label="Teléfono" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+502" />
                  </div>
                  <div className="col-span-2">
                    <Input label="Dirección" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Dirección física" />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Estado</label>
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))} title="Estado del cliente"
                      className="select">
                      <option value="ACTIVO">Activo</option>
                      <option value="INACTIVO">Inactivo</option>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="label">Notas</label>
                    <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Notas opcionales"
                      className="textarea resize-none" />
                  </div>
                </div>
                <Button type="submit" isLoading={saving} className="w-full">
                  {editMode ? 'Guardar Cambios' : 'Registrar Cliente'}
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {bulkMode && selectedClientIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-modal flex items-center gap-4">
          <span className="text-[9px] font-black uppercase tracking-widest">{selectedClientIds.size} seleccionado(s)</span>
          <button type="button" onClick={handleBulkDeleteClients}
            className="px-4 py-1.5 bg-white text-red-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-red-50 transition-all">
            Eliminar
          </button>
          <button type="button" onClick={() => setSelectedClientIds(new Set())} aria-label="Cancelar selección"
            className="p-1.5 hover:bg-white/20 rounded-lg transition-all">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
