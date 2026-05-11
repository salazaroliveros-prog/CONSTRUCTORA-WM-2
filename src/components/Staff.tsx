/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Plus, Search, Trash2, LayoutGrid, List, HardHat, Pencil,
  X, Phone, Mail, CreditCard, DollarSign, Briefcase, ChevronRight,
  TrendingUp, Calendar, Award, Filter, Download, UserCheck, UserX,
  Building2, BarChart2, CheckCircle2
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

interface StaffMember {
  id: string;
  name: string;
  role: string;
  salary: string | number;
  documentId: string;
  status?: string;
  email?: string;
  phone?: string;
  address?: string;
  hireDate?: string;
  projectIds?: string[];
  notes?: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  progress: number;
  teamIds?: string[];
}

const ROLE_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  'MAESTRO DE OBRA': { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500',  border: 'border-amber-300' },
  'ALBAÑIL':         { bg: 'bg-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-500',   border: 'border-blue-300' },
  'AYUDANTE':        { bg: 'bg-slate-100',   text: 'text-slate-600',  dot: 'bg-slate-400',  border: 'border-slate-300' },
  'RESIDENTE':       { bg: 'bg-purple-100',  text: 'text-purple-700', dot: 'bg-purple-500', border: 'border-purple-300' },
  'PLANIFICADOR':    { bg: 'bg-green-100',   text: 'text-green-700',  dot: 'bg-green-500',  border: 'border-green-300' },
  'ELECTRICISTA':    { bg: 'bg-yellow-100',  text: 'text-yellow-700', dot: 'bg-yellow-500', border: 'border-yellow-300' },
  'PLOMERO':         { bg: 'bg-cyan-100',    text: 'text-cyan-700',   dot: 'bg-cyan-500',   border: 'border-cyan-300' },
  'SUPERVISOR':      { bg: 'bg-red-100',     text: 'text-red-700',    dot: 'bg-red-500',    border: 'border-red-300' },
};
const getRoleColor = (role: string) =>
  ROLE_COLORS[role?.toUpperCase()] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-300' };

const ROLES = ['MAESTRO DE OBRA','ALBAÑIL','AYUDANTE','RESIDENTE','PLANIFICADOR','ELECTRICISTA','PLOMERO','SUPERVISOR'];

