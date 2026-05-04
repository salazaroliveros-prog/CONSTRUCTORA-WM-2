/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  UserCheck, 
  HardHat, 
  Calendar,
  DollarSign,
  Briefcase,
  Award,
  MoreHorizontal,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToCollection, addDocument, deleteDocument, parseError } from '../services/firestoreService';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import Modal from './ui/Modal';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  salary: string;
  documentId: string;
}

export default function StaffModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [member, setMember] = useState({ name: '', role: '', salary: '', documentId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCollection('staff', (data) => {
      setStaff(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('¿ELIMINAR COLABORADOR?')) {
      try {
        await deleteDocument('staff', id);
        toast.success("Colaborador eliminado");
      } catch (error) {
        console.error(error);
        toast.error("Error al eliminar", { description: parseError(error) });
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member.name) return;
    setSaving(true);
    try {
      await addDocument('staff', member);
      setIsModalOpen(false);
      setMember({ name: '', role: '', salary: '', documentId: '' });
      toast.success("Colaborador registrado");
    } catch (error) {
      console.error(error);
      toast.error("Error al registrar", { description: parseError(error) });
    } finally {
      setSaving(false);
    }
  };

  const filteredStaff = staff.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { 
    currentItems: paginatedStaff, 
    currentPage, 
    totalPages, 
    nextPage, 
    prevPage, 
    goToPage,
    startIndex,
    totalItems: totalStaffCount
  } = usePagination<StaffMember>(filteredStaff, 12);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="text-left">
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-primary uppercase">Recursos Humanos</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión de talento y cuadrillas</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button className="flex-1 md:flex-none border-2 border-slate-900 text-slate-900 px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
            Planilla
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none bg-primary text-white px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-primary/10"
          >
            <Plus size={16} /> NUEVO
          </button>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Registrar Nuevo Colaborador"
      >
        <form onSubmit={handleCreate} className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
            <input 
              type="text"
              required
              placeholder="NOMBRE DEL TRABAJADOR"
              value={member.name}
              onChange={e => setMember({...member, name: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo / Puesto</label>
              <select 
                value={member.role}
                onChange={e => setMember({...member, role: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary appearance-none"
              >
                <option value="">SELECCIONAR...</option>
                <option value="MAESTRO DE OBRA">MAESTRO DE OBRA</option>
                <option value="ALBAÑIL">ALBAÑIL</option>
                <option value="AYUDANTE">AYUDANTE</option>
                <option value="RESIDENTE">RESIDENTE</option>
                <option value="PLANIFICADOR">PLANIFICADOR</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Documento ID</label>
              <input 
                type="text"
                placeholder="DPI / CÉDULA"
                value={member.documentId}
                onChange={e => setMember({...member, documentId: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Salario / Sueldo Base (Q)</label>
            <input 
              type="number"
              placeholder="0.00"
              value={member.salary}
              onChange={e => setMember({...member, salary: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
            />
          </div>
          <button 
            type="submit"
            disabled={saving}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-secondary hover:text-primary transition-all disabled:opacity-50"
          >
            {saving ? 'PROCESANDO...' : 'GUARDAR COLABORADOR'}
          </button>
        </form>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
             <div className="relative flex-1 max-w-sm">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
               <input 
                type="text" 
                placeholder="BUSCAR PERSONAL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-[10px] font-black uppercase focus:outline-none focus:border-secondary shadow-inner transition-all"
               />
             </div>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                  <th className="hidden md:table-cell px-4 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Cargo</th>
                  <th className="px-4 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">#</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-bold">
                {paginatedStaff.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/10 transition-colors cursor-pointer group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                         <div className="w-7 h-7 rounded-lg bg-primary/5 flex items-center justify-center text-primary border border-primary/10 shrink-0">
                           <Users size={12} />
                         </div>
                         <div className="min-w-0">
                            <p className="text-[11px] font-black text-primary uppercase group-hover:text-secondary transition-colors truncate">{member.name}</p>
                            <p className="text-[7px] text-slate-400 uppercase truncate">ID: {member.id?.substring(0, 8)}</p>
                         </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-2.5">
                       <span className="text-[9px] text-slate-600 uppercase bg-slate-100 px-1.5 py-0.5 rounded font-black">{member.role}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                       <div className="flex justify-end gap-1">
                         <button 
                          onClick={() => handleDelete(member.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                         >
                            <Trash2 size={12} />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredStaff.length === 0 && (
            <div className="p-20 text-center opacity-20">
               <Users size={48} className="mx-auto mb-4" />
               <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sin personal registrado</p>
            </div>
          )}
          
          <div className="px-4 pb-4 mt-2">
             <Pagination 
               currentPage={currentPage}
               totalPages={totalPages}
               onNext={nextPage}
               onPrev={prevPage}
               onPage={goToPage}
               totalItems={totalStaffCount}
               startIndex={startIndex}
               itemsPerPage={12}
               compact={true}
             />
          </div>
        </div>

        <div className="md:col-span-4 space-y-6">
           <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-900/10">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <Briefcase size={16} className="text-secondary" /> Resumen de Nómina
              </h3>
              <div className="space-y-6 text-left">
                 <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Carga Horaria Mensual</p>
                    <p className="text-3xl font-black">0<span className="text-sm font-bold text-slate-500 ml-1 uppercase">Hrs</span></p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Costo Diario</p>
                       <p className="text-xl font-black text-secondary uppercase">Q 0.00</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Personal</p>
                       <p className="text-xl font-black">{staff.length}</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
