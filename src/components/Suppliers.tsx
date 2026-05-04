/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  Star, 
  Phone, 
  Mail, 
  MapPin, 
  ExternalLink,
  ShieldCheck,
  PackageCheck,
  AlertCircle,
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
  const [supplier, setSupplier] = useState({ name: '', category: '', contact: '', email: '', rating: '5.0', status: 'Activo' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCollection('suppliers', (data) => {
      setSuppliers(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('¿ELIMINAR PROVEEDOR?')) {
      try {
        await deleteDocument('suppliers', id);
        toast.success("Proveedor eliminado");
      } catch (error) {
        console.error(error);
        toast.error("Error al eliminar", { description: parseError(error) });
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier.name || !supplier.email) {
      toast.error("Error de validación", { description: "Nombre comercial y email son requeridos" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(supplier.email)) {
      toast.error("Error de validación", { description: "Email no es válido" });
      return;
    }
    setSaving(true);
    try {
      await addDocument('suppliers', supplier);
      setIsModalOpen(false);
      setSupplier({ name: '', category: '', contact: '', email: '', rating: '5.0', status: 'Activo' });
      toast.success("Proveedor registrado");
    } catch (error) {
      console.error(error);
      toast.error("Error al registrar", { description: parseError(error) });
    } finally {
      setSaving(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { 
    currentItems: paginatedSuppliers, 
    currentPage, 
    totalPages, 
    nextPage, 
    prevPage, 
    goToPage,
    startIndex,
    totalItems: totalSuppliersCount
  } = usePagination<Supplier>(filteredSuppliers, 9);

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
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-primary uppercase">Proveedores</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión de cadena de suministro</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto bg-primary text-white px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-primary/10"
        >
          <Plus size={18} /> Registrar
        </button>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Registrar Nuevo Proveedor"
      >
        <form onSubmit={handleCreate} className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Empresa</label>
            <input 
              type="text"
              required
              placeholder="NOMBRE COMERCIAL"
              value={supplier.name}
              onChange={e => setSupplier({...supplier, name: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría / Especialidad</label>
              <input 
                type="text"
                placeholder="EJ: OBRA GRIS, ELECTRICIDAD"
                value={supplier.category}
                onChange={e => setSupplier({...supplier, category: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono de Contacto</label>
              <input 
                type="text"
                placeholder="+502 "
                value={supplier.contact}
                onChange={e => setSupplier({...supplier, contact: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
            <input 
              type="email"
              placeholder="PROV@SISTEMA.COM"
              value={supplier.email}
              onChange={e => setSupplier({...supplier, email: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
            />
          </div>
          <button 
            type="submit"
            disabled={saving}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-secondary hover:text-primary transition-all disabled:opacity-50"
          >
            {saving ? 'PROCESANDO...' : 'REGISTRAR PROVEEDOR'}
          </button>
        </form>
      </Modal>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="relative flex-1 w-full max-w-md">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             <input 
              type="text" 
              placeholder="BUSCAR PROVEEDOR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary transition-all"
             />
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {paginatedSuppliers.map((supplier) => (
            <motion.div 
              key={supplier.id}
              className="bg-slate-50/50 rounded-xl border border-slate-100 p-4 transition-all duration-300 hover:bg-white hover:shadow-lg"
            >
              <div className="text-left">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-primary">
                    <Truck size={16} />
                  </div>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                    supplier.status === 'Activo' ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                  )}>
                    {supplier.status || 'Activo'}
                  </span>
                </div>
                
                <h3 className="text-xs font-black text-primary uppercase tracking-tight mb-0.5 truncate">{supplier.name}</h3>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">{supplier.category}</span>
                
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone size={10} className="text-secondary shrink-0" />
                    <span className="text-[9px] font-bold">{supplier.contact || '--'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Mail size={10} className="text-secondary shrink-0" />
                    <span className="text-[9px] font-bold lowercase truncate">{supplier.email || '--'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                   <div className="flex items-center gap-1 text-yellow-500 text-[9px] font-black">
                      <Star size={10} fill="currentColor" /> {supplier.rating || '5.0'}
                   </div>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => handleDelete(supplier.id)}
                    className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-secondary transition-all">
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
          {filteredSuppliers.length === 0 && (
            <div className="col-span-full py-20 text-center opacity-20">
               <Truck size={48} className="mx-auto mb-4" />
               <p className="text-[10px] font-black uppercase tracking-[0.2em]">No hay proveedores registrados</p>
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onNext={nextPage}
            onPrev={prevPage}
            onPage={goToPage}
            totalItems={totalSuppliersCount}
            startIndex={startIndex}
            itemsPerPage={9}
            compact={true}
          />
        </div>
      </div>
    </div>
  );
}
