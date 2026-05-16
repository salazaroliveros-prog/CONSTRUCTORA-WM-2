/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, Plus, Search, Trash2, LayoutGrid, List, HardHat, Pencil,
  X, Phone, Mail, CreditCard, DollarSign, Briefcase, ChevronRight,
  TrendingUp, Calendar, Award, Filter, Download, UserCheck, UserX,
  Building2, BarChart2, CheckCircle2, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils/cn';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument, checkUniqueField, parseError } from '../services/firestoreService';
import { usePagination } from '../hooks/usePagination';
import { useAutoPageSize } from '../hooks/useAutoPageSize';
import Pagination from './ui/Pagination';
import { Modal } from './ui/Modal';
import { toast } from 'sonner';
import { Payroll, PayrollEmployee, Transaction } from '../constants';
import { sanitizeString } from '../utils/sanitize';
import { trackCRUD, trackEvent } from '../utils/logger';

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

  // Bulk select
  const [selectedPersonalIds, setSelectedPersonalIds] = useState<Set<string>>(new Set());
  const [selectedPayrollIds, setSelectedPayrollIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Payroll state
  const [activeStaffTab, setActiveStaffTab] = useState<'personal' | 'planillas'>('personal');
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [payrollForm, setPayrollForm] = useState<{ projectId: string; period: string; type: 'CAMPO' | 'ADMINISTRATIVO'; employees: PayrollEmployee[]; notes: string }>({
    projectId: '', period: new Date().toISOString().slice(0, 7), type: 'CAMPO', employees: [], notes: ''
  });
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);
  const [editingPayrollForm, setEditingPayrollForm] = useState<{ employees: PayrollEmployee[]; notes: string }>({ employees: [], notes: '' });
  const [savingEditPayroll, setSavingEditPayroll] = useState(false);

  // Validation
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateUniqueFields = async (data: any, excludeId?: string): Promise<boolean> => {
    const errors: Record<string, string> = {};
    if (data.documentId) {
      const dpiExists = await checkUniqueField('staff', 'documentId', data.documentId, excludeId);
      if (dpiExists) errors.documentId = 'Este DPI ya está registrado';
    }
    if (data.email) {
      const emailExists = await checkUniqueField('staff', 'email', data.email.toLowerCase().trim(), excludeId);
      if (emailExists) errors.email = 'Este email ya está registrado';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const cardPageSize = useAutoPageSize(125, 250, 5);
  const tablePageSize = useAutoPageSize(36, 180, 6);
  const pageSize = viewMode === 'table' ? tablePageSize : cardPageSize;

  useEffect(() => {
    const unsub1 = subscribeToCollection('staff', (data) => { setStaff(data); setLoading(false); });
    const unsub2 = subscribeToCollection('projects', (data) => setProjects(data));
    const unsub3 = subscribeToCollection('payrolls', (data) => setPayrolls(data));
    return () => { unsub1(); unsub2(); unsub3(); };
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

  const toggleSelectPersonal = (id: string) => {
    setSelectedPersonalIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPersonal = () => {
    if (selectedPersonalIds.size === currentItems.length) {
      setSelectedPersonalIds(new Set());
    } else {
      setSelectedPersonalIds(new Set(currentItems.map(m => m.id)));
    }
  };

  const handleBulkDeletePersonal = () => {
    if (selectedPersonalIds.size === 0) return;
    const desc = `${selectedPersonalIds.size} colaborador(es) serán eliminados.`;
    toast('¿Eliminar seleccionados?', {
      description: desc,
      action: { label: 'Eliminar Todo', onClick: async () => {
        try {
          for (const id of selectedPersonalIds) await deleteDocument('staff', id);
          toast.success(`${selectedPersonalIds.size} colaborador(es) eliminados`);
          setSelectedPersonalIds(new Set());
        } catch (e: any) { toast.error('Error', { description: parseError(e) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const toggleSelectPayroll = (id: string) => {
    setSelectedPayrollIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPayroll = () => {
    if (selectedPayrollIds.size === payrolls.length) {
      setSelectedPayrollIds(new Set());
    } else {
      setSelectedPayrollIds(new Set(payrolls.map(p => p.id)));
    }
  };

  const handleBulkDeletePayroll = () => {
    if (selectedPayrollIds.size === 0) return;
    toast('¿Eliminar planillas seleccionadas?', {
      description: `${selectedPayrollIds.size} planilla(s) serán eliminadas.`,
      action: { label: 'Eliminar Todo', onClick: async () => {
        try {
          for (const id of selectedPayrollIds) await deleteDocument('payrolls', id);
          toast.success(`${selectedPayrollIds.size} planilla(s) eliminadas`);
          setSelectedPayrollIds(new Set());
        } catch (e: any) { toast.error('Error', { description: parseError(e) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleDeletePayroll = (payrollId: string) => {
    toast('¿Eliminar planilla?', {
      description: 'Esta acción no se puede deshacer.',
      action: { label: 'Eliminar', onClick: async () => {
        try {
          await deleteDocument('payrolls', payrollId);
          if (selectedPayroll?.id === payrollId) setSelectedPayroll(null);
          toast.success('Planilla eliminada');
        } catch (e: any) { toast.error('Error', { description: parseError(e) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const openEditPayroll = (payroll: Payroll) => {
    setEditingPayroll(payroll);
    setEditingPayrollForm({ employees: JSON.parse(JSON.stringify(payroll.employees)), notes: payroll.notes || '' });
  };

  const saveEditPayroll = async () => {
    if (!editingPayroll) return;
    setSavingEditPayroll(true);
    try {
      const totalGross = editingPayrollForm.employees.reduce((a, e) => a + e.grossPay, 0);
      const totalDeductions = editingPayrollForm.employees.reduce((a, e) => a + e.deductions, 0);
      const totalBonuses = editingPayrollForm.employees.reduce((a, e) => a + e.bonuses, 0);
      const totalNet = editingPayrollForm.employees.reduce((a, e) => a + e.netPay, 0);
      await updateDocument('payrolls', editingPayroll.id, {
        employees: editingPayrollForm.employees,
        totalGross: Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalBonuses: Math.round(totalBonuses * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        notes: editingPayrollForm.notes,
      });
      toast.success('Planilla actualizada');
      setEditingPayroll(null);
    } catch (e) {
      toast.error('Error al actualizar', { description: parseError(e) });
    } finally {
      setSavingEditPayroll(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member.name) return;
    setValidationErrors({});
    if (!(await validateUniqueFields(member))) {
      return;
    }
    toast('¿Registrar colaborador?', {
      description: member.name,
      action: { label: 'Guardar', onClick: async () => {
        if (!(await validateUniqueFields(member))) {
          toast.error('Error de validación', { description: Object.values(validationErrors).join('. ') });
          return;
        }
        setSaving(true);
        try { await addDocument('staff', { ...member, status: 'Activo' }); setIsModalOpen(false); setMember({ name: '', role: '', salary: '', documentId: '', email: '', phone: '', hireDate: '' }); setValidationErrors({}); toast.success('Colaborador registrado'); }
        catch (error) { toast.error('Error al registrar', { description: parseError(error) }); }
        finally { setSaving(false); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  const handleEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setValidationErrors({});
    if (!(await validateUniqueFields(editForm, editMember.id))) {
      toast.error('Error de validación', { description: Object.values(validationErrors).join('. ') });
      return;
    }
    toast('Guardar cambios?', {
      description: editForm.name,
      action: { label: 'Confirmar', onClick: async () => {
        // Re-validate before save (race condition protection)
        if (!(await validateUniqueFields(editForm, editMember.id))) {
          toast.error('Error de validación', { description: Object.values(validationErrors).join('. ') });
          return;
        }
        try {
          await updateDocument('staff', editMember.id, editForm);
          setEditMember(null);
          setValidationErrors({});
          if (selectedMember?.id === editMember.id) setSelectedMember({ ...editMember, ...editForm });
          toast.success('Colaborador actualizado');
        } catch (err) { toast.error('Error', { description: parseError(err) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };

  // ── Planillas ─────────────────────────────────────────────────────────────
  const calcPayrollEmployees = (projectId: string, type: 'CAMPO' | 'ADMINISTRATIVO') => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return [];
    const activeStaff = staff.filter(s => (s.status || 'Activo') === 'Activo');
    return activeStaff.map(s => {
      const baseSalary = Number(s.salary || 0);
      const daysInMonth = 30;
      const dailySalary = baseSalary / daysInMonth;
      const daysWorked = daysInMonth;
      const grossPay = dailySalary * daysWorked;
      const igss = grossPay * 0.0483;
      const irtra = grossPay * 0.01;
      const intecap = grossPay * 0.01;
      const deductions = igss + irtra + intecap;
      const bonuses = 0;
      const netPay = grossPay - deductions + bonuses;
      return {
        staffId: s.id,
        name: s.name,
        role: s.role,
        baseSalary,
        daysWorked,
        dailySalary: Math.round(dailySalary * 100) / 100,
        grossPay: Math.round(grossPay * 100) / 100,
        igss: Math.round(igss * 100) / 100,
        irtra: Math.round(irtra * 100) / 100,
        intecap: Math.round(intecap * 100) / 100,
        bonuses: 0,
        deductions: Math.round(deductions * 100) / 100,
        netPay: Math.round(netPay * 100) / 100,
      };
    });
  };

  const generatePayrollPreview = () => {
    const emps = calcPayrollEmployees(payrollForm.projectId, payrollForm.type);
    setPayrollForm(f => ({ ...f, employees: emps }));
    if (emps.length === 0) toast.error('No hay personal activo asignado a este proyecto');
    else toast.success(`Planilla precalculada: ${emps.length} empleado(s)`);
  };

  const createPayroll = async () => {
    if (!payrollForm.projectId || payrollForm.employees.length === 0) {
      toast.error('Selecciona un proyecto y genera la previsualización primero');
      return;
    }
    setSavingPayroll(true);
    try {
      const totalGross = payrollForm.employees.reduce((a, e) => a + e.grossPay, 0);
      const totalDeductions = payrollForm.employees.reduce((a, e) => a + e.deductions, 0);
      const totalBonuses = payrollForm.employees.reduce((a, e) => a + e.bonuses, 0);
      const totalNet = payrollForm.employees.reduce((a, e) => a + e.netPay, 0);
      const project = projects.find(p => p.id === payrollForm.projectId);
      await addDocument('payrolls', {
        projectId: payrollForm.projectId,
        projectName: project?.name || '',
        period: payrollForm.period,
        type: payrollForm.type,
        employees: payrollForm.employees,
        totalGross: Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalBonuses: Math.round(totalBonuses * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        status: 'BORRADOR',
        createdAt: new Date().toISOString(),
        notes: payrollForm.notes,
      });
      toast.success('Planilla creada como BORRADOR');
      setIsPayrollModalOpen(false);
      setPayrollForm({ projectId: '', period: new Date().toISOString().slice(0, 7), type: 'CAMPO', employees: [], notes: '' });
    } catch (e) {
      toast.error('Error al crear planilla', { description: parseError(e) });
    } finally {
      setSavingPayroll(false);
    }
  };

  const markPayrollAsPaid = async (payroll: Payroll) => {
    toast('¿Marcar planilla como PAGADA?', {
      description: `Q ${payroll.totalNet.toLocaleString('es-GT')} — Se registrará el gasto automáticamente.`,
      action: { label: 'Pagar', onClick: async () => {
        try {
          await updateDocument('payrolls', payroll.id, { status: 'PAGADA', paidAt: new Date().toISOString() });
          await addDocument('transactions', {
            date: new Date().toISOString().split('T')[0],
            amount: payroll.totalNet,
            description: `Planilla ${payroll.type} — ${payroll.projectName} (${payroll.period})`,
            type: 'GASTO',
            category: payroll.type === 'CAMPO' ? 'Mano de Obra' : 'Personales',
            projectId: payroll.projectId,
            createdAt: new Date().toISOString(),
          });
          toast.success('Planilla pagada y gasto registrado');
        } catch (e) { toast.error('Error', { description: parseError(e) }); }
      }},
      cancel: { label: 'Cancelar', onClick: () => {} }
    });
  };
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
    <div className="flex flex-col h-full gap-4 animate-in fade-in duration-500 pb-[calc(4rem+env(safe-area-inset-bottom,0))]">

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
{[
          { label: 'Total Personal', value: staff.length, icon: <Users size={12}/>, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Activos', value: activeCount, icon: <UserCheck size={12}/>, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Asignados', value: assignedCount, icon: <Building2 size={12}/>, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Nómina Total', value: `Q ${totalSalary.toLocaleString('es-GT')}`, icon: <DollarSign size={12}/>, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((kpi, i) => (
           <motion.div key={i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
             className="bg-white rounded-lg border border-slate-100 p-2 flex items-center gap-2 shadow-sm">
             <div className={cn('p-1.5 rounded-md shrink-0', kpi.bg, kpi.color)}>{kpi.icon}</div>
             <div className="min-w-0">
               <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
               <p className="text-sm font-black text-primary truncate">{kpi.value}</p>
             </div>
           </motion.div>
         ))}
      </div>

      {/* Toolbar */}
<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0">
         <div className="flex items-center gap-2">
           <div className="p-2 bg-slate-900 text-secondary rounded-lg shrink-0"><HardHat size={16} /></div>
           <div className="text-left">
             <div className="flex items-center gap-2">
               <h2 className="text-sm font-black text-primary tracking-widest uppercase leading-none">Recursos Humanos</h2>
               <div className="flex bg-slate-100 p-0.5 rounded-lg">
                 <button type="button" onClick={() => setActiveStaffTab('personal')}
                   className={`px-2 py-0.5 text-[7px] font-black uppercase rounded-md transition-all ${activeStaffTab === 'personal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                   Personal
                 </button>
                 <button type="button" onClick={() => setActiveStaffTab('planillas')}
                   className={`px-2 py-0.5 text-[7px] font-black uppercase rounded-md transition-all ${activeStaffTab === 'planillas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                   Planillas
                 </button>
               </div>
             </div>
             <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
               {activeStaffTab === 'personal'
                 ? `${filtered.length} de ${staff.length} colaboradores`
                 : `${payrolls.length} planilla(s) registradas`}
             </p>
           </div>
         </div>
          <div className="flex flex-wrap gap-1.5 w-full md:w-auto items-center overflow-x-auto">
          {activeStaffTab === 'personal' ? (
            <>
<select value={filterRole} onChange={e => setFilterRole(e.target.value)} title="Filtrar por cargo"
                 className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[7px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                <option value="">TODOS LOS CARGOS</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
<select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} title="Filtrar por estado"
                 className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[7px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                <option value="Todos">TODOS</option>
                <option value="Activo">ACTIVOS</option>
                <option value="Inactivo">INACTIVOS</option>
              </select>
<select value={filterProject} onChange={e => setFilterProject(e.target.value)} title="Filtrar por proyecto"
                 className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[7px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                <option value="">TODOS LOS PROYECTOS</option>
                {projects.filter(p => p.status === 'EJECUCION').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="flex bg-slate-100 p-0.5 rounded-xl gap-0.5">
<button type="button" onClick={() => setViewMode('grid')} title="Cuadrícula"
                   className={`p-1 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                   <LayoutGrid size={13} />
                 </button>
                 <button type="button" onClick={() => setViewMode('table')} title="Tabla"
                   className={`p-1 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                   <List size={13} />
                 </button>
              </div>
<button type="button" title="Selección múltiple" onClick={() => { setBulkMode(!bulkMode); if (bulkMode) setSelectedPersonalIds(new Set()); }}
                 className={`px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest transition-all ${bulkMode ? 'bg-red-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
                {bulkMode ? 'Cancelar' : 'Seleccionar'}
              </button>
<div className="relative flex-1 md:w-48">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                 <input type="text" placeholder="BUSCAR PERSONAL..." value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)} title="Buscar personal"
                   className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
               </div>
               <button type="button" onClick={() => exportStaffCSV(staff)} title="Exportar CSV"
                 className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all">
                 <Download size={12} />
               </button>
               <button type="button" onClick={() => setIsModalOpen(true)}
                 className="flex items-center gap-1 px-2 py-1.5 bg-primary text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shrink-0">
                 <Plus size={12} /> Nuevo
               </button>
            </>
          ) : (
            <>
              <button type="button" title="Selección múltiple" onClick={() => { setBulkMode(!bulkMode); if (bulkMode) setSelectedPayrollIds(new Set()); }}
                className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${bulkMode ? 'bg-red-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:text-slate-800'}`}>
                {bulkMode ? 'Cancelar' : 'Seleccionar'}
              </button>
              <button type="button" onClick={() => setIsPayrollModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shrink-0">
                <Plus size={14} /> Nueva Planilla
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main layout: list + side panel */}
      <div className="flex flex-1 min-h-0 gap-4">
        {activeStaffTab === 'personal' ? (
          <>
            <div className={cn("flex flex-col min-h-0 transition-all duration-300", selectedMember ? "flex-1" : "w-full")}>
              {/* ... staff list (existing code from here to the closing of the personal tab block) ... */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 h-full content-start overflow-y-auto">
                {currentItems.map((m, i) => {
                  const rc = getRoleColor(m.role);
                  const initials = m.name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?';
                  const isSelected = selectedMember?.id === m.id;
                  const assignedToProjects = projects.filter(p => p.teamIds?.includes(m.id));
                  return (
                    <motion.div key={m.id}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.04 }}
                      onClick={() => { if (bulkMode) { toggleSelectPersonal(m.id); } else { setSelectedMember(isSelected ? null : m); } }}
                      className={cn("group bg-white border rounded-xl p-3 hover:shadow-md transition-all cursor-pointer relative",
                        isSelected ? "border-secondary shadow-md ring-2 ring-secondary/20" : "border-slate-100 hover:border-secondary/30")}>
                      {bulkMode && (
                        <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedPersonalIds.has(m.id)} onChange={() => toggleSelectPersonal(m.id)} title="Seleccionar personal"
                            className="w-4 h-4 accent-red-500 cursor-pointer" />
                        </div>
                      )}
                      <div className={cn("flex items-start gap-2.5", bulkMode && "ml-6")}>
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
                    <div className="col-span-full py-12 text-center opacity-20">
                      <Users size={36} className="mx-auto mb-2" />
                      <p className="text-[9px] font-black uppercase tracking-widest">Sin personal registrado</p>
                    </div>
                  )}
              </div>
            ) : (
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
                 <div className="overflow-auto flex-1">
                   <table className="w-full text-left">
                     <thead className="sticky top-0 bg-slate-50 z-10">
                       <tr className="border-b border-slate-100">
                         {bulkMode && (
                           <th className="px-2 py-2 w-6">
<input type="checkbox" checked={currentItems.length > 0 && selectedPersonalIds.size === currentItems.length}
                                onChange={toggleSelectAllPersonal} title="Seleccionar todo" className="w-3.5 h-3.5 accent-red-500 cursor-pointer" />
                           </th>
                         )}
                         <th className="px-3 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                         <th className="px-3 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest">Cargo</th>
                         <th className="hidden sm:table-cell px-3 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest">DPI / Cédula</th>
                         <th className="hidden md:table-cell px-3 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest">Proyectos</th>
                         <th className="px-3 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right">Salario (Q)</th>
                         <th className="px-3 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                         <th className="px-3 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
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
                            onClick={() => { if (bulkMode) { toggleSelectPersonal(m.id); } else { setSelectedMember(isSelected ? null : m); } }}
                            className={cn("hover:bg-slate-50/50 transition-colors group cursor-pointer",
                              (isSelected || selectedPersonalIds.has(m.id)) && "bg-secondary/5 border-l-2 border-secondary")}>
{bulkMode && (
                               <td className="px-2 py-2 w-6" onClick={e => e.stopPropagation()}>
                                 <input type="checkbox" checked={selectedPersonalIds.has(m.id)} onChange={() => toggleSelectPersonal(m.id)}
                                   className="w-3.5 h-3.5 accent-red-500 cursor-pointer" />
                               </td>
                             )}
                             <td className="px-3 py-2">
                               <div className="flex items-center gap-2">
                                 <div className={cn("w-6 h-6 rounded-md flex items-center justify-center font-black text-[8px] shrink-0",
                                   isSelected ? "bg-secondary text-primary" : "bg-slate-900 text-secondary")}>{initials}</div>
                                 <span className="text-[9px] font-black text-primary uppercase truncate max-w-25">{m.name}</span>
                               </div>
                             </td>
                             <td className="px-3 py-2">
                               <span className={cn("text-[7px] font-black uppercase px-1 py-0.5 rounded", rc.bg, rc.text)}>{m.role || '--'}</span>
                             </td>
                             <td className="hidden sm:table-cell px-3 py-2 text-[8px] text-slate-500 font-bold">{m.documentId || '--'}</td>
                             <td className="hidden md:table-cell px-3 py-2">
                               {assignedToProjects.length > 0
                                 ? <span className="text-[7px] font-black bg-blue-100 text-blue-700 px-1 py-0.5 rounded-full">{assignedToProjects.length} proy{assignedToProjects.length > 1 ? 's' : ''}</span>
                                 : <span className="text-[7px] text-slate-300 font-bold">—</span>}
                             </td>
                             <td className="px-3 py-2 text-right text-[9px] font-black text-primary">
                               {Number(m.salary || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                             </td>
                             <td className="px-3 py-2 text-center">
                               <span className={cn("text-[6px] font-black uppercase px-1 py-0.5 rounded-full",
                                 m.status === 'Activo' || !m.status ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
                                 {m.status || 'Activo'}
                               </span>
                             </td>
                             <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                               <div className="flex gap-0.5 justify-end">
                                 <button type="button" title="Editar" onClick={() => { setEditMember(m); setEditForm({ name: m.name, role: m.role, salary: String(m.salary), documentId: m.documentId, status: m.status || 'Activo', email: m.email||'', phone: m.phone||'', hireDate: m.hireDate||'', notes: m.notes||'' }); }} className="btn-edit"><Pencil size={10} /></button>
                                 <button type="button" title="Eliminar" onClick={() => handleDelete(m.id)} className="btn-delete"><Trash2 size={10} /></button>
                               </div>
                             </td>
                          </motion.tr>
                        );
                      })}
{filtered.length === 0 && (
                         <tr><td colSpan={7} className="py-8 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">Sin personal registrado</td></tr>
                       )}
                     </tbody>
                     {filtered.length > 0 && (
                       <tfoot className="sticky bottom-0 bg-slate-50 border-t border-slate-200">
                         <tr>
                           <td colSpan={4} className="px-3 py-2 text-[7px] font-black text-slate-400 uppercase tracking-widest">Total Nómina ({staff.length} colaboradores)</td>
                           <td className="px-3 py-2 text-right text-[9px] font-black text-secondary">{totalSalary.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</td>
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

{bulkMode && selectedPersonalIds.size > 0 && activeStaffTab === 'personal' && (
         <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3">
           <span className="text-[8px] font-black uppercase tracking-widest">{selectedPersonalIds.size} seleccionado(s)</span>
           <button type="button" onClick={handleBulkDeletePersonal}
             className="px-3 py-1 bg-white text-red-600 rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-red-50 transition-all">
             Eliminar
           </button>
            <button type="button" onClick={() => setSelectedPersonalIds(new Set())} aria-label="Deseleccionar"
              className="p-1 hover:bg-white/20 rounded-md transition-all">
              <X size={12} />
            </button>
         </div>
       )}
       {bulkMode && activeStaffTab !== 'personal' && selectedPayrollIds.size > 0 && (
         <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3">
           <span className="text-[8px] font-black uppercase tracking-widest">{selectedPayrollIds.size} seleccionado(s)</span>
           <button type="button" onClick={handleBulkDeletePayroll}
             className="px-3 py-1 bg-white text-red-600 rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-red-50 transition-all">
             Eliminar
           </button>
            <button type="button" onClick={() => setSelectedPayrollIds(new Set())} aria-label="Deseleccionar"
              className="p-1 hover:bg-white/20 rounded-md transition-all">
              <X size={12} />
            </button>
         </div>
       )}

      {/* Side Panel - Perfil del colaborador */}
        <AnimatePresence>
          {selectedMember && (
            <motion.div
              initial={{ opacity: 0, x: 40, width: 0 }}
animate={{ opacity: 1, x: 0, width: 280 }}
               exit={{ opacity: 0, x: 40, width: 0 }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="shrink-0 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden flex flex-col w-64 sm:w-80"
                style={{ minWidth: 200, maxWidth: 320 }}>
               <div className="bg-slate-900 p-3 relative">
                 <button type="button" title="Cerrar panel" onClick={() => setSelectedMember(null)}
                   className="absolute top-2 right-2 p-0.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                   <X size={12} />
                 </button>
                 <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-primary font-black text-xs shadow-md">
                     {selectedMember.name?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?'}
                   </div>
                   <div className="min-w-0">
                     <p className="text-[9px] font-black text-white uppercase leading-tight truncate">{selectedMember.name}</p>
                     <div className="flex items-center gap-1 mt-0.5">
                       {(() => { const rc = getRoleColor(selectedMember.role); return (
                         <span className={cn("text-[6px] font-black uppercase px-1 py-0.5 rounded", rc.bg, rc.text)}>{selectedMember.role || 'Sin cargo'}</span>
                       ); })()}
                       <span className={cn("text-[6px] font-black uppercase px-1 py-0.5 rounded-full",
                         (selectedMember.status || 'Activo') === 'Activo' ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300")}>
                         {selectedMember.status || 'Activo'}
                       </span>
                     </div>
                   </div>
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto p-3 space-y-3">
                 <div className="grid grid-cols-2 gap-1.5">
                   <div className="bg-amber-50 rounded-md p-1.5 text-center">
                     <p className="text-[6px] font-black text-amber-600 uppercase tracking-widest">Salario</p>
                     <p className="text-[10px] font-black text-amber-700">Q {Number(selectedMember.salary||0).toLocaleString('es-GT')}</p>
                   </div>
                   <div className="bg-blue-50 rounded-md p-1.5 text-center">
                     <p className="text-[6px] font-black text-blue-600 uppercase tracking-widest">Proyectos</p>
                     <p className="text-[10px] font-black text-blue-700">{memberProjects.length}</p>
                   </div>
                 </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Información</p>
                  <div className="space-y-1.5">
{[
                       { icon: <CreditCard size={8}/>, label: 'DPI', value: selectedMember.documentId },
                       { icon: <Phone size={8}/>, label: 'Tel', value: selectedMember.phone },
                       { icon: <Mail size={8}/>, label: 'Email', value: selectedMember.email },
                       { icon: <Calendar size={8}/>, label: 'Ingreso', value: selectedMember.hireDate },
                     ].map((item, i) => item.value ? (
                       <div key={i} className="flex items-center gap-1.5 text-[8px]">
                         <span className="text-slate-400 shrink-0">{item.icon}</span>
                         <span className="text-slate-500 font-bold shrink-0">{item.label}:</span>
                         <span className="text-primary font-black truncate">{item.value}</span>
                       </div>
                     ) : null)}
                  </div>
                </div>
                <div>
<div className="flex items-center justify-between mb-1">
                     <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Proyectos Asignados</p>
                     <span className="text-[6px] font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded-full">
                       {memberProjects.length} activo{memberProjects.length !== 1 ? 's' : ''}
                     </span>
                   </div>
                   {memberProjects.length === 0 ? (
                     <div className="text-center py-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                       <Building2 size={12} className="mx-auto mb-0.5 text-slate-300" />
                       <p className="text-[8px] text-slate-300 font-bold italic">Sin proyectos asignados</p>
                     </div>
                   ) : (
                     <div className="space-y-1">
                       {memberProjects.map(p => (
                         <div key={p.id} className="bg-slate-50 rounded-md p-1.5 flex items-center justify-between hover:bg-slate-100 transition-all group">
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-1 mb-0.5">
                               <p className="text-[8px] font-black text-primary uppercase truncate">{p.name}</p>
                               <span className={cn("text-[6px] font-black uppercase px-1 py-0.5 rounded-full",
                                 p.status === 'EJECUCION' ? "bg-secondary/20 text-secondary" :
                                 p.status === 'COTIZACION' ? "bg-blue-100 text-blue-600" :
                                 "bg-green-100 text-green-600")}>
                                 {p.status}
                               </span>
                             </div>
                             <div className="flex items-center gap-1 mt-0.5">
                               <div className="flex-1 bg-slate-200 rounded-full h-1">
                                  <div className="bg-secondary h-1 rounded-full transition-all w-[var(--progress)]" style={{ '--progress': `${p.progress || 0}%` } as React.CSSProperties} />
                               </div>
                               <span className="text-[6px] font-black text-slate-500">{p.progress || 0}%</span>
                             </div>
                           </div>
                           <button type="button" title="Remover del proyecto"
                             onClick={() => handleToggleProject(selectedMember.id, p.id)}
                             className="ml-1 p-0.5 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-all shrink-0 opacity-0 group-hover:opacity-100">
                             <X size={8} />
                           </button>
                         </div>
                       ))}
                     </div>
                   )}
                </div>
<div>
                   <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Asignar a Proyecto</p>
                   <div className="space-y-0.5">
                     {projects.filter(p => p.status === 'EJECUCION' && !p.teamIds?.includes(selectedMember.id)).slice(0, 5).map(p => (
                       <button type="button" key={p.id} onClick={() => handleToggleProject(selectedMember.id, p.id)}
                         className="w-full flex items-center justify-between bg-slate-50 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-md p-1.5 transition-all group">
                         <span className="text-[8px] font-black text-primary uppercase truncate">{p.name}</span>
                         <Plus size={8} className="text-slate-400 group-hover:text-blue-600 shrink-0" />
                       </button>
                     ))}
                     {projects.filter(p => p.status === 'EJECUCION' && !p.teamIds?.includes(selectedMember.id)).length === 0 && (
                       <p className="text-[8px] text-slate-300 font-bold italic">No hay proyectos disponibles</p>
                     )}
                   </div>
                 </div>
{selectedMember.notes && (
                   <div>
                     <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Notas</p>
                     <p className="text-[8px] text-slate-600 bg-slate-50 rounded-md p-1.5">{selectedMember.notes}</p>
                   </div>
                 )}
{/* Historial de Pagos */}
                 {(() => {
                   const memberPayrolls = payrolls
                     .filter(p => p.employees.some(e => e.staffId === selectedMember.id))
                     .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                     .slice(0, 4);
                   if (memberPayrolls.length === 0) return null;
                   return (
                     <div>
                       <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Historial de Pagos</p>
                       <div className="space-y-0.5">
                         {memberPayrolls.map(p => {
                           const emp = p.employees.find(e => e.staffId === selectedMember.id);
                           if (!emp) return null;
                           return (
                             <div key={p.id} className="bg-slate-50 rounded-md p-1.5">
                               <div className="flex justify-between items-center">
                                 <div className="flex items-center gap-1">
                                   <span className="text-[7px] font-black text-slate-700">{p.period}</span>
                                   <span className={cn("text-[6px] font-black uppercase px-1 py-0.5 rounded-full",
                                     p.status === 'PAGADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                                     {p.status}
                                   </span>
                                 </div>
                                 <span className="text-[8px] font-black text-primary">Q {emp.netPay.toLocaleString('es-GT')}</span>
                               </div>
                               <div className="text-[6px] text-slate-400 mt-0.5">
                                 {p.projectName} · {p.type} · {emp.daysWorked}d
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   );
                 })()}
               </div>
               <div className="p-2 border-t border-slate-100 flex gap-1">
                 <button type="button" onClick={() => { setEditMember(selectedMember); setEditForm({ name: selectedMember.name, role: selectedMember.role, salary: String(selectedMember.salary), documentId: selectedMember.documentId, status: selectedMember.status || 'Activo', email: selectedMember.email||'', phone: selectedMember.phone||'', hireDate: selectedMember.hireDate||'', notes: selectedMember.notes||'' }); }}
                   className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-slate-900 text-white rounded-md text-[8px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all">
                   <Pencil size={10} /> Editar
                 </button>
                 <button type="button" title="Eliminar colaborador" onClick={() => handleDelete(selectedMember.id)}
                  className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    ) : (
      <div className="w-full overflow-y-auto space-y-3">
            {payrolls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 opacity-40">
                <DollarSign size={40} className="text-slate-300 mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin planillas registradas</p>
                <button type="button" onClick={() => setIsPayrollModalOpen(true)}
                  className="mt-4 text-[9px] font-black text-emerald-600 border-b border-emerald-600 pb-0.5 uppercase tracking-widest">
                  Crear Primera Planilla
                </button>
              </div>
            ) : (
              <div className="grid gap-2">
                {bulkMode && payrolls.length > 0 && (
                  <div className="flex items-center gap-2 px-1 py-1">
                     <input type="checkbox" checked={selectedPayrollIds.size === payrolls.length && payrolls.length > 0}
                       onChange={toggleSelectAllPayroll} title="Seleccionar todas las planillas" className="w-4 h-4 accent-red-500 cursor-pointer" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      {selectedPayrollIds.size > 0 ? `${selectedPayrollIds.size} seleccionado(s)` : 'Seleccionar todo'}
                    </span>
                  </div>
                )}
                {payrolls.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(pay => {
                  const statusColor = pay.status === 'PAGADA' ? 'bg-emerald-100 text-emerald-700' : pay.status === 'BORRADOR' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
                  return (
                    <div key={pay.id}
                      onClick={() => { if (bulkMode) { toggleSelectPayroll(pay.id); } else { setSelectedPayroll(selectedPayroll?.id === pay.id ? null : pay); } }}
                      className={cn("bg-white border rounded-xl p-3 hover:shadow-md transition-all cursor-pointer relative",
                        selectedPayroll?.id === pay.id ? "border-secondary shadow-md ring-2 ring-secondary/20" : "border-slate-100")}>
                      {bulkMode && (
                        <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedPayrollIds.has(pay.id)} onChange={() => toggleSelectPayroll(pay.id)}
                            className="w-4 h-4 accent-red-500 cursor-pointer" />
                        </div>
                      )}
                      <div className={cn("flex items-center justify-between", bulkMode && "ml-6")}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-primary uppercase truncate">{pay.projectName}</span>
                            <span className={cn("text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full", statusColor)}>{pay.status}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[8px] text-slate-500 font-bold">{pay.type} · {pay.period}</span>
                            <span className="text-[8px] text-slate-400">|</span>
                            <span className="text-[8px] text-slate-500 font-bold">{pay.employees.length} empleado(s)</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-[10px] font-black text-primary">Q {pay.totalNet.toLocaleString('es-GT')}</p>
                          <p className="text-[7px] text-slate-400">Ded: Q {pay.totalDeductions.toLocaleString('es-GT')}</p>
                        </div>
                      </div>
                      {selectedPayroll?.id === pay.id && (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {pay.employees.map((e, i) => (
                              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-2 py-1.5 text-[8px]">
                                <div className="flex-1 min-w-0">
                                  <span className="font-black text-slate-700 truncate block">{e.name}</span>
                                  <span className="text-slate-400">{e.role}</span>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <span className="font-black text-primary">Q {e.netPay.toLocaleString('es-GT')}</span>
                                  <span className="text-slate-400 ml-1">(IGSS: Q {e.igss.toFixed(2)})</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <div className="text-[8px] text-slate-500">
                              <span>Bruto: Q {pay.totalGross.toLocaleString('es-GT')}</span>
                              <span className="ml-2">Bonos: Q {pay.totalBonuses.toLocaleString('es-GT')}</span>
                              <span className="ml-2">Deducciones: Q {pay.totalDeductions.toLocaleString('es-GT')}</span>
                            </div>
                            <div className="flex gap-1">
                              {pay.status === 'BORRADOR' && (
                                <>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); openEditPayroll(pay); }}
                                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-[8px] font-black uppercase hover:bg-blue-200 transition-all">
                                    <Pencil size={10} className="inline mr-0.5" /> Editar
                                  </button>
                                  <button type="button" onClick={() => markPayrollAsPaid(pay)}
                                    className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[8px] font-black uppercase hover:bg-emerald-200 transition-all">
                                    Marcar Pagada
                                  </button>
                                </>
                              )}
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleDeletePayroll(pay.id); }} aria-label="Eliminar planilla"
                                className="px-2 py-1 bg-red-100 text-red-600 rounded-lg text-[8px] font-black uppercase hover:bg-red-200 transition-all">
                                <Trash2 size={10} className="inline" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
{/* Modal Crear */}
       <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Nuevo Colaborador">
         <form onSubmit={handleCreate} className="space-y-3 text-left">
           <div className="space-y-1">
             <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo *</label>
             <input type="text" required placeholder="NOMBRE DEL TRABAJADOR" value={member.name}
               onChange={e => setMember({ ...member, name: e.target.value })} title="Nombre completo"
               className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
           </div>
           <div className="grid grid-cols-2 gap-2">
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo / Puesto</label>
               <select value={member.role} onChange={e => setMember({ ...member, role: e.target.value })} title="Cargo o puesto"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                 <option value="">SELECCIONAR...</option>
                 {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
               </select>
             </div>
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">DPI / Cédula</label>
               <input type="text" placeholder="DOCUMENTO ID" value={member.documentId}
                 onChange={e => setMember({ ...member, documentId: e.target.value })} title="Número de DPI"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
             </div>
           </div>
           <div className="grid grid-cols-2 gap-2">
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Salario Base (Q)</label>
               <input type="number" placeholder="0.00" value={member.salary}
                 onChange={e => setMember({ ...member, salary: e.target.value })} title="Salario mensual"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
             </div>
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Ingreso</label>
               <input type="date" value={member.hireDate}
                 onChange={e => setMember({ ...member, hireDate: e.target.value })} title="Fecha de ingreso"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
             </div>
           </div>
           <div className="grid grid-cols-2 gap-2">
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
               <input type="tel" placeholder="+502 0000-0000" value={member.phone}
                 onChange={e => setMember({ ...member, phone: e.target.value })} title="Teléfono"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
             </div>
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
               <input type="email" placeholder="correo@ejemplo.com" value={member.email}
                 onChange={e => setMember({ ...member, email: e.target.value })} title="Correo electrónico"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
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
         <form onSubmit={handleEditStaff} className="space-y-3 text-left">
           <div className="space-y-1">
             <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre</label>
             <input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} title="Nombre completo"
               className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
           </div>
           <div className="grid grid-cols-2 gap-2">
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo</label>
               <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} title="Cargo"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                 <option value="">SELECCIONAR...</option>
                 {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
               </select>
             </div>
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">DPI</label>
               <input type="text" value={editForm.documentId} onChange={e => setEditForm({ ...editForm, documentId: e.target.value })} title="DPI"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
             </div>
           </div>
           <div className="grid grid-cols-2 gap-2">
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Salario (Q)</label>
               <input type="number" value={editForm.salary} onChange={e => setEditForm({ ...editForm, salary: e.target.value })} title="Salario"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
             </div>
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</label>
               <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} title="Estado"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none">
                 <option>Activo</option><option>Inactivo</option>
               </select>
             </div>
           </div>
           <div className="grid grid-cols-2 gap-2">
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
               <input type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} title="Teléfono"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
             </div>
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
               <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} title="Email"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
             </div>
           </div>
           <div className="grid grid-cols-2 gap-2">
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Ingreso</label>
               <input type="date" value={editForm.hireDate} onChange={e => setEditForm({ ...editForm, hireDate: e.target.value })} title="Fecha de ingreso"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
             </div>
             <div className="space-y-1">
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Notas</label>
               <input type="text" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} title="Notas"
                 className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" />
             </div>
           </div>
           <button type="submit" className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-secondary hover:text-primary transition-all">GUARDAR CAMBIOS</button>
         </form>
       </Modal>

       {/* Modal Nueva Planilla */}
       <Modal isOpen={isPayrollModalOpen} onClose={() => setIsPayrollModalOpen(false)} title="Nueva Planilla de Pago">
         <div className="space-y-3 text-left">
           <div className="grid grid-cols-2 gap-2">
             <div>
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-1">Proyecto</label>
                <select value={payrollForm.projectId} onChange={e => setPayrollForm(f => ({ ...f, projectId: e.target.value, employees: [] }))} title="Proyecto"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[9px] font-black focus:outline-none focus:border-secondary">
                 <option value="">Seleccionar...</option>
                 {projects.filter(p => p.status === 'EJECUCION').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>
             </div>
             <div>
               <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-1">Período</label>
                <input type="month" value={payrollForm.period} onChange={e => setPayrollForm(f => ({ ...f, period: e.target.value }))} title="Mes"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[9px] font-black focus:outline-none focus:border-secondary" />
             </div>
           </div>
           <div>
             <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo</label>
             <div className="flex gap-2">
               {(['CAMPO', 'ADMINISTRATIVO'] as const).map(t => (
                 <button key={t} type="button" onClick={() => setPayrollForm(f => ({ ...f, type: t, employees: [] }))}
                   className={cn("flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all",
                     payrollForm.type === t
                       ? 'bg-slate-900 text-white border-slate-900'
                       : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50')}>
                   {t === 'CAMPO' ? 'Personal de Campo' : 'Administrativo'}
                 </button>
               ))}
             </div>
           </div>
           {payrollForm.projectId && (
             <div>
               <div className="flex justify-between items-center mb-1">
                 <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Empleados</label>
                 <button type="button" onClick={generatePayrollPreview}
                   className="text-[7px] font-black text-blue-600 uppercase hover:text-blue-800">
                   {payrollForm.employees.length > 0 ? 'Recalcular' : 'Previsualizar'}
                 </button>
               </div>
               {payrollForm.employees.length === 0 ? (
                 <p className="text-[8px] text-slate-400 italic py-2 text-center">Selecciona proyecto, tipo y haz clic en "Previsualizar"</p>
               ) : (
                 <div className="space-y-1 max-h-40 overflow-y-auto">
                   {payrollForm.employees.map((e, i) => (
                     <div key={i} className="bg-slate-50 rounded-md p-1.5">
                       <div className="flex justify-between items-center">
                         <div>
                           <span className="text-[8px] font-black text-slate-700">{e.name}</span>
                           <span className="text-[6px] text-slate-400 ml-1">{e.role}</span>
                         </div>
                         <span className="text-[8px] font-black text-primary">Q {e.netPay.toLocaleString('es-GT')}</span>
                       </div>
                       <div className="flex gap-1.5 mt-0.5 text-[6px] text-slate-500">
                         <span>Sal: Q {e.baseSalary.toLocaleString('es-GT')}</span>
                         <span>IGSS: Q {e.igss.toFixed(2)}</span>
                         <span>IRTRA: Q {e.irtra.toFixed(2)}</span>
                         <span>INTECAP: Q {e.intecap.toFixed(2)}</span>
                       </div>
                       <div className="flex items-center gap-2 mt-0.5">
                         <label className="text-[6px] text-slate-500">Días:</label>
                          <input type="number" min={1} max={30} value={e.daysWorked} title="Días trabajados"
                            onChange={e => {
                              const emps = [...payrollForm.employees];
                              const days = Math.min(30, Math.max(1, +e.target.value || 1));
                              emps[i] = { ...emps[i], daysWorked: days, grossPay: Math.round(emps[i].dailySalary * days * 100) / 100 };
                              const gross = emps[i].grossPay;
                              emps[i].igss = Math.round(gross * 0.0483 * 100) / 100;
                              emps[i].irtra = Math.round(gross * 0.01 * 100) / 100;
                              emps[i].intecap = Math.round(gross * 0.01 * 100) / 100;
                              emps[i].deductions = Math.round((emps[i].igss + emps[i].irtra + emps[i].intecap) * 100) / 100;
                              emps[i].netPay = Math.round((gross - emps[i].deductions + emps[i].bonuses) * 100) / 100;
                              setPayrollForm(f => ({ ...f, employees: emps }));
                            }}
                            className="w-12 bg-white border border-slate-200 rounded px-1 py-0.5 text-[7px] font-black text-center" />
                         <label className="text-[6px] text-slate-500 ml-1">Bon:</label>
                          <input type="number" min={0} value={e.bonuses} title="Bonificaciones"
                            onChange={e => {
                              const emps = [...payrollForm.employees];
                              emps[i] = { ...emps[i], bonuses: +e.target.value || 0 };
                              emps[i].netPay = Math.round((emps[i].grossPay - emps[i].deductions + emps[i].bonuses) * 100) / 100;
                              setPayrollForm(f => ({ ...f, employees: emps }));
                            }}
                            className="w-14 bg-white border border-slate-200 rounded px-1 py-0.5 text-[7px] font-black text-center" />
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           )}
           <div>
             <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-1">Notas</label>
              <textarea value={payrollForm.notes} onChange={e => setPayrollForm(f => ({ ...f, notes: e.target.value }))} title="Notas"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[8px] font-black focus:outline-none resize-none" rows={2} />
           </div>
           <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[9px]">
             <span className="font-black text-slate-500">
               {payrollForm.employees.length > 0 ? (
                 <>Total: <span className="text-primary">Q {payrollForm.employees.reduce((a, e) => a + e.netPay, 0).toLocaleString('es-GT')}</span></>
               ) : (
                 <span className="text-slate-300">Sin empleados cargados</span>
               )}
             </span>
             <button type="button" onClick={createPayroll} disabled={savingPayroll || payrollForm.employees.length === 0}
               className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all">
               {savingPayroll ? 'GUARDANDO...' : 'CREAR BORRADOR'}
             </button>
           </div>
         </div>
       </Modal>

       {/* Modal Editar Planilla */}
       <Modal isOpen={!!editingPayroll} onClose={() => setEditingPayroll(null)} title={`Editar Planilla — ${editingPayroll?.projectName || ''}`}>
         <div className="space-y-3 text-left">
           <div className="space-y-1">
             <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Empleados</label>
             <div className="space-y-1 max-h-52 overflow-y-auto">
               {editingPayrollForm.employees.map((e, i) => (
                 <div key={i} className="bg-slate-50 rounded-md p-1.5">
                   <div className="flex justify-between items-center">
                     <div>
                       <span className="text-[8px] font-black text-slate-700">{e.name}</span>
                       <span className="text-[6px] text-slate-400 ml-1">{e.role}</span>
                     </div>
                     <span className="text-[8px] font-black text-primary">Q {e.netPay.toLocaleString('es-GT')}</span>
                   </div>
                   <div className="flex items-center gap-2 mt-1">
                     <label className="text-[6px] text-slate-500">Días:</label>
                      <input type="number" min={1} max={30} value={e.daysWorked} title="Días trabajados"
                        onChange={ev => {
                          const emps = [...editingPayrollForm.employees];
                          const days = Math.min(30, Math.max(1, +ev.target.value || 1));
                          emps[i] = { ...emps[i], daysWorked: days, grossPay: Math.round(emps[i].dailySalary * days * 100) / 100 };
                          const gross = emps[i].grossPay;
                          emps[i].igss = Math.round(gross * 0.0483 * 100) / 100;
                          emps[i].irtra = Math.round(gross * 0.01 * 100) / 100;
                          emps[i].intecap = Math.round(gross * 0.01 * 100) / 100;
                          emps[i].deductions = Math.round((emps[i].igss + emps[i].irtra + emps[i].intecap) * 100) / 100;
                          emps[i].netPay = Math.round((gross - emps[i].deductions + emps[i].bonuses) * 100) / 100;
                          setEditingPayrollForm(f => ({ ...f, employees: emps }));
                        }}
                        className="w-12 bg-white border border-slate-200 rounded px-1 py-0.5 text-[7px] font-black text-center" />
                     <label className="text-[6px] text-slate-500 ml-1">Bon:</label>
                      <input type="number" min={0} value={e.bonuses} title="Bonificaciones"
                        onChange={ev => {
                          const emps = [...editingPayrollForm.employees];
                          emps[i] = { ...emps[i], bonuses: +ev.target.value || 0 };
                          emps[i].netPay = Math.round((emps[i].grossPay - emps[i].deductions + emps[i].bonuses) * 100) / 100;
                          setEditingPayrollForm(f => ({ ...f, employees: emps }));
                        }}
                        className="w-14 bg-white border border-slate-200 rounded px-1 py-0.5 text-[7px] font-black text-center" />
                   </div>
                 </div>
               ))}
             </div>
           </div>
           <div>
             <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-1">Notas</label>
              <textarea value={editingPayrollForm.notes} onChange={e => setEditingPayrollForm(f => ({ ...f, notes: e.target.value }))} title="Notas"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[8px] font-black focus:outline-none resize-none" rows={2} />
           </div>
           <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[9px]">
             <span className="font-black text-slate-500">
               Total: <span className="text-primary">Q {editingPayrollForm.employees.reduce((a, e) => a + e.netPay, 0).toLocaleString('es-GT')}</span>
             </span>
             <button type="button" onClick={saveEditPayroll} disabled={savingEditPayroll}
               className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all">
               {savingEditPayroll ? 'GUARDANDO...' : <><Save size={10} className="inline mr-0.5" />GUARDAR</>}
             </button>
           </div>
         </div>
       </Modal>
    </div>
  );
}