// ── Exportar CSV ──────────────────────────────────────────────────────────────
function exportStaffCSV(staff: StaffMember[]) {
  const headers = ['Nombre','Cargo','DPI','Salario','Estado','Email','Teléfono','Fecha Ingreso'];
  const rows = staff.map(m => [
    m.name, m.role, m.documentId,
    Number(m.salary||0).toFixed(2),
    m.status||'Activo', m.email||'', m.phone||'', m.hireDate||''
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'personal.csv'; a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exportado correctamente');
}

export default function StaffModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [member, setMember] = useState({ name: '', role: '', salary: '', documentId: '', email: '', phone: '', hireDate: '' });
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: '', salary: '', documentId: '', status: 'Activo', email: '', phone: '', hireDate: '', notes: '' });
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  const [filterProject, setFilterProject] = useState<string>('');

  const cardPageSize = useAutoPageSize(140, 280, 4);
  const tablePageSize = useAutoPageSize(44, 220, 6);
  const pageSize = viewMode === 'table' ? tablePageSize : cardPageSize;

  useEffect(() => {
    const unsub1 = subscribeToCollection('staff', (data) => { setStaff(data); setLoading(false); });
    const unsub2 = subscribeToCollection('projects', (data) => setProjects(data));
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleDelete = (id: string) => {
    const m = staff.find(s => s.id === id);
    const assignedProjects = projects.filter(p => p.teamIds?.includes(id));
    const desc = assignedProjects.length > 0
      ? `Está asignado a ${assignedProjects.length} proyecto(s). Esta acción no se puede deshacer.`
      : 'Esta acción no se puede deshacer.';
    toast('¿Eliminar colaborador?', {
      description: desc,
      action: { label: 'Eliminar', onClick: async () => { try { await deleteDocument('staff', id); if (selectedMember?.id === id) setSelectedMember(null); toast.success('Colaborador eliminado'); } catch (e: any) { toast.error('Error al eliminar', { description: parseError(e) }); } } },
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
        try { await addDocument('staff', { ...member, status: 'Activo' }); setIsModalOpen(false); setMember({ name: '', role: '', salary: '', documentId: '', email: '', phone: '', hireDate: '' }); toast.success('Colaborador registrado'); }
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
          if (selectedMember?.id === editMember.id) setSelectedMember({ ...editMember, ...editForm });
          toast.success('Colaborador actualizado');
        } catch (err) { toast.error('Error', { description: parseError(err) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  // Asignar/desasignar personal a proyecto
  const handleToggleProject = async (memberId: string, projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const currentTeam = project.teamIds || [];
    const isAssigned = currentTeam.includes(memberId);
    const newTeam = isAssigned ? currentTeam.filter(id => id !== memberId) : [...currentTeam, memberId];
    try {
      await updateDocument('projects', projectId, { teamIds: newTeam });
      toast.success(isAssigned ? 'Removido del proyecto' : 'Asignado al proyecto');
    } catch (err) { toast.error('Error al actualizar asignación'); }
  };

  const filtered = useMemo(() => staff.filter(s => {
    const matchSearch = s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.documentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = !filterRole || s.role?.toUpperCase() === filterRole;
    const matchStatus = filterStatus === 'Todos' || (s.status || 'Activo') === filterStatus;
    const matchProject = !filterProject || projects.find(p => p.id === filterProject)?.teamIds?.includes(s.id);
    return matchSearch && matchRole && matchStatus && matchProject;
  }), [staff, searchTerm, filterRole, filterStatus, filterProject, projects]);

  const { currentItems, currentPage, totalPages, nextPage, prevPage, goToPage, startIndex, totalItems } =
    usePagination<StaffMember>(filtered, pageSize);

  const totalSalary = staff.reduce((a, s) => a + Number(s.salary || 0), 0);
  const activeCount = staff.filter(s => (s.status || 'Activo') === 'Activo').length;
  const assignedCount = staff.filter(s => projects.some(p => p.teamIds?.includes(s.id))).length;

  // KPIs por rol
  const salaryByRole = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    staff.forEach(s => {
      const r = s.role || 'Sin cargo';
      if (!map[r]) map[r] = { count: 0, total: 0 };
      map[r].count++;
      map[r].total += Number(s.salary || 0);
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [staff]);

  // Proyectos del miembro seleccionado
  const memberProjects = useMemo(() =>
    selectedMember ? projects.filter(p => p.teamIds?.includes(selectedMember.id)) : [],
    [selectedMember, projects]
  );

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
          { label: 'Total Personal', value: staff.length, icon: <Users size={14}/>, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Activos', value: activeCount, icon: <UserCheck size={14}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Asignados', value: assignedCount, icon: <Building2 size={14}/>, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Nómina Total', value: `Q ${totalSalary.toLocaleString('es-GT')}`, icon: <DollarSign size={14}/>, color: 'text-amber-600', bg: 'bg-amber-50' },
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
          <div className="p-2.5 bg-slate-900 text-secondary rounded-xl shrink-0"><HardHat size={18} /></div>
          <div className="text-left">
            <h2 className="text-sm font-black text-primary tracking-widest uppercase leading-none">Recursos Humanos</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{filtered.length} de {staff.length} colaboradores</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          {/* Filtro Rol */}
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} title="Filtrar por cargo"
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
            <option value="">TODOS LOS CARGOS</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {/* Filtro Estado */}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} title="Filtrar por estado"
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
            <option value="Todos">TODOS</option>
            <option value="Activo">ACTIVOS</option>
            <option value="Inactivo">INACTIVOS</option>
          </select>
          {/* Filtro Proyecto */}
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} title="Filtrar por proyecto"
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
            <option value="">TODOS LOS PROYECTOS</option>
            {projects.filter(p => p.status === 'EJECUCION').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
            <input type="text" placeholder="BUSCAR PERSONAL..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} title="Buscar personal"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <button type="button" onClick={() => exportStaffCSV(staff)} title="Exportar CSV"
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
        <div className={cn("flex flex-col min-h-0 transition-all duration-300", selectedMember ? "flex-1" : "w-full")}>
          <div className="flex-1 min-h-0 overflow-hidden">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 h-full content-start overflow-y-auto">
                {currentItems.map((m, i) => {
                  const rc = getRoleColor(m.role);
                  const initials = m.name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?';
                  const isSelected = selectedMember?.id === m.id;
                  const assignedToProjects = projects.filter(p => p.teamIds?.includes(m.id));
                  return (
                    <motion.div key={m.id}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.04 }}
                      onClick={() => setSelectedMember(isSelected ? null : m)}
                      className={cn("group bg-white border rounded-xl p-3 hover:shadow-md transition-all cursor-pointer",
                        isSelected ? "border-secondary shadow-md ring-2 ring-secondary/20" : "border-slate-100 hover:border-secondary/30")}>
                      <div className="flex items-start gap-2.5">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black text-[11px] shrink-0 shadow-md",
                          isSelected ? "bg-secondary text-primary" : "bg-slate-900 text-secondary")}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-primary uppercase truncate group-hover:text-secondary transition-colors">{m.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                            <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded ${rc.bg} ${rc.text}`}>{m.role || 'Sin cargo'}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                          <button type="button" title="Editar" onClick={() => { setEditMember(m); setEditForm({ name: m.name, role: m.role, salary: String(m.salary), documentId: m.documentId, status: m.status || 'Activo', email: m.email||'', phone: m.phone||'', hireDate: m.hireDate||'', notes: m.notes||'' }); }} className="btn-edit"><Pencil size={11} /></button>
                          <button type="button" title="Eliminar" onClick={() => handleDelete(m.id)} className="btn-delete"><Trash2 size={11} /></button>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2.5 border-t border-slate-50 flex items-center justify-between">
                        <div>
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Salario</p>
                          <p className="text-[10px] font-black text-primary">Q {Number(m.salary || 0).toLocaleString('es-GT')}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {assignedToProjects.length > 0 && (
                            <span className="text-[7px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{assignedToProjects.length} proy.</span>
                          )}
                          <span className={cn("text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full",
                            m.status === 'Activo' || !m.status ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                            {m.status || 'Activo'}
                          </span>
                        </div>
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
                        <th className="hidden md:table-cell px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Proyectos</th>
                        <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Salario (Q)</th>
                        <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                        <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {currentItems.map((m, i) => {
                        const rc = getRoleColor(m.role);
                        const initials = m.name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?';
                        const assignedToProjects = projects.filter(p => p.teamIds?.includes(m.id));
                        const isSelected = selectedMember?.id === m.id;
                        return (
                          <motion.tr key={m.id}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: i * 0.03 }}
                            onClick={() => setSelectedMember(isSelected ? null : m)}
                            className={cn("hover:bg-slate-50/50 transition-colors group cursor-pointer",
                              isSelected && "bg-secondary/5 border-l-2 border-secondary")}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center font-black text-[8px] shrink-0",
                                  isSelected ? "bg-secondary text-primary" : "bg-slate-900 text-secondary")}>{initials}</div>
                                <span className="text-[10px] font-black text-primary uppercase truncate max-w-[120px]">{m.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded", rc.bg, rc.text)}>{m.role || '--'}</span>
                            </td>
                            <td className="hidden sm:table-cell px-4 py-2.5 text-[9px] text-slate-500 font-bold">{m.documentId || '--'}</td>
                            <td className="hidden md:table-cell px-4 py-2.5">
                              {assignedToProjects.length > 0
                                ? <span className="text-[8px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{assignedToProjects.length} proyecto{assignedToProjects.length > 1 ? 's' : ''}</span>
                                : <span className="text-[8px] text-slate-300 font-bold">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-[10px] font-black text-primary">
                              {Number(m.salary || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={cn("text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full",
                                m.status === 'Activo' || !m.status ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                                {m.status || 'Activo'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex gap-1 justify-end">
                                <button type="button" title="Editar" onClick={() => { setEditMember(m); setEditForm({ name: m.name, role: m.role, salary: String(m.salary), documentId: m.documentId, status: m.status || 'Activo', email: m.email||'', phone: m.phone||'', hireDate: m.hireDate||'', notes: m.notes||'' }); }} className="btn-edit"><Pencil size={12} /></button>
                                <button type="button" title="Eliminar" onClick={() => handleDelete(m.id)} className="btn-delete"><Trash2 size={12} /></button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="py-12 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin personal registrado</td></tr>
                      )}
                    </tbody>
                    {filtered.length > 0 && (
                      <tfoot className="sticky bottom-0 bg-slate-50 border-t border-slate-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Nómina ({staff.length} colaboradores)</td>
                          <td className="px-4 py-2 text-right text-[10px] font-black text-secondary">{totalSalary.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    )}
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

        {/* Side Panel - Perfil del colaborador */}
        <AnimatePresence>
          {selectedMember && (
            <motion.div
              initial={{ opacity: 0, x: 40, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 300 }}
              exit={{ opacity: 0, x: 40, width: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="shrink-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col"
              style={{ minWidth: 260, maxWidth: 300 }}>
              <div className="bg-slate-900 p-4 relative">
                <button type="button" title="Cerrar panel" onClick={() => setSelectedMember(null)}
                  className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                  <X size={14} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-primary font-black text-sm shadow-lg">
                    {selectedMember.name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white uppercase leading-tight">{selectedMember.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {(() => { const rc = getRoleColor(selectedMember.role); return (
                        <span className={cn("text-[7px] font-black uppercase px-1.5 py-0.5 rounded", rc.bg, rc.text)}>{selectedMember.role || 'Sin cargo'}</span>
                      ); })()}
                      <span className={cn("text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full",
                        (selectedMember.status || 'Activo') === 'Activo' ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300")}>
                        {selectedMember.status || 'Activo'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                    <p className="text-[7px] font-black text-amber-600 uppercase tracking-widest">Salario</p>
                    <p className="text-xs font-black text-amber-700">Q {Number(selectedMember.salary||0).toLocaleString('es-GT')}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                    <p className="text-[7px] font-black text-blue-600 uppercase tracking-widest">Proyectos</p>
                    <p className="text-xs font-black text-blue-700">{memberProjects.length}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Información</p>
                  <div className="space-y-1.5">
                    {[
                      { icon: <CreditCard size={10}/>, label: 'DPI', value: selectedMember.documentId },
                      { icon: <Phone size={10}/>, label: 'Tel', value: selectedMember.phone },
                      { icon: <Mail size={10}/>, label: 'Email', value: selectedMember.email },
                      { icon: <Calendar size={10}/>, label: 'Ingreso', value: selectedMember.hireDate },
                    ].map((item, i) => item.value ? (
                      <div key={i} className="flex items-center gap-2 text-[9px]">
                        <span className="text-slate-400 shrink-0">{item.icon}</span>
                        <span className="text-slate-500 font-bold shrink-0">{item.label}:</span>
                        <span className="text-primary font-black truncate">{item.value}</span>
                      </div>
                    ) : null)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Proyectos Asignados</p>
                    <span className="text-[7px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                      {memberProjects.length} activo{memberProjects.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {memberProjects.length === 0 ? (
                    <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      <Building2 size={16} className="mx-auto mb-1 text-slate-300" />
                      <p className="text-[9px] text-slate-300 font-bold italic">Sin proyectos asignados</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {memberProjects.map(p => (
                        <div key={p.id} className="bg-slate-50 rounded-lg p-2 flex items-center justify-between hover:bg-slate-100 transition-all group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <p className="text-[9px] font-black text-primary uppercase truncate">{p.name}</p>
                              <span className={cn("text-[6px] font-black uppercase px-1 py-0.5 rounded-full",
                                p.status === 'EJECUCION' ? "bg-secondary/20 text-secondary" :
                                p.status === 'COTIZACION' ? "bg-blue-100 text-blue-600" :
                                "bg-green-100 text-green-600")}>
                                {p.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <div className="flex-1 bg-slate-200 rounded-full h-1">
                                <div className="bg-secondary h-1 rounded-full transition-all" style={{ width: `${p.progress || 0}%` }} />
                              </div>
                              <span className="text-[7px] font-black text-slate-500">{p.progress || 0}%</span>
                            </div>
                          </div>
                          <button type="button" title="Remover del proyecto"
                            onClick={() => handleToggleProject(selectedMember.id, p.id)}
                            className="ml-2 p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-all shrink-0 opacity-0 group-hover:opacity-100">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Asignar a Proyecto</p>
                  <div className="space-y-1">
                    {projects.filter(p => p.status === 'EJECUCION' && !p.teamIds?.includes(selectedMember.id)).slice(0, 5).map(p => (
                      <button type="button" key={p.id} onClick={() => handleToggleProject(selectedMember.id, p.id)}
                        className="w-full flex items-center justify-between bg-slate-50 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-lg p-2 transition-all group">
                        <span className="text-[9px] font-black text-primary uppercase truncate">{p.name}</span>
                        <Plus size={10} className="text-slate-400 group-hover:text-blue-600 shrink-0" />
                      </button>
                    ))}
                    {projects.filter(p => p.status === 'EJECUCION' && !p.teamIds?.includes(selectedMember.id)).length === 0 && (
                      <p className="text-[9px] text-slate-300 font-bold italic">No hay proyectos disponibles</p>
                    )}
                  </div>
                </div>
                {selectedMember.notes && (
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Notas</p>
                    <p className="text-[9px] text-slate-600 bg-slate-50 rounded-lg p-2">{selectedMember.notes}</p>
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-slate-100 flex gap-2">
                <button type="button" onClick={() => { setEditMember(selectedMember); setEditForm({ name: selectedMember.name, role: selectedMember.role, salary: String(selectedMember.salary), documentId: selectedMember.documentId, status: selectedMember.status || 'Activo', email: selectedMember.email||'', phone: selectedMember.phone||'', hireDate: selectedMember.hireDate||'', notes: selectedMember.notes||'' }); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all">
                  <Pencil size={11} /> Editar
                </button>
                <button type="button" title="Eliminar colaborador" onClick={() => handleDelete(selectedMember.id)}
                  className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Modal Crear */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Nuevo Colaborador">
        <form onSubmit={handleCreate} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo *</label>
            <input type="text" required placeholder="NOMBRE DEL TRABAJADOR" value={member.name}
              onChange={e => setMember({ ...member, name: e.target.value })} title="Nombre completo"
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo / Puesto</label>
              <select value={member.role} onChange={e => setMember({ ...member, role: e.target.value })} title="Cargo o puesto"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                <option value="">SELECCIONAR...</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">DPI / Cédula</label>
              <input type="text" placeholder="DOCUMENTO ID" value={member.documentId}
                onChange={e => setMember({ ...member, documentId: e.target.value })} title="Número de DPI"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Salario Base (Q)</label>
              <input type="number" placeholder="0.00" value={member.salary}
                onChange={e => setMember({ ...member, salary: e.target.value })} title="Salario mensual"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Ingreso</label>
              <input type="date" value={member.hireDate}
                onChange={e => setMember({ ...member, hireDate: e.target.value })} title="Fecha de ingreso"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
              <input type="tel" placeholder="+502 0000-0000" value={member.phone}
                onChange={e => setMember({ ...member, phone: e.target.value })} title="Teléfono"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
              <input type="email" placeholder="correo@ejemplo.com" value={member.email}
                onChange={e => setMember({ ...member, email: e.target.value })} title="Correo electrónico"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all disabled:opacity-50">
            {saving ? 'PROCESANDO...' : 'GUARDAR COLABORADOR'}
          </button>
        </form>
      </Modal>

      {/* Modal Editar */}
      <Modal isOpen={!!editMember} onClose={() => setEditMember(null)} title="Editar Colaborador">
        <form onSubmit={handleEditStaff} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label>
            <input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} title="Nombre completo"
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo</label>
              <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} title="Cargo"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                <option value="">SELECCIONAR...</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">DPI</label>
              <input type="text" value={editForm.documentId} onChange={e => setEditForm({ ...editForm, documentId: e.target.value })} title="DPI"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Salario (Q)</label>
              <input type="number" value={editForm.salary} onChange={e => setEditForm({ ...editForm, salary: e.target.value })} title="Salario"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</label>
              <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} title="Estado"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                <option>Activo</option><option>Inactivo</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
              <input type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} title="Teléfono"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
              <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} title="Email"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Ingreso</label>
              <input type="date" value={editForm.hireDate} onChange={e => setEditForm({ ...editForm, hireDate: e.target.value })} title="Fecha de ingreso"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Notas</label>
              <input type="text" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} title="Notas"
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
            </div>
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all">GUARDAR CAMBIOS</button>
        </form>
      </Modal>
    </div>
  );
}

